package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"prediction-market/internal/auth"
	"prediction-market/internal/blockchain"
	"prediction-market/internal/config"
	"prediction-market/internal/database"
	"prediction-market/internal/handlers"
	"prediction-market/internal/jobs"
	"prediction-market/internal/repository"
	"prediction-market/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize JWT
	auth.InitJWT(cfg.App.JWTSecret)

	// Connect to database
	if err := database.Connect(cfg.GetDSN()); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if err := database.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	authService := services.NewAuthService(database.GetDB())
	userService := services.NewUserService(database.GetDB())
	blockchainService := services.NewBlockchainService(
		database.GetDB(),
		"devnet",                          // Use "mainnet-beta" for production
		"",                                // Token mint address (configure later)
		"",                                // Escrow contract address (configure later)
		cfg.Solana.ServerWalletPrivateKey, // Server wallet private key from env
	)

	// Initialize repository
	repo := repository.NewRepository(database.GetDB())

	// Initialize Solana client
	solanaClient := blockchain.NewSolanaClient(
		"devnet",                          // network
		"",                                // Token mint address (configure later)
		"",                                // Escrow contract address (configure later)
		cfg.Solana.ServerWalletPrivateKey, // Server wallet private key from env
	)

	// Initialize escrow contract
	escrowContract := blockchain.NewEscrowContract(
		solanaClient,
		cfg.Solana.EscrowProgramID, // Program ID from config
		"",                         // Token mint pubkey (configure later)
	)

	// Initialize payout service
	payoutService := services.NewPayoutService(
		escrowContract,
		repo,
		cfg.Solana.PlatformFeePercent,
	)

	// Initialize duel service
	duelService := services.NewDuelService(repo, escrowContract, solanaClient, payoutService)

	// Initialize AMM service
	ammService := services.NewAMMService(database.GetDB(), solanaClient)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userService)
	marketHandler := handlers.NewMarketHandler(database.GetDB())
	// tradingHandler := handlers.NewTradingHandler(database.GetDB()) // Commented out - handler not implemented
	referralHandler := handlers.NewReferralHandler(database.GetDB())
	adminHandler := handlers.NewAdminHandler(database.GetDB())
	blockchainHandler := handlers.NewBlockchainHandler(database.GetDB(), blockchainService)
	duelHandler := handlers.NewDuelHandler(duelService)
	ammHandler := handlers.NewAMMHandler(ammService)

	// Start market parser job (runs every 6 hours)
	parserJob := jobs.NewMarketParserJob(
		database.GetDB(),
		cfg.Polymarket.APIKey,
		cfg.Polymarket.Secret,
		cfg.Polymarket.Passphrase,
	)
	parserJob.Start(6 * time.Hour)
	log.Println("Market parser job started")

	// Set up Gin router
	router := gin.Default()

	// CORS middleware
	allowedOrigins := []string{
		"https://bebrafun1.vercel.app", // Production frontend
		"http://localhost:3000",        // Local development
		"http://localhost:3001",
		"http://localhost:5173", // Vite dev server
		"http://127.0.0.1:3000",
		"http://127.0.0.1:3001",
		"http://127.0.0.1:5173",
	}
	// Add additional frontend URL from environment if provided
	if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
		allowedOrigins = append(allowedOrigins, frontendURL)
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Authentication routes (public)
	authRoutes := router.Group("/auth")
	{
		authRoutes.POST("/wallet", authHandler.WalletLogin)
		authRoutes.POST("/logout", authHandler.Logout)
	}

	// Authenticated /auth/me route
	authProtected := router.Group("/auth")
	authProtected.Use(auth.AuthMiddleware())
	{
		authProtected.GET("/me", authHandler.GetMe)
	}

	// Public market routes
	router.GET("/api/markets", marketHandler.GetMarkets)
	router.GET("/api/markets/:id", marketHandler.GetMarketByID)

	// API routes (protected)
	api := router.Group("/api")
	api.Use(auth.AuthMiddleware())
	{
		// User endpoints
		userRoutes := api.Group("/user")
		{
			userRoutes.GET("/profile", userHandler.GetProfile)
			// userRoutes.GET("/balance", userHandler.GetBalance) // Method not implemented
			userRoutes.GET("/invite-codes", userHandler.GetInviteCodes)
			userRoutes.GET("/referrals", userHandler.GetReferrals)
		}

		// Trading endpoints (protected) - must come before :id routes
		// api.POST("/orders", tradingHandler.PlaceOrder) // Handler not implemented
		// api.DELETE("/orders/:id", tradingHandler.CancelOrder)
		// api.GET("/orders", tradingHandler.GetUserOrders)

		// Market endpoints (protected)
		api.POST("/markets", marketHandler.CreateMarket)
		api.POST("/markets/propose", marketHandler.ProposeMarket)
		api.GET("/markets/proposals/pending", marketHandler.GetPendingProposals)
		api.POST("/markets/proposals/:id/moderate", marketHandler.ModerateProposal)
		// api.GET("/trading/portfolio/:market_id", tradingHandler.GetUserPortfolio) // Handler not implemented
		// api.GET("/trading/pnl/:market_id", tradingHandler.GetUserPnL)
		api.POST("/markets/:id/resolve", marketHandler.ResolveMarket)

		// Referral endpoints (protected)
		api.GET("/referral/code", referralHandler.GetReferralCode)
		api.POST("/referral/apply", referralHandler.ApplyReferralCode)
		api.GET("/referral/stats", referralHandler.GetReferralStats)
		api.GET("/referral/referrals", referralHandler.GetReferrals)
		api.GET("/referral/rebates", referralHandler.GetReferralRebates)

		// Social share endpoints (protected)
		api.POST("/social/share/twitter", referralHandler.ShareWinOnTwitter)
		api.GET("/social/shares", referralHandler.GetSocialShares)

		// Contest endpoints (for users)
		// api.GET("/contests", adminHandler.GetActiveContests) // Method not implemented
		// api.POST("/contests/:id/join", adminHandler.JoinContest) // Method not implemented
		// api.GET("/contests/:id/leaderboard", adminHandler.GetContestLeaderboard)

		// Wallet/Blockchain endpoints (protected)
		api.POST("/wallet/connect", blockchainHandler.ConnectWallet)
		api.DELETE("/wallet/disconnect", blockchainHandler.DisconnectWallet)
		api.GET("/wallet", blockchainHandler.GetWalletConnection)
		api.POST("/wallet/refresh", blockchainHandler.RefreshWalletBalance)
		api.GET("/wallet/balances", blockchainHandler.GetUserBalances)

		// Escrow endpoints (protected)
		api.GET("/escrow/balance", blockchainHandler.GetEscrowBalance)
		api.GET("/escrow/transactions", blockchainHandler.GetEscrowTransactions)
		api.POST("/escrow/lock", blockchainHandler.LockTokensForDuel)
		api.POST("/escrow/confirm", blockchainHandler.ConfirmEscrowDeposit)

		// Duel endpoints (protected)
		api.POST("/duels", duelHandler.CreateDuel)
		api.GET("/duels", duelHandler.GetPlayerDuels)
		api.GET("/duels/stats", duelHandler.GetPlayerStatistics)
		api.GET("/duels/config", duelHandler.GetConfig)
		api.GET("/duels/available", duelHandler.GetAvailableDuels)
		api.GET("/duels/user/:userId", duelHandler.GetUserDuels)
		api.POST("/duels/confirm-transaction", duelHandler.ConfirmTransaction)
		api.GET("/duels/confirmations/:transactionHash", duelHandler.CheckConfirmations)
		api.POST("/duels/resolve", duelHandler.ResolveDuelWithPrice)
		api.POST("/duels/share/x", duelHandler.ShareOnX)
		api.POST("/duels/:id/join", duelHandler.JoinDuel)
		api.POST("/duels/:id/deposit", duelHandler.DepositToDuel)
		api.POST("/duels/:id/cancel", duelHandler.CancelDuel)
		api.GET("/duels/:id/result", duelHandler.GetDuelResult)

		// AMM endpoints (protected)
		amm := api.Group("/amm")
		{
			amm.GET("/pools", ammHandler.GetAllPools)
			amm.GET("/pools/:id", ammHandler.GetPool)
			amm.GET("/pools/market/:market_id", ammHandler.GetPoolByMarket)
			amm.POST("/pools", ammHandler.CreatePool)
			amm.GET("/quote", ammHandler.GetTradeQuote)
			amm.POST("/trades", ammHandler.RecordTrade)
			amm.GET("/trades/:pool_id", ammHandler.GetTradeHistory)
			amm.GET("/positions/:pool_id/:user_address", ammHandler.GetUserPosition)
			amm.GET("/positions/user/:user_address", ammHandler.GetUserPositions)
			amm.GET("/prices/:pool_id", ammHandler.GetPriceHistory)
		}
	}

	// Public duel routes
	router.GET("/api/duels/:id", duelHandler.GetDuel)

	// Admin routes (protected + admin only)
	admin := router.Group("/api/admin")
	admin.Use(auth.AuthMiddleware())
	admin.Use(adminHandler.AdminMiddleware())
	{
		admin.GET("/dashboard", adminHandler.GetDashboard)
		admin.GET("/stats", adminHandler.GetPlatformStats)
		admin.GET("/logs", adminHandler.GetAdminLogs)

		// User management
		admin.GET("/users", adminHandler.GetUsers)
		admin.POST("/users/restrict", adminHandler.RestrictUser)
		admin.DELETE("/users/restrictions/:id", adminHandler.RemoveRestriction)
		admin.GET("/users/:id/restrictions", adminHandler.GetUserRestrictions)
		// admin.POST("/users/balance", adminHandler.UpdateUserBalance) // Method not implemented
		admin.POST("/users/promote", adminHandler.PromoteToAdmin)

		// Market management
		admin.GET("/markets", adminHandler.GetMarkets)
		admin.PUT("/markets/:id/status", adminHandler.UpdateMarketStatus)

		// Contest management
		// admin.GET("/contests", adminHandler.GetContests) // Method not implemented
		// admin.POST("/contests", adminHandler.CreateContest) // Method not implemented
		// admin.GET("/contests/:id", adminHandler.GetContest)
		// admin.POST("/contests/:id/start", adminHandler.StartContest)
		// admin.POST("/contests/:id/end", adminHandler.EndContest)

		// Duel management
		admin.POST("/duels/:id/resolve", duelHandler.ResolveDuel)
		admin.GET("/duels/active", duelHandler.GetActiveDuels)
	}

	// Public order book route
	// router.GET("/api/trading/orderbook/:market_id/:event_id", tradingHandler.GetOrderBook) // Handler not implemented

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on port %s", cfg.Server.Port)
		log.Printf("Health check: http://localhost:%s/health", cfg.Server.Port)
		log.Printf("Wallet auth: POST http://localhost:%s/auth/wallet", cfg.Server.Port)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with 5 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}
