package blockchain

import (
	"context"
	"encoding/binary"
	"fmt"
	"os"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// ResolveDuel resolves a duel on-chain with exit price
func (c *AnchorClient) ResolveDuel(
	ctx context.Context,
	duelID uint64,
	exitPrice uint64,
	player1Pubkey solana.PublicKey,
	player2Pubkey solana.PublicKey,
) (string, error) {
	// Get server wallet private key
	privateKeyStr := os.Getenv("SERVER_WALLET_PRIVATE_KEY")
	if privateKeyStr == "" {
		return "", fmt.Errorf("SERVER_WALLET_PRIVATE_KEY not set")
	}

	// Parse private key
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid server wallet private key: %w", err)
	}

	authority := privateKey.PublicKey()

	// Derive duel PDA
	duelPDA, _, err := c.GetDuelPDA(duelID)
	if err != nil {
		return "", fmt.Errorf("failed to derive duel PDA: %w", err)
	}

	// Get fee collector (platform wallet)
	feeCollectorStr := os.Getenv("PLATFORM_WALLET_PUBLIC_KEY")
	if feeCollectorStr == "" {
		return "", fmt.Errorf("PLATFORM_WALLET_PUBLIC_KEY not set")
	}
	feeCollector, err := solana.PublicKeyFromBase58(feeCollectorStr)
	if err != nil {
		return "", fmt.Errorf("invalid platform wallet: %w", err)
	}

	// Build instruction data
	// Discriminator for resolve_duel (8 bytes) + exit_price (8 bytes)
	data := make([]byte, 16)

	// Compute discriminator: first 8 bytes of sha256("global:resolve_duel")
	// For now, use a placeholder - this should match the actual discriminator
	discriminator := []byte{0x51, 0x9c, 0x28, 0x3b, 0x2e, 0x8f, 0x8a, 0x7c} // Placeholder
	copy(data[0:8], discriminator)

	// exit_price: u64 (little-endian)
	binary.LittleEndian.PutUint64(data[8:16], exitPrice)

	// Build accounts
	accounts := []*solana.AccountMeta{
		{PublicKey: duelPDA, IsWritable: true, IsSigner: false},                 // duel
		{PublicKey: player1Pubkey, IsWritable: true, IsSigner: false},           // player_1
		{PublicKey: player2Pubkey, IsWritable: true, IsSigner: false},           // player_2
		{PublicKey: feeCollector, IsWritable: true, IsSigner: false},            // fee_collector
		{PublicKey: authority, IsWritable: false, IsSigner: true},               // authority
		{PublicKey: solana.SystemProgramID, IsWritable: false, IsSigner: false}, // system_program
	}

	// Create instruction
	instruction := solana.NewInstruction(
		c.programID,
		accounts,
		data,
	)

	// Get recent blockhash
	recent, err := c.rpcClient.GetRecentBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return "", fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	// Build transaction
	tx, err := solana.NewTransaction(
		[]solana.Instruction{instruction},
		recent.Value.Blockhash,
		solana.TransactionPayer(authority),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create transaction: %w", err)
	}

	// Sign transaction
	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(authority) {
			return &privateKey
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	sig, err := c.rpcClient.SendTransactionWithOpts(
		ctx,
		tx,
		rpc.TransactionOpts{
			SkipPreflight:       false,
			PreflightCommitment: rpc.CommitmentConfirmed,
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	return sig.String(), nil
}

// StartDuel starts a duel on-chain with entry price
func (c *AnchorClient) StartDuel(
	ctx context.Context,
	duelID uint64,
	entryPrice uint64,
) (string, error) {
	// Get server wallet private key
	privateKeyStr := os.Getenv("SERVER_WALLET_PRIVATE_KEY")
	if privateKeyStr == "" {
		return "", fmt.Errorf("SERVER_WALLET_PRIVATE_KEY not set")
	}

	// Parse private key
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid server wallet private key: %w", err)
	}

	authority := privateKey.PublicKey()

	// Derive duel PDA
	duelPDA, _, err := c.GetDuelPDA(duelID)
	if err != nil {
		return "", fmt.Errorf("failed to derive duel PDA: %w", err)
	}

	// Build instruction data
	// Discriminator for start_duel (8 bytes) + entry_price (8 bytes)
	data := make([]byte, 16)

	// Compute discriminator: first 8 bytes of sha256("global:start_duel")
	discriminator := []byte{0x3d, 0x4e, 0x9f, 0x12, 0xa1, 0xb3, 0xc4, 0xd5} // Placeholder
	copy(data[0:8], discriminator)

	// entry_price: u64 (little-endian)
	binary.LittleEndian.PutUint64(data[8:16], entryPrice)

	// Build accounts
	accounts := []*solana.AccountMeta{
		{PublicKey: duelPDA, IsWritable: true, IsSigner: false},   // duel
		{PublicKey: authority, IsWritable: false, IsSigner: true}, // authority
	}

	// Create instruction
	instruction := solana.NewInstruction(
		c.programID,
		accounts,
		data,
	)

	// Get recent blockhash
	recent, err := c.rpcClient.GetRecentBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return "", fmt.Errorf("failed to get recent blockhash: %w", err)
	}

	// Build transaction
	tx, err := solana.NewTransaction(
		[]solana.Instruction{instruction},
		recent.Value.Blockhash,
		solana.TransactionPayer(authority),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create transaction: %w", err)
	}

	// Sign transaction
	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(authority) {
			return &privateKey
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	sig, err := c.rpcClient.SendTransactionWithOpts(
		ctx,
		tx,
		rpc.TransactionOpts{
			SkipPreflight:       false,
			PreflightCommitment: rpc.CommitmentConfirmed,
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	return sig.String(), nil
}
