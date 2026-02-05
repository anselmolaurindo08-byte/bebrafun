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

	// Discriminator from IDL: [213, 162, 203, 235, 151, 236, 178, 64]
	discriminator := []byte{213, 162, 203, 235, 151, 236, 178, 64}
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
	// Get authority wallet private key
	privateKeyStr := os.Getenv("SOLANA_AUTHORITY_PRIVATE_KEY")
	if privateKeyStr == "" {
		return "", fmt.Errorf("SOLANA_AUTHORITY_PRIVATE_KEY not set")
	}

	// Parse private key
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid authority wallet private key: %w", err)
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

	// Discriminator from IDL: [188, 143, 206, 111, 77, 207, 62, 244]
	discriminator := []byte{188, 143, 206, 111, 77, 207, 62, 244}
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

// CancelDuel cancels a duel on-chain and refunds player 1
func (c *AnchorClient) CancelDuel(
	ctx context.Context,
	duelID uint64,
	player1Pubkey solana.PublicKey,
) (string, error) {
	// Get platform wallet private key
	privateKeyStr := os.Getenv("PLATFORM_WALLET_PRIVATE_KEY")
	if privateKeyStr == "" {
		return "", fmt.Errorf("PLATFORM_WALLET_PRIVATE_KEY not set")
	}

	// Parse private key
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyStr)
	if err != nil {
		return "", fmt.Errorf("invalid platform wallet private key: %w", err)
	}

	// Derive duel PDA
	duelPDA, _, err := c.GetDuelPDA(duelID)
	if err != nil {
		return "", fmt.Errorf("failed to derive duel PDA: %w", err)
	}

	// Derive vault PDA
	vaultSeeds := [][]byte{
		[]byte("duel_vault"),
		make([]byte, 8),
	}
	binary.LittleEndian.PutUint64(vaultSeeds[1], duelID)
	vaultPDA, _, err := solana.FindProgramAddress(vaultSeeds, c.programID)
	if err != nil {
		return "", fmt.Errorf("failed to derive vault PDA: %w", err)
	}

	// Get player 1's SOL account (associated token account for native SOL)
	player1TokenAccount := player1Pubkey // For native SOL, use the wallet address directly

	// Build cancel_duel instruction
	discriminator := []byte{0x5f, 0x8e, 0x3d, 0x7c, 0x9a, 0x2b, 0x1e, 0x4f} // cancel_duel discriminator
	data := discriminator

	instruction := solana.NewInstruction(
		c.programID,
		solana.AccountMetaSlice{
			solana.Meta(duelPDA).WRITE(),
			solana.Meta(player1Pubkey).WRITE().SIGNER(),
			solana.Meta(player1TokenAccount).WRITE(),
			solana.Meta(vaultPDA).WRITE(),
			solana.Meta(solana.TokenProgramID),
		},
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
		solana.TransactionPayer(privateKey.PublicKey()),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create transaction: %w", err)
	}

	// Sign transaction
	_, err = tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(privateKey.PublicKey()) {
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
		return "", fmt.Errorf("failed to send cancel transaction: %w", err)
	}

	return sig.String(), nil
}
