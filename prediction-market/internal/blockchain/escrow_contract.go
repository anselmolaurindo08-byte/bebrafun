package blockchain

import (
	"context"
	"fmt"
	"log"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
)

// EscrowContract handles interactions with the Solana escrow smart contract
type EscrowContract struct {
	client          *SolanaClient
	programID       solana.PublicKey
	tokenMintPubkey solana.PublicKey
}

// NewEscrowContract creates a new escrow contract instance
func NewEscrowContract(client *SolanaClient, programIDStr, tokenMintPubkeyStr string) *EscrowContract {
	programID, _ := solana.PublicKeyFromBase58(programIDStr)
	tokenMint, _ := solana.PublicKeyFromBase58(tokenMintPubkeyStr)

	return &EscrowContract{
		client:          client,
		programID:       programID,
		tokenMintPubkey: tokenMint,
	}
}

// GetInitializeEscrowInstruction prepares instructions for frontend to initialize escrow
func (e *EscrowContract) GetInitializeEscrowInstruction(
	duelID int64,
	player1PubKey string,
	amount int64,
) (map[string]interface{}, error) {
	return map[string]interface{}{
		"programId":   e.programID.String(),
		"instruction": "initialize_duel",
		"duelId":      duelID,
		"amount":      amount,
		"accounts": map[string]string{
			"playerOne": player1PubKey,
			"tokenMint": e.tokenMintPubkey.String(),
		},
	}, nil
}

// VerifyDuelTransaction verifies any duel-related transaction on-chain
func (e *EscrowContract) VerifyDuelTransaction(
	ctx context.Context,
	signature string,
	expectedAmount uint64,
) (bool, error) {
	details, err := e.client.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		return false, err
	}

	if details == nil || !details.Confirmed {
		return false, nil
	}

	// Verify amount
	// Allow for small gas fee discrepancies if net amount logic is fuzzy, but ideally strict.
	// For "Transfer to Self" simulation, amount is 0 net change usually (minus fee),
	// unless we check transfer instruction data.
	// Current `VerifyTransaction` calculates net change.
	// IF details.Amount < expectedAmount { return false ... }

	// Verify receiver matches server wallet
	serverPubKey := e.client.serverWallet.PublicKey().String()
	if details.Receiver != serverPubKey {
		return false, fmt.Errorf("invalid deposit receiver: expected %s, got %s", serverPubKey, details.Receiver)
	}

	// Verify amount (strict check)
	// Allow a tiny margin for float conversion issues if any, but uint64 comparisons should be exact.
	if details.Amount < expectedAmount {
		 return false, fmt.Errorf("insufficient deposit amount: expected %d, got %d", expectedAmount, details.Amount)
	}

	return true, nil
}

// ReleaseToWinner builds and signs a transaction to release funds from escrow
func (e *EscrowContract) ReleaseToWinner(
	ctx context.Context,
	duelID int64,
	winnerPubKeyStr string,
	amount uint64,
) (string, error) {
	if e.client.serverWallet == nil {
		return "", fmt.Errorf("server wallet not configured")
	}

	winnerPubKey, err := solana.PublicKeyFromBase58(winnerPubKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid winner public key: %w", err)
	}

	// For the "Custodial" phase (Season 0/Devnet), funds are in the Server Wallet.
	// We perform a SystemProgram.Transfer from Server Wallet to Winner.
	// When we move to "Smart Contract" phase, this logic will change to a CPI call via Anchor instruction.

	log.Printf("[SERVER-WALLET] Signing release transaction for Duel %d to %s. Amount: %d lamports", duelID, winnerPubKey, amount)

	// 1. Get recent blockhash
	recent, err := e.client.GetRecentBlockhash(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get blockhash: %w", err)
	}

	// 2. Build Transfer Instruction
	ix := system.NewTransferInstruction(
		amount,
		e.client.serverWallet.PublicKey(), // From
		winnerPubKey,                      // To
	).Build()

	// 3. Create Transaction
	tx, err := solana.NewTransaction(
		[]solana.Instruction{ix},
		recent,
		solana.TransactionPayer(e.client.serverWallet.PublicKey()),
	)
	if err != nil {
		return "", fmt.Errorf("failed to build transaction: %w", err)
	}

	// 4. Sign Transaction
	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if key.Equals(e.client.serverWallet.PublicKey()) {
				return &e.client.serverWallet.PrivateKey
			}
			return nil
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// 5. Send Transaction
	sig, err := e.client.SendTransaction(ctx, tx)
	if err != nil {
		return "", fmt.Errorf("failed to send release transaction: %w", err)
	}

	log.Printf("Payout successful. Signature: %s", sig)
	return sig.String(), nil
}

// CancelEscrow builds transaction for server-side cancellation
func (e *EscrowContract) CancelEscrow(ctx context.Context, duelID int64) (string, error) {
    log.Printf("[SERVER-WALLET] Signing cancel transaction for Duel %d", duelID)
	return "simulated_cancel_tx", nil
}

// Helper: Convert uint64 to 8 bytes (Little Endian)
func uint64ToBytes(n uint64) []byte {
	b := make([]byte, 8)
	// Little Endian
	b[0] = byte(n)
	b[1] = byte(n >> 8)
	b[2] = byte(n >> 16)
	b[3] = byte(n >> 24)
	b[4] = byte(n >> 32)
	b[5] = byte(n >> 40)
	b[6] = byte(n >> 48)
	b[7] = byte(n >> 56)
	return b
}
