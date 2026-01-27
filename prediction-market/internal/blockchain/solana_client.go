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

	"github.com/shopspring/decimal"
)

// SolanaClient handles Solana blockchain interactions
type SolanaClient struct {
	rpcURL                string
	network               string
	tokenMintAddress      string
	escrowContractAddress string
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
func NewSolanaClient(network, tokenMintAddress, escrowContractAddress string) *SolanaClient {
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

	return &SolanaClient{
		rpcURL:                rpcURL,
		network:               network,
		tokenMintAddress:      tokenMintAddress,
		escrowContractAddress: escrowContractAddress,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// rpcCall makes a JSON-RPC call to the Solana node
func (s *SolanaClient) rpcCall(ctx context.Context, method string, params []interface{}) (*RPCResponse, error) {
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

	req, err := http.NewRequestWithContext(ctx, "POST", s.rpcURL, strings.NewReader(string(reqBody)))
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
	// Solana addresses are base58 encoded and 32-44 characters long
	if len(address) < 32 || len(address) > 44 {
		return false
	}

	// Check for valid base58 characters
	validChars := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	for _, c := range address {
		if !strings.ContainsRune(validChars, c) {
			return false
		}
	}

	return true
}

// GetSOLBalance gets the SOL balance for a wallet
func (s *SolanaClient) GetSOLBalance(ctx context.Context, walletAddress string) (decimal.Decimal, error) {
	params := []interface{}{
		walletAddress,
		map[string]string{"commitment": "confirmed"},
	}

	resp, err := s.rpcCall(ctx, "getBalance", params)
	if err != nil {
		return decimal.Zero, err
	}

	var result struct {
		Value uint64 `json:"value"`
	}
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return decimal.Zero, fmt.Errorf("failed to parse balance: %w", err)
	}

	// Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
	balance := decimal.NewFromInt(int64(result.Value)).Div(decimal.NewFromInt(1_000_000_000))
	return balance, nil
}

// GetTokenBalance gets the token balance for a specific SPL token
func (s *SolanaClient) GetTokenBalance(ctx context.Context, walletAddress string) (decimal.Decimal, error) {
	if s.tokenMintAddress == "" {
		return decimal.Zero, fmt.Errorf("token mint address not configured")
	}

	params := []interface{}{
		walletAddress,
		map[string]interface{}{
			"mint": s.tokenMintAddress,
		},
		map[string]string{"encoding": "jsonParsed"},
	}

	resp, err := s.rpcCall(ctx, "getTokenAccountsByOwner", params)
	if err != nil {
		log.Printf("Warning: Could not fetch token balance: %v", err)
		return decimal.Zero, nil
	}

	var result struct {
		Value []struct {
			Account struct {
				Data struct {
					Parsed struct {
						Info struct {
							TokenAmount struct {
								UiAmount float64 `json:"uiAmount"`
								Amount   string  `json:"amount"`
								Decimals int     `json:"decimals"`
							} `json:"tokenAmount"`
						} `json:"info"`
					} `json:"parsed"`
				} `json:"data"`
			} `json:"account"`
		} `json:"value"`
	}

	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return decimal.Zero, fmt.Errorf("failed to parse token balance: %w", err)
	}

	if len(result.Value) == 0 {
		return decimal.Zero, nil
	}

	balance := decimal.NewFromFloat(result.Value[0].Account.Data.Parsed.Info.TokenAmount.UiAmount)
	return balance, nil
}

// GetTransactionStatus gets the status of a transaction
func (s *SolanaClient) GetTransactionStatus(ctx context.Context, txHash string) (bool, int, error) {
	params := []interface{}{
		txHash,
		map[string]interface{}{
			"encoding":                       "json",
			"maxSupportedTransactionVersion": 0,
		},
	}

	resp, err := s.rpcCall(ctx, "getTransaction", params)
	if err != nil {
		return false, 0, err
	}

	if resp.Result == nil || string(resp.Result) == "null" {
		return false, 0, nil // Transaction not found
	}

	var result struct {
		Slot uint64 `json:"slot"`
		Meta struct {
			Err interface{} `json:"err"`
		} `json:"meta"`
	}

	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return false, 0, fmt.Errorf("failed to parse transaction: %w", err)
	}

	// Get current slot for confirmation count
	currentSlot, err := s.GetCurrentSlot(ctx)
	if err != nil {
		return false, 0, err
	}

	confirmations := int(currentSlot - result.Slot)
	isSuccess := result.Meta.Err == nil

	return isSuccess, confirmations, nil
}

// GetCurrentSlot gets the current slot number
func (s *SolanaClient) GetCurrentSlot(ctx context.Context) (uint64, error) {
	resp, err := s.rpcCall(ctx, "getSlot", []interface{}{
		map[string]string{"commitment": "confirmed"},
	})
	if err != nil {
		return 0, err
	}

	var slot uint64
	if err := json.Unmarshal(resp.Result, &slot); err != nil {
		return 0, fmt.Errorf("failed to parse slot: %w", err)
	}

	return slot, nil
}

// VerifyTransaction verifies if a transaction is confirmed
func (s *SolanaClient) VerifyTransaction(ctx context.Context, txHash string, requiredConfirmations int) (bool, error) {
	isSuccess, confirmations, err := s.GetTransactionStatus(ctx, txHash)
	if err != nil {
		return false, err
	}

	return isSuccess && confirmations >= requiredConfirmations, nil
}

// GetEscrowBalance gets the token balance in the escrow contract
func (s *SolanaClient) GetEscrowBalance(ctx context.Context) (decimal.Decimal, error) {
	if s.escrowContractAddress == "" {
		return decimal.Zero, fmt.Errorf("escrow contract address not configured")
	}

	return s.GetTokenBalance(ctx, s.escrowContractAddress)
}

// GetNetwork returns the current network
func (s *SolanaClient) GetNetwork() string {
	return s.network
}

// GetTokenMintAddress returns the token mint address
func (s *SolanaClient) GetTokenMintAddress() string {
	return s.tokenMintAddress
}

// GetEscrowContractAddress returns the escrow contract address
func (s *SolanaClient) GetEscrowContractAddress() string {
	return s.escrowContractAddress
}
