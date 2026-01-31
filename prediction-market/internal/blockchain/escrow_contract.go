package blockchain

import (
	"context"
	"fmt"
	"log"
)

// EscrowContract handles interactions with the Solana escrow smart contract
type EscrowContract struct {
	client          *SolanaClient
	programID       string
	tokenMintPubkey string
}

// NewEscrowContract creates a new escrow contract instance
func NewEscrowContract(client *SolanaClient, programID, tokenMintPubkey string) *EscrowContract {
	return &EscrowContract{
		client:          client,
		programID:       programID,
		tokenMintPubkey: tokenMintPubkey,
	}
}

// InitializeEscrow prepares instructions for frontend to initialize escrow
func (e *EscrowContract) GetInitializeEscrowInstruction(
	duelID int64,
	player1PubKey string,
	amount int64,
) (map[string]interface{}, error) {
	// Returns parameters needed by frontend to build instruction
	return map[string]interface{}{
		"programId":   e.programID,
		"instruction": "initialize_duel_escrow",
		"duelId":      duelID,
		"amount":      amount,
		"accounts": map[string]string{
			"playerOne": player1PubKey,
			"tokenMint": e.tokenMintPubkey,
		},
	}, nil
}

// VerifyDuelTransaction verifies any duel-related transaction on-chain
func (e *EscrowContract) VerifyDuelTransaction(
	ctx context.Context,
	signature string,
) (bool, error) {
	// Check if confirmed
	confirmed, err := e.client.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		return false, fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !confirmed {
		return false, nil
	}

	// Ideally, we parse the transaction logs here to ensure it called our program
	// and executed the correct instruction (e.g., "Program log: Instruction: InitializeDuelEscrow")
	// For MVP, confirmation existence is the first gate.

	return true, nil
}

// ReleaseToWinner builds the transaction for server-side signing to release funds
// Note: This requires the server to hold the authority keypair (if server is authority)
// OR this is just an instruction builder if we want a user to trigger it (but user shouldn't trigger release ideally)
// Assuming server authority for now.
func (e *EscrowContract) ReleaseToWinner(
	ctx context.Context,
	duelID int64,
	winnerPubKey string,
) (string, error) {
	// In a real implementation:
	// 1. Construct Transaction with "resolve_duel" instruction
	// 2. Sign with Server Keypair (loaded from env/vault)
	// 3. Send and Confirm

	log.Printf("[MOCK-REAL] Server releasing duel %d funds to %s", duelID, winnerPubKey)
	// We return a mock signature because we haven't implemented server-side signing yet
	// But this is where the `solana-go` SDK logic would go.
	return "server_release_signature_placeholder", nil
}

// CancelEscrow builds transaction for server-side cancellation
func (e *EscrowContract) CancelEscrow(ctx context.Context, duelID int64) (string, error) {
    log.Printf("[MOCK-REAL] Server cancelling duel %d", duelID)
	return "server_cancel_signature_placeholder", nil
}

// GetEscrowAccountState reads the on-chain state of a duel
func (e *EscrowContract) GetEscrowAccountState(ctx context.Context, duelID int64) (map[string]interface{}, error) {
	// Derive PDA
	// In real code: pda, _ := publickey.FindProgramAddress(...)
	pda := fmt.Sprintf("pda_duel_%d", duelID) // Placeholder

	// Fetch Account Info
	// e.client.rpcCall("getAccountInfo", ...)
	// Deserialize data using Anchor layout

	log.Printf("Fetching state for %s", pda)
	return map[string]interface{}{
		"state": "Active", // Mock response
	}, nil
}
