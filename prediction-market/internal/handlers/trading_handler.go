package handlers

import (
	"net/http"
	"strconv"

	"prediction-market/internal/models"
	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TradingHandler struct {
	db                   *gorm.DB
	orderMatchingService *services.OrderMatchingService
	orderBookService     *services.OrderBookService
	resolutionService    *services.MarketResolutionService
}

func NewTradingHandler(db *gorm.DB) *TradingHandler {
	return &TradingHandler{
		db:                   db,
		orderMatchingService: services.NewOrderMatchingService(db),
		orderBookService:     services.NewOrderBookService(db),
		resolutionService:    services.NewMarketResolutionService(db),
	}
}

// PlaceOrder places a new buy/sell order
func (h *TradingHandler) PlaceOrder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		MarketID      uint   `json:"market_id" binding:"required"`
		MarketEventID uint   `json:"market_event_id" binding:"required"`
		OrderType     string `json:"order_type" binding:"required"` // BUY or SELL
		Quantity      string `json:"quantity" binding:"required"`
		Price         string `json:"price" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quantity, err := decimal.NewFromString(req.Quantity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quantity"})
		return
	}

	price, err := decimal.NewFromString(req.Price)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid price"})
		return
	}

	order, err := h.orderMatchingService.PlaceOrder(
		userID.(uint), req.MarketID, req.MarketEventID, req.OrderType, quantity, price,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    order,
	})
}

// GetOrderBook returns the current order book for a market outcome
func (h *TradingHandler) GetOrderBook(c *gin.Context) {
	marketID, _ := strconv.ParseUint(c.Param("market_id"), 10, 32)
	eventID, _ := strconv.ParseUint(c.Param("event_id"), 10, 32)

	orderBook, err := h.orderBookService.GetOrderBook(uint(marketID), uint(eventID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch order book"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    orderBook,
	})
}

// GetUserOrders returns all orders for a user
func (h *TradingHandler) GetUserOrders(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var orders []models.Order
	if err := h.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    orders,
		"count":   len(orders),
	})
}

// CancelOrder cancels an open order
func (h *TradingHandler) CancelOrder(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	orderID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	if err := h.orderMatchingService.CancelOrder(uint(orderID), userID.(uint)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Order cancelled",
	})
}

// GetUserPortfolio returns user's portfolio for a market
func (h *TradingHandler) GetUserPortfolio(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	marketID, _ := strconv.ParseUint(c.Param("market_id"), 10, 32)

	positions, err := h.resolutionService.GetUserPortfolio(userID.(uint), uint(marketID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch portfolio"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    positions,
	})
}

// GetUserPnL returns user's PnL for a market
func (h *TradingHandler) GetUserPnL(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	marketID, _ := strconv.ParseUint(c.Param("market_id"), 10, 32)

	pnl, err := h.resolutionService.GetUserMarketPnL(userID.(uint), uint(marketID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate PnL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"pnl": pnl,
		},
	})
}

// ResolveMarket resolves a market (admin only)
func (h *TradingHandler) ResolveMarket(c *gin.Context) {
	marketID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var req struct {
		WinningEventID uint `json:"winning_event_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.resolutionService.ResolveMarket(uint(marketID), req.WinningEventID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Market resolved and payouts distributed",
	})
}
