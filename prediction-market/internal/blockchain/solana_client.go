package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	bin "github.com/gagliardetto/binary"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/shopspring/decimal"
)

// SolanaClient handles Solana blockchain interactions
type SolanaClient struct {
	rpcClient             *rpc.Client
	network               string
	tokenMintAddress      string
	escrowContractAddress string
	serverWallet          *solana.Wallet
	httpClient            *http.Client
}

// RPCRequest represents a JSON-RPC request
type RPCRequest struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params,omitempty"`
}

// RPCResponse represents a JSON-RPC response
type RPCResponse struct {
	Jsonrpc string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC error
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// NewSolanaClient creates a new Solana client
func NewSolanaClient(network, tokenMintAddress, escrowContractAddress, privateKey string) *SolanaClient {
	var rpcURL string
	switch network {
	case "mainnet-beta":
		rpcURL = "https://api.mainnet-beta.solana.com"
	case "devnet":
		rpcURL = "https://api.devnet.solana.com"
	case "testnet":
		rpcURL = "https://api.testnet.solana.com"
	default:
		rpcURL = "https://api.devnet.solana.com"
	}

	client := &SolanaClient{
		rpcClient:             rpc.New(rpcURL),
		network:               network,
		tokenMintAddress:      tokenMintAddress,
		escrowContractAddress: escrowContractAddress,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	// Initialize server wallet if private key is provided
	if privateKey != "" {
		wallet, err := solana.WalletFromPrivateKeyBase58(privateKey)
		if err != nil {
			log.Printf("Warning: Failed to load server wallet: %v", err)
		} else {
			client.serverWallet = wallet
			log.Printf("Server wallet loaded: %s", wallet.PublicKey())
		}
	}

	return client
}

// SendTransaction sends a signed transaction to the network
func (s *SolanaClient) SendTransaction(ctx context.Context, tx *solana.Transaction) (solana.Signature, error) {
	sig, err := s.rpcClient.SendTransactionWithOpts(
		ctx,
		tx,
		rpc.TransactionOpts{
			SkipPreflight:       false,
			PreflightCommitment: rpc.CommitmentConfirmed,
		},
	)
	if err != nil {
		return solana.Signature{}, fmt.Errorf("failed to send transaction: %w", err)
	}
	return sig, nil
}

// GetRecentBlockhash gets the latest blockhash
func (s *SolanaClient) GetRecentBlockhash(ctx context.Context) (solana.Hash, error) {
	resp, err := s.rpcClient.GetLatestBlockhash(ctx, rpc.CommitmentConfirmed)
	if err != nil {
		return solana.Hash{}, fmt.Errorf("failed to get recent blockhash: %w", err)
	}
	return resp.Value.Blockhash, nil
}

// rpcCall makes a JSON-RPC call to the Solana node
func (s *SolanaClient) rpcCall(ctx context.Context, method string, params []interface{}) (*RPCResponse, error) {
	// Fallback to manual HTTP call for methods not covered by solana-go library or for custom parsing
	rpcURL := "https://api.devnet.solana.com"
	if s.network == "mainnet-beta" {
		rpcURL = "https://api.mainnet-beta.solana.com"
	}

	request := RPCRequest{
		Jsonrpc: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}

	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, strings.NewReader(string(reqBody)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var rpcResp RPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %s (code: %d)", rpcResp.Error.Message, rpcResp.Error.Code)
	}

	return &rpcResp, nil
}

// ValidateWalletAddress validates a Solana wallet address format
func (s *SolanaClient) ValidateWalletAddress(address string) bool {
	_, err := solana.PublicKeyFromBase58(address)
	return err == nil
}

// GetSOLBalance gets the SOL balance for a wallet
func (s *SolanaClient) GetSOLBalance(ctx context.Context, walletAddress string) (decimal.Decimal, error) {
	pubKey, err := solana.PublicKeyFromBase58(walletAddress)
	if err != nil {
		return decimal.Zero, err
	}

	balance, err := s.rpcClient.GetBalance(ctx, pubKey, rpc.CommitmentConfirmed)
	if err != nil {
		return decimal.Zero, err
	}

	// Convert lamports to SOL
	return decimal.NewFromInt(int64(balance.Value)).Div(decimal.NewFromInt(1_000_000_000)), nil
}

// TransactionDetails holds the parsed details of a verified transaction
type TransactionDetails struct {
	Signature string
	Sender    string
	Receiver  string
	Amount    uint64 // in lamports
	Confirmed bool
}

// VerifyTransaction verifies if a transaction is confirmed and returns its details
func (s *SolanaClient) VerifyTransaction(ctx context.Context, txHash string, requiredConfirmations int) (*TransactionDetails, error) {
	sig, err := solana.SignatureFromBase58(txHash)
	if err != nil {
		return nil, err
	}

	// 1. Check Status First
	status, err := s.rpcClient.GetSignatureStatuses(ctx, true, sig)
	if err != nil {
		return nil, err
	}

	if len(status.Value) == 0 || status.Value[0] == nil {
		return nil, nil // Not found
	}

	// Check for execution errors
	if status.Value[0].Err != nil {
		log.Printf("Transaction %s failed with error: %v", txHash, status.Value[0].Err)
		return nil, fmt.Errorf("transaction execution failed")
	}

	confStatus := status.Value[0].ConfirmationStatus
	if confStatus != rpc.ConfirmationStatusConfirmed && confStatus != rpc.ConfirmationStatusFinalized {
		return nil, nil // Not confirmed yet
	}

	// 2. Fetch Full Transaction Content to Verify Amount & Receiver
	tx, err := s.rpcClient.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
		Commitment: rpc.CommitmentConfirmed,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction details: %w", err)
	}

	transaction, err := tx.Transaction.GetTransaction()
	if err != nil {
		log.Printf("Failed to decode transaction: %v", err)
		return &TransactionDetails{Signature: txHash, Confirmed: true}, nil
	}

	if len(transaction.Message.AccountKeys) < 2 {
		return &TransactionDetails{Signature: txHash, Confirmed: true}, nil
	}

	sender := transaction.Message.AccountKeys[0].String()
	receiver := transaction.Message.AccountKeys[1].String()

	log.Printf("[VerifyTransaction] Transaction %s: sender=%s, receiver=%s", txHash, sender, receiver)
	log.Printf("[VerifyTransaction] PreBalances: %v", tx.Meta.PreBalances)
	log.Printf("[VerifyTransaction] PostBalances: %v", tx.Meta.PostBalances)
	log.Printf("[VerifyTransaction] Account keys: %v", transaction.Message.AccountKeys)

	// Calculate amount - check ALL accounts for balance increases
	var amount uint64
	if len(tx.Meta.PreBalances) == len(tx.Meta.PostBalances) {
		// Check each account for balance increase
		for i := 0; i < len(tx.Meta.PreBalances); i++ {
			preBalance := tx.Meta.PreBalances[i]
			postBalance := tx.Meta.PostBalances[i]

			if postBalance > preBalance {
				increase := postBalance - preBalance
				log.Printf("[VerifyTransaction] Account %d (%s): balance increased by %d lamports",
					i, transaction.Message.AccountKeys[i].String(), increase)

				// Use the largest increase as the amount (typically the receiver)
				if increase > amount {
					amount = increase
				}
			}
		}
	} else {
		log.Printf("[VerifyTransaction] WARNING: PreBalances and PostBalances length mismatch")
	}

	log.Printf("[VerifyTransaction] Final calculated amount: %d lamports", amount)

	return &TransactionDetails{
		Signature: txHash,
		Sender:    sender,
		Receiver:  receiver,
		Amount:    amount,
		Confirmed: true,
	}, nil
}

// GetTransactionStatus gets status (backward compatibility)
func (s *SolanaClient) GetTransactionStatus(ctx context.Context, txHash string) (bool, int, error) {
	tx, err := s.VerifyTransaction(ctx, txHash, 1)
	if err != nil {
		return false, 0, err
	}
	if tx != nil && tx.Confirmed {
		return true, 10, nil
	}
	return false, 0, nil
}

// GetServerWalletPublicKey returns the public key of the server wallet if configured
func (s *SolanaClient) GetServerWalletPublicKey() string {
	if s.serverWallet == nil {
		return ""
	}
	return s.serverWallet.PublicKey().String()
}

// GetTokenAccountBalance gets the token balance for a specific owner and mint
func (s *SolanaClient) GetTokenAccountBalance(ctx context.Context, ownerAddress string, mintAddress string) (uint64, error) {
	owner, err := solana.PublicKeyFromBase58(ownerAddress)
	if err != nil {
		return 0, fmt.Errorf("invalid owner address: %w", err)
	}
	mint, err := solana.PublicKeyFromBase58(mintAddress)
	if err != nil {
		return 0, fmt.Errorf("invalid mint address: %w", err)
	}

	// Find token accounts for this mint owned by the address
	resp, err := s.rpcClient.GetTokenAccountsByOwner(
		ctx,
		owner,
		&rpc.GetTokenAccountsConfig{
			Mint: &mint,
		},
		&rpc.GetTokenAccountsOpts{
			Encoding: solana.EncodingBase64,
		},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to get token accounts: %w", err)
	}

	if len(resp.Value) == 0 {
		return 0, nil // No account means 0 balance
	}

	// Sum up balances if multiple accounts exist (though typically there's only one for a pool)
	var totalBalance uint64
	for _, account := range resp.Value {
		var tokenAccount token.Account
		decoder := bin.NewBinDecoder(account.Account.Data.GetBinary())
		err := tokenAccount.UnmarshalWithDecoder(decoder)
		if err != nil {
			log.Printf("Warning: failed to decode token account data: %v", err)
			continue
		}
		totalBalance += tokenAccount.Amount
	}

	return totalBalance, nil
}

// GetTokenBalance gets the token balance for the configured default mint
func (s *SolanaClient) GetTokenBalance(ctx context.Context, walletAddress string) (decimal.Decimal, error) {
	if s.tokenMintAddress == "" {
		return decimal.Zero, fmt.Errorf("token mint address not configured")
	}

	balance, err := s.GetTokenAccountBalance(ctx, walletAddress, s.tokenMintAddress)
	if err != nil {
		return decimal.Zero, err
	}

	// Assuming 6 decimals for default token (USDC/etc) - should be dynamic but MVP
	return decimal.NewFromInt(int64(balance)).Div(decimal.NewFromInt(1_000_000)), nil
}
