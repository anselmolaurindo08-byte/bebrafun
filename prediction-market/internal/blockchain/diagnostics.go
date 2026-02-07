package blockchain

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// DiagnosticResult holds the result of a Solana connectivity diagnostic
type DiagnosticResult struct {
	RPCConnected      bool   `json:"rpc_connected"`
	RPCURL            string `json:"rpc_url"`
	RPCError          string `json:"rpc_error,omitempty"`
	LatestBlockhash   string `json:"latest_blockhash,omitempty"`
	AuthorityKeySet   bool   `json:"authority_key_set"`
	AuthorityPubkey   string `json:"authority_pubkey,omitempty"`
	AuthorityError    string `json:"authority_error,omitempty"`
	ProgramID         string `json:"program_id"`
	TestDuelPDA       string `json:"test_duel_pda,omitempty"`
	PDAError          string `json:"pda_error,omitempty"`
	PlatformWalletSet bool   `json:"platform_wallet_set"`
	PlatformWallet    string `json:"platform_wallet,omitempty"`
	Timestamp         string `json:"timestamp"`
}

// RunDiagnostics checks Solana RPC connectivity, authority key, and PDA derivation
func (c *AnchorClient) RunDiagnostics(ctx context.Context) *DiagnosticResult {
	result := &DiagnosticResult{
		Timestamp: time.Now().Format(time.RFC3339),
		ProgramID: c.programID.String(),
	}

	// 1. Check RPC connectivity
	log.Printf("[Diagnostics] Testing RPC connectivity...")
	result.RPCURL = os.Getenv("SOLANA_RPC_URL")
	if result.RPCURL == "" {
		result.RPCURL = "https://api.devnet.solana.com (default)"
	}

	blockhash, err := c.rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		result.RPCConnected = false
		result.RPCError = err.Error()
		log.Printf("[Diagnostics] ❌ RPC FAILED: %v", err)
	} else {
		result.RPCConnected = true
		result.LatestBlockhash = blockhash.Value.Blockhash.String()
		log.Printf("[Diagnostics] ✅ RPC connected, blockhash: %s", result.LatestBlockhash)
	}

	// 2. Check authority key
	log.Printf("[Diagnostics] Testing authority key...")
	privateKeyStr := os.Getenv("SOLANA_AUTHORITY_PRIVATE_KEY")
	if privateKeyStr == "" {
		result.AuthorityKeySet = false
		result.AuthorityError = "SOLANA_AUTHORITY_PRIVATE_KEY not set"
		log.Printf("[Diagnostics] ❌ SOLANA_AUTHORITY_PRIVATE_KEY not set!")
	} else {
		result.AuthorityKeySet = true
		privateKey, err := solana.PrivateKeyFromBase58(privateKeyStr)
		if err != nil {
			result.AuthorityError = fmt.Sprintf("Invalid key: %v", err)
			log.Printf("[Diagnostics] ❌ Authority key invalid: %v", err)
		} else {
			result.AuthorityPubkey = privateKey.PublicKey().String()
			log.Printf("[Diagnostics] ✅ Authority pubkey: %s", result.AuthorityPubkey)
		}
	}

	// 3. Test PDA derivation (use duel ID 1 as test)
	log.Printf("[Diagnostics] Testing PDA derivation...")
	testPDA, _, err := c.GetDuelPDA(1)
	if err != nil {
		result.PDAError = err.Error()
		log.Printf("[Diagnostics] ❌ PDA derivation failed: %v", err)
	} else {
		result.TestDuelPDA = testPDA.String()
		log.Printf("[Diagnostics] ✅ Test PDA (duel 1): %s", result.TestDuelPDA)
	}

	// 4. Check platform wallet
	platformWallet := os.Getenv("PLATFORM_WALLET_PUBLIC_KEY")
	result.PlatformWalletSet = platformWallet != ""
	if platformWallet != "" {
		result.PlatformWallet = platformWallet
	}

	return result
}
