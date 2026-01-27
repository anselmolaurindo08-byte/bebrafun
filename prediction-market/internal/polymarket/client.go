package polymarket

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	PolymarketClobURL  = "https://clob.polymarket.com"
	PolymarketGammaURL = "https://gamma-api.polymarket.com"
)

type PolymarketClient struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
	secret     string
	passphrase string
}

type PolymarketMarket struct {
	ID            string   `json:"id"`
	Question      string   `json:"question"`
	Slug          string   `json:"slug"`
	Description   string   `json:"description"`
	Outcomes      string   `json:"outcomes"`      // JSON string like "[\"Yes\",\"No\"]"
	OutcomePrices string   `json:"outcomePrices"` // JSON string like "[\"0.65\",\"0.35\"]"
	Volume        string   `json:"volume"`
	Liquidity     string   `json:"liquidity"`
	Active        bool     `json:"active"`
	Closed        bool     `json:"closed"`
	Featured      bool     `json:"featured"`
	EndDate       string   `json:"endDate"`
	CreatedAt     string   `json:"createdAt"`
	VolumeNum     float64  `json:"-"` // computed field
}

// ParseOutcomes parses the outcomes JSON string into a slice
func (m *PolymarketMarket) ParseOutcomes() []string {
	var outcomes []string
	if m.Outcomes != "" {
		json.Unmarshal([]byte(m.Outcomes), &outcomes)
	}
	return outcomes
}

// GetVolumeFloat parses volume string to float64
func (m *PolymarketMarket) GetVolumeFloat() float64 {
	vol, _ := strconv.ParseFloat(m.Volume, 64)
	return vol
}

type PolymarketMarketsResponse struct {
	Markets []PolymarketMarket `json:"markets"`
	Next    string             `json:"next"`
}

func NewPolymarketClient(apiKey, secret, passphrase string) *PolymarketClient {
	return &PolymarketClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:    PolymarketGammaURL,
		apiKey:     apiKey,
		secret:     secret,
		passphrase: passphrase,
	}
}

// signRequest creates HMAC signature for authenticated requests
func (c *PolymarketClient) signRequest(timestamp, method, path, body string) string {
	message := timestamp + method + path + body
	h := hmac.New(sha256.New, []byte(c.secret))
	h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// addAuthHeaders adds authentication headers to the request
func (c *PolymarketClient) addAuthHeaders(req *http.Request, method, path, body string) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := c.signRequest(timestamp, method, path, body)

	req.Header.Set("POLY-API-KEY", c.apiKey)
	req.Header.Set("POLY-SIGNATURE", signature)
	req.Header.Set("POLY-TIMESTAMP", timestamp)
	req.Header.Set("POLY-PASSPHRASE", c.passphrase)
	req.Header.Set("Content-Type", "application/json")
}

// GetMarkets fetches markets from Polymarket API
func (c *PolymarketClient) GetMarkets(limit int, offset int) (*PolymarketMarketsResponse, error) {
	url := fmt.Sprintf("%s/markets?limit=%d&offset=%d", c.baseURL, limit, offset)
	path := fmt.Sprintf("/markets?limit=%d&offset=%d", limit, offset)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeaders(req, "GET", path, "")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch markets: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("polymarket API error: %d - %s", resp.StatusCode, string(body))
	}

	var result PolymarketMarketsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetMarketsByTag fetches markets and filters by category keywords
func (c *PolymarketClient) GetMarketsByTag(tag string, limit int) ([]PolymarketMarket, error) {
	// Gamma API - fetch active markets, filter locally by category keywords
	url := fmt.Sprintf("%s/markets?limit=100&closed=false&active=true", c.baseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch markets: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("polymarket API error: %d - %s", resp.StatusCode, string(body))
	}

	var allMarkets []PolymarketMarket
	if err := json.NewDecoder(resp.Body).Decode(&allMarkets); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Filter by category keywords
	filtered := c.filterByCategory(allMarkets, tag)

	if len(filtered) > limit {
		return filtered[:limit], nil
	}
	return filtered, nil
}

// filterByCategory filters markets by category keywords
func (c *PolymarketClient) filterByCategory(markets []PolymarketMarket, category string) []PolymarketMarket {
	keywords := getCategoryKeywords(category)
	var result []PolymarketMarket

	for _, m := range markets {
		questionLower := strings.ToLower(m.Question)
		descLower := strings.ToLower(m.Description)

		for _, kw := range keywords {
			if strings.Contains(questionLower, kw) || strings.Contains(descLower, kw) {
				result = append(result, m)
				break
			}
		}
	}
	return result
}

// getCategoryKeywords returns keywords for category filtering
func getCategoryKeywords(category string) []string {
	switch strings.ToLower(category) {
	case "politics":
		return []string{"trump", "biden", "election", "president", "congress", "senate", "democrat", "republican", "vote", "governor", "political", "government", "law", "bill", "policy"}
	case "sports":
		return []string{"nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "hockey", "tennis", "golf", "championship", "super bowl", "world cup", "game", "match", "team"}
	case "crypto":
		return []string{"bitcoin", "btc", "ethereum", "eth", "crypto", "blockchain", "token", "coin", "defi", "solana", "sol", "price"}
	default:
		return []string{}
	}
}

// GetMarketByID fetches a specific market by ID
func (c *PolymarketClient) GetMarketByID(marketID string) (*PolymarketMarket, error) {
	url := fmt.Sprintf("%s/markets/%s", c.baseURL, marketID)
	path := fmt.Sprintf("/markets/%s", marketID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeaders(req, "GET", path, "")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch market: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("polymarket API error: %d", resp.StatusCode)
	}

	var market PolymarketMarket
	if err := json.NewDecoder(resp.Body).Decode(&market); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &market, nil
}
