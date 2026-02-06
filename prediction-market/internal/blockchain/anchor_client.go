package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// AnchorClient handles interactions with the Anchor smart contract
type AnchorClient struct {
	rpcClient *rpc.Client
	programID solana.PublicKey
	idl       *IDL
}

// IDL represents the Anchor Interface Definition Language structure
type IDL struct {
	Version      string        `json:"version"`
	Name         string        `json:"name"`
	Instructions []Instruction `json:"instructions"`
	Accounts     []Account     `json:"accounts"`
	Types        []Type        `json:"types"`
	Events       []Event       `json:"events"`
}

// Instruction represents an Anchor instruction
type Instruction struct {
	Name string           `json:"name"`
	Args []InstructionArg `json:"args"`
}

// InstructionArg represents an instruction argument
type InstructionArg struct {
	Name string      `json:"name"`
	Type interface{} `json:"type"`
}

// Account represents an Anchor account structure
type Account struct {
	Name string      `json:"name"`
	Type AccountType `json:"type"`
}

// AccountType represents the type definition of an account
type AccountType struct {
	Kind   string  `json:"kind"`
	Fields []Field `json:"fields"`
}

// Field represents a field in an account or type
type Field struct {
	Name string      `json:"name"`
	Type interface{} `json:"type"`
}

// Type represents a custom type definition
type Type struct {
	Name string   `json:"name"`
	Type TypeInfo `json:"type"`
}

// TypeInfo contains type definition details
type TypeInfo struct {
	Kind   string  `json:"kind"`
	Fields []Field `json:"fields"`
}

// Event represents an Anchor event
type Event struct {
	Name   string  `json:"name"`
	Fields []Field `json:"fields"`
}

// Pool represents the on-chain AMM pool account
type Pool struct {
	MarketID         uint64
	Authority        solana.PublicKey
	TokenMint        solana.PublicKey
	YesReserve       uint64
	NoReserve        uint64
	BaseYesLiquidity uint64
	BaseNoLiquidity  uint64
	FeePercentage    uint16
	Status           uint8
	Bump             uint8
}

// Duel represents the on-chain duel account
type Duel struct {
	DuelID     uint64
	Player1    solana.PublicKey
	Player2    *solana.PublicKey
	BetAmount  uint64
	TokenMint  solana.PublicKey
	Status     uint8
	Winner     *solana.PublicKey
	CreatedAt  int64
	StartedAt  *int64
	ResolvedAt *int64
	Bump       uint8
}

// NewAnchorClient creates a new Anchor client instance
func NewAnchorClient(rpcURL string, programID string, idlPath string) (*AnchorClient, error) {
	// Parse program ID
	programPubkey, err := solana.PublicKeyFromBase58(programID)
	if err != nil {
		return nil, fmt.Errorf("invalid program ID: %w", err)
	}

	// Create RPC client
	rpcClient := rpc.New(rpcURL)

	// Load IDL
	idl, err := loadIDL(idlPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load IDL: %w", err)
	}

	return &AnchorClient{
		rpcClient: rpcClient,
		programID: programPubkey,
		idl:       idl,
	}, nil
}

// loadIDL loads the IDL from a JSON file
func loadIDL(path string) (*IDL, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read IDL file: %w", err)
	}

	var idl IDL
	if err := json.Unmarshal(data, &idl); err != nil {
		return nil, fmt.Errorf("failed to parse IDL: %w", err)
	}

	return &idl, nil
}

// GetPoolPDA derives the PDA for a pool account
func (c *AnchorClient) GetPoolPDA(poolID uint64) (solana.PublicKey, uint8, error) {
	poolIDBytes := make([]byte, 8)
	// Convert uint64 to little-endian bytes
	for i := 0; i < 8; i++ {
		poolIDBytes[i] = byte(poolID >> (i * 8))
	}

	seeds := [][]byte{
		[]byte("pool"),
		poolIDBytes,
	}

	pda, bump, err := solana.FindProgramAddress(seeds, c.programID)
	if err != nil {
		return solana.PublicKey{}, 0, fmt.Errorf("failed to derive pool PDA: %w", err)
	}

	return pda, bump, nil
}

// GetDuelPDA derives the PDA for a duel account
func (c *AnchorClient) GetDuelPDA(duelID uint64) (solana.PublicKey, uint8, error) {
	duelIDBytes := make([]byte, 8)
	// Convert uint64 to little-endian bytes
	for i := 0; i < 8; i++ {
		duelIDBytes[i] = byte(duelID >> (i * 8))
	}

	seeds := [][]byte{
		[]byte("duel"),
		duelIDBytes,
	}

	pda, bump, err := solana.FindProgramAddress(seeds, c.programID)
	if err != nil {
		return solana.PublicKey{}, 0, fmt.Errorf("failed to derive duel PDA: %w", err)
	}

	log.Printf("[GetDuelPDA] DuelID: %d, PDA: %s, Bump: %d", duelID, pda.String(), bump)
	return pda, bump, nil
}

// GetPool fetches and deserializes a pool account from the blockchain
func (c *AnchorClient) GetPool(ctx context.Context, poolID uint64) (*Pool, error) {
	pda, _, err := c.GetPoolPDA(poolID)
	if err != nil {
		return nil, err
	}

	// Fetch account info
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx, pda)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pool account: %w", err)
	}

	if accountInfo == nil || accountInfo.Value == nil {
		return nil, fmt.Errorf("pool account not found")
	}

	// Deserialize account data
	pool, err := deserializePool(accountInfo.Value.Data.GetBinary())
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize pool: %w", err)
	}

	return pool, nil
}

// GetDuel fetches and deserializes a duel account from the blockchain
func (c *AnchorClient) GetDuel(ctx context.Context, duelID uint64) (*Duel, error) {
	pda, _, err := c.GetDuelPDA(duelID)
	if err != nil {
		return nil, err
	}

	// Fetch account info
	accountInfo, err := c.rpcClient.GetAccountInfo(ctx, pda)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch duel account: %w", err)
	}

	if accountInfo == nil || accountInfo.Value == nil {
		return nil, fmt.Errorf("duel account not found")
	}

	// Deserialize account data
	duel, err := deserializeDuel(accountInfo.Value.Data.GetBinary())
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize duel: %w", err)
	}

	return duel, nil
}

// deserializePool deserializes pool account data
func deserializePool(data []byte) (*Pool, error) {
	if len(data) < 8 {
		return nil, fmt.Errorf("invalid pool data length")
	}

	// Skip 8-byte discriminator
	data = data[8:]

	if len(data) < 121 { // Minimum size for Pool struct
		return nil, fmt.Errorf("insufficient pool data")
	}

	pool := &Pool{}
	offset := 0

	// market_id: u64 (8 bytes)
	pool.MarketID = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// authority: Pubkey (32 bytes)
	pool.Authority = solana.PublicKeyFromBytes(data[offset : offset+32])
	offset += 32

	// token_mint: Pubkey (32 bytes)
	pool.TokenMint = solana.PublicKeyFromBytes(data[offset : offset+32])
	offset += 32

	// yes_reserve: u64 (8 bytes)
	pool.YesReserve = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// no_reserve: u64 (8 bytes)
	pool.NoReserve = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// base_yes_liquidity: u64 (8 bytes)
	pool.BaseYesLiquidity = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// base_no_liquidity: u64 (8 bytes)
	pool.BaseNoLiquidity = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// fee_percentage: u16 (2 bytes)
	pool.FeePercentage = uint16(data[offset]) | uint16(data[offset+1])<<8
	offset += 2

	// status: u8 (1 byte)
	pool.Status = data[offset]
	offset += 1

	// bump: u8 (1 byte)
	pool.Bump = data[offset]

	return pool, nil
}

// deserializeDuel deserializes duel account data
func deserializeDuel(data []byte) (*Duel, error) {
	if len(data) < 8 {
		return nil, fmt.Errorf("invalid duel data length")
	}

	// Skip 8-byte discriminator
	data = data[8:]

	if len(data) < 106 { // Minimum size for Duel struct
		return nil, fmt.Errorf("insufficient duel data")
	}

	duel := &Duel{}
	offset := 0

	// duel_id: u64 (8 bytes)
	duel.DuelID = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// player1: Pubkey (32 bytes)
	duel.Player1 = solana.PublicKeyFromBytes(data[offset : offset+32])
	offset += 32

	// player2: Option<Pubkey> (1 + 32 bytes)
	hasPlayer2 := data[offset] == 1
	offset += 1
	if hasPlayer2 {
		player2 := solana.PublicKeyFromBytes(data[offset : offset+32])
		duel.Player2 = &player2
		offset += 32
	} else {
		offset += 32 // Skip the 32 bytes even if None
	}

	// bet_amount: u64 (8 bytes)
	duel.BetAmount = uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56
	offset += 8

	// token_mint: Pubkey (32 bytes)
	duel.TokenMint = solana.PublicKeyFromBytes(data[offset : offset+32])
	offset += 32

	// status: u8 (1 byte)
	duel.Status = data[offset]
	offset += 1

	// winner: Option<Pubkey> (1 + 32 bytes)
	hasWinner := data[offset] == 1
	offset += 1
	if hasWinner {
		winner := solana.PublicKeyFromBytes(data[offset : offset+32])
		duel.Winner = &winner
		offset += 32
	} else {
		offset += 32
	}

	// created_at: i64 (8 bytes)
	duel.CreatedAt = int64(uint64(data[offset]) | uint64(data[offset+1])<<8 |
		uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
		uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
		uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56)
	offset += 8

	// started_at: Option<i64> (1 + 8 bytes)
	hasStartedAt := data[offset] == 1
	offset += 1
	if hasStartedAt {
		startedAt := int64(uint64(data[offset]) | uint64(data[offset+1])<<8 |
			uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
			uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
			uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56)
		duel.StartedAt = &startedAt
		offset += 8
	} else {
		offset += 8
	}

	// resolved_at: Option<i64> (1 + 8 bytes)
	hasResolvedAt := data[offset] == 1
	offset += 1
	if hasResolvedAt {
		resolvedAt := int64(uint64(data[offset]) | uint64(data[offset+1])<<8 |
			uint64(data[offset+2])<<16 | uint64(data[offset+3])<<24 |
			uint64(data[offset+4])<<32 | uint64(data[offset+5])<<40 |
			uint64(data[offset+6])<<48 | uint64(data[offset+7])<<56)
		duel.ResolvedAt = &resolvedAt
		offset += 8
	} else {
		offset += 8
	}

	// bump: u8 (1 byte)
	duel.Bump = data[offset]

	return duel, nil
}

// GetProgramID returns the program ID
func (c *AnchorClient) GetProgramID() solana.PublicKey {
	return c.programID
}
