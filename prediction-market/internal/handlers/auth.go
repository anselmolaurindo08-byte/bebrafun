package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/twitterv2"
	"github.com/mrjones/oauth"

	"prediction-market/internal/auth"
	"prediction-market/internal/services"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService    *services.AuthService
	consumerKey    string
	consumerSecret string
}

// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(authService *services.AuthService, consumerKey, consumerSecret string) *AuthHandler {
	return &AuthHandler{
		authService:    authService,
		consumerKey:    consumerKey,
		consumerSecret: consumerSecret,
	}
}

// InitTwitterProvider initializes the Twitter OAuth provider
func InitTwitterProvider(consumerKey, consumerSecret, callbackURL string) {
	goth.UseProviders(
		twitterv2.New(consumerKey, consumerSecret, callbackURL),
	)
}

// Login redirects to Twitter OAuth
func (h *AuthHandler) Login(c *gin.Context) {
	log.Printf("Login request received from: %s", c.ClientIP())

	// Store invite code in session if provided
	inviteCode := c.Query("invite_code")
	if inviteCode != "" {
		// In production, store this in a session or temporary storage
		c.SetCookie("invite_code", inviteCode, 3600, "/", "", false, true)
	}

	// Set provider query parameter for gothic
	q := c.Request.URL.Query()
	q.Add("provider", "twitterv2")
	c.Request.URL.RawQuery = q.Encode()

	log.Printf("Initiating OAuth flow with provider: twitterv2, URL: %s", c.Request.URL.String())
	gothic.BeginAuthHandler(c.Writer, c.Request)
}

// Callback handles the OAuth callback from Twitter
func (h *AuthHandler) Callback(c *gin.Context) {
	log.Printf("Callback received from: %s, URL: %s", c.ClientIP(), c.Request.URL.String())

	// Set provider query parameter for gothic
	q := c.Request.URL.Query()
	q.Add("provider", "twitterv2")
	c.Request.URL.RawQuery = q.Encode()

	log.Printf("Processing callback with provider: twitterv2")

	// Complete OAuth flow
	user, err := gothic.CompleteUserAuth(c.Writer, c.Request)
	if err != nil {
		log.Printf("OAuth error: %v", err)
		log.Printf("Request URL: %s", c.Request.URL.String())
		log.Printf("Request headers: %+v", c.Request.Header)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to complete OAuth authentication",
		})
		return
	}

	log.Printf("OAuth successful for user: %s (ID: %s)", user.NickName, user.UserID)

	// Get invite code from cookie if exists
	inviteCode, _ := c.Cookie("invite_code")

	// Extract followers count
	// The library doesn't fetch public_metrics by default, so we fetch them manually
	followersCount := h.fetchFollowersCount(user.AccessToken, user.AccessTokenSecret)
	log.Printf("Fetched followers count: %d", followersCount)

	// Process OAuth callback and create/update user
	dbUser, err := h.authService.ProcessOAuthCallback(
		user.UserID,
		user.NickName,
		followersCount,
		inviteCode,
	)
	if err != nil {
		log.Printf("Failed to process OAuth callback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create or update user",
		})
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(dbUser.ID, dbUser.XUsername)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate authentication token",
		})
		return
	}

	// Clear invite code cookie
	c.SetCookie("invite_code", "", -1, "/", "", false, true)

	// Redirect to frontend with token
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Create redirect URL with token
	redirectURL := fmt.Sprintf("%s/oauth-callback?token=%s", frontendURL, token)
	log.Printf("Redirecting to: %s", redirectURL)
	c.Redirect(http.StatusFound, redirectURL)
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// Set provider query parameter for gothic
	q := c.Request.URL.Query()
	q.Add("provider", "twitterv2")
	c.Request.URL.RawQuery = q.Encode()

	gothic.Logout(c.Writer, c.Request)

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully logged out",
	})
}

// fetchFollowersCount manually fetches user metrics from Twitter API v2 using OAuth 1.0a signing
func (h *AuthHandler) fetchFollowersCount(accessToken, accessSecret string) int {
	consumer := oauth.NewConsumer(
		h.consumerKey,
		h.consumerSecret,
		oauth.ServiceProvider{},
	)

	token := &oauth.AccessToken{Token: accessToken, Secret: accessSecret}

	// Twitter V2 User Metrics Endpoint
	endpoint := "https://api.twitter.com/2/users/me"

	response, err := consumer.Get(endpoint, map[string]string{"user.fields": "public_metrics"}, token)
	if err != nil {
		log.Printf("Failed to fetch followers count: %v", err)
		return 0
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		log.Printf("Failed to fetch followers count, status code: %d", response.StatusCode)
		return 0
	}

	// Read body for debugging
	bodyBytes, err := io.ReadAll(response.Body)
	if err != nil {
		log.Printf("Failed to read response body: %v", err)
		return 0
	}
	log.Printf("Twitter V2 Response: %s", string(bodyBytes))

	var result struct {
		Data struct {
			PublicMetrics struct {
				FollowersCount int `json:"followers_count"`
			} `json:"public_metrics"`
		} `json:"data"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		log.Printf("Failed to decode followers count response: %v", err)
		return 0
	}

	return result.Data.PublicMetrics.FollowersCount
}
