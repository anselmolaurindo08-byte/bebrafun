package services

import (
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/models"
)

type AdminService struct {
	db *gorm.DB
	mu sync.Mutex
}

func NewAdminService(db *gorm.DB) *AdminService {
	return &AdminService{
		db: db,
	}
}

// IsAdmin checks if a user is an admin
func (s *AdminService) IsAdmin(userID uint) bool {
	var admin models.AdminUser
	result := s.db.Where("user_id = ?", userID).First(&admin)
	return result.Error == nil
}

// GetAdminByUserID gets admin by user ID
func (s *AdminService) GetAdminByUserID(userID uint) (*models.AdminUser, error) {
	var admin models.AdminUser
	if err := s.db.Where("user_id = ?", userID).First(&admin).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

// PromoteUserToAdmin promotes a user to admin
func (s *AdminService) PromoteUserToAdmin(userID uint, role string, promotedByAdminID uint) (*models.AdminUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if user exists
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Check if already admin
	var existing models.AdminUser
	if err := s.db.Where("user_id = ?", userID).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("user is already an admin")
	}

	permissions := models.JSONB{
		"manage_users":    true,
		"manage_markets":  true,
		"manage_contests": role == "SUPER_ADMIN",
		"view_analytics":  true,
	}

	adminUser := models.AdminUser{
		UserID:      userID,
		Role:        role,
		Permissions: permissions,
	}

	if err := s.db.Create(&adminUser).Error; err != nil {
		return nil, fmt.Errorf("failed to promote user: %w", err)
	}

	s.LogAdminAction(promotedByAdminID, "PROMOTE_USER", "USER", &userID, map[string]interface{}{
		"role": role,
	})

	log.Printf("User %d promoted to %s", userID, role)
	return &adminUser, nil
}

// DemoteAdmin removes admin privileges
func (s *AdminService) DemoteAdmin(adminUserID uint, demotedByAdminID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.db.Delete(&models.AdminUser{}, adminUserID).Error; err != nil {
		return fmt.Errorf("failed to demote admin: %w", err)
	}

	s.LogAdminAction(demotedByAdminID, "DEMOTE_ADMIN", "ADMIN_USER", &adminUserID, nil)
	return nil
}

// CreateContest creates a new contest
func (s *AdminService) CreateContest(adminID uint, name string, description string,
	startDate time.Time, endDate time.Time, prizePool decimal.Decimal, rules string) (*models.Contest, error) {

	s.mu.Lock()
	defer s.mu.Unlock()

	if endDate.Before(startDate) {
		return nil, fmt.Errorf("end date must be after start date")
	}

	contest := models.Contest{
		Name:        name,
		Description: description,
		StartDate:   startDate,
		EndDate:     endDate,
		PrizePool:   prizePool,
		Status:      "PENDING",
		Rules:       rules,
		CreatedBy:   adminID,
	}

	if err := s.db.Create(&contest).Error; err != nil {
		return nil, fmt.Errorf("failed to create contest: %w", err)
	}

	s.LogAdminAction(adminID, "CREATE_CONTEST", "CONTEST", &contest.ID, map[string]interface{}{
		"name":       name,
		"prize_pool": prizePool.String(),
	})

	log.Printf("Contest created: %s (ID: %d)", name, contest.ID)
	return &contest, nil
}

// GetContests returns all contests
func (s *AdminService) GetContests() ([]models.Contest, error) {
	var contests []models.Contest
	if err := s.db.Order("created_at DESC").Find(&contests).Error; err != nil {
		return nil, err
	}
	return contests, nil
}

// GetContest returns a contest by ID
func (s *AdminService) GetContest(contestID uint) (*models.Contest, error) {
	var contest models.Contest
	if err := s.db.First(&contest, contestID).Error; err != nil {
		return nil, err
	}
	return &contest, nil
}

// StartContest starts a contest
func (s *AdminService) StartContest(contestID uint, adminID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var contest models.Contest
	if err := s.db.First(&contest, contestID).Error; err != nil {
		return fmt.Errorf("contest not found: %w", err)
	}

	if contest.Status != "PENDING" {
		return fmt.Errorf("contest is not in PENDING status")
	}

	if err := s.db.Model(&contest).Update("status", "ACTIVE").Error; err != nil {
		return err
	}

	s.LogAdminAction(adminID, "START_CONTEST", "CONTEST", &contestID, nil)
	log.Printf("Contest %d started", contestID)
	return nil
}

// EndContest ends a contest and calculates rankings
func (s *AdminService) EndContest(contestID uint, adminID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var contest models.Contest
	if err := s.db.First(&contest, contestID).Error; err != nil {
		return fmt.Errorf("contest not found: %w", err)
	}

	if contest.Status != "ACTIVE" {
		return fmt.Errorf("contest is not active")
	}

	// Update contest status to ENDED first
	if err := s.db.Model(&contest).Update("status", "ENDED").Error; err != nil {
		return err
	}

	// Get all participants and update their final PnL
	var participants []models.ContestParticipant
	if err := s.db.Where("contest_id = ?", contestID).Find(&participants).Error; err != nil {
		return err
	}

	// Update each participant's final PnL
	for i := range participants {
		currentPnL := s.calculateUserPnL(participants[i].UserID)
		contestPnL := currentPnL.Sub(participants[i].EntryPnL)
		participants[i].FinalPnL = contestPnL
		s.db.Model(&participants[i]).Update("final_pnl", contestPnL)
	}

	// Sort by FinalPnL descending
	sort.Slice(participants, func(i, j int) bool {
		return participants[i].FinalPnL.GreaterThan(participants[j].FinalPnL)
	})

	// Prize distribution: top 3 get 50%, 30%, 20%
	prizeDistribution := []decimal.Decimal{
		contest.PrizePool.Mul(decimal.NewFromFloat(0.5)),
		contest.PrizePool.Mul(decimal.NewFromFloat(0.3)),
		contest.PrizePool.Mul(decimal.NewFromFloat(0.2)),
	}

	for i, participant := range participants {
		rank := i + 1
		var prizeAmount decimal.Decimal

		if i < len(prizeDistribution) {
			prizeAmount = prizeDistribution[i]
		}

		// Update participant with rank and prize
		if err := s.db.Model(&participant).Updates(map[string]interface{}{
			"rank":         rank,
			"prize_amount": prizeAmount,
		}).Error; err != nil {
			log.Printf("Error updating participant rank: %v", err)
			continue
		}

		// Add prize to user balance
		if prizeAmount.GreaterThan(decimal.Zero) {
			if err := s.db.Model(&models.User{}).Where("id = ?", participant.UserID).
				Update("virtual_balance", gorm.Expr("virtual_balance + ?", prizeAmount)).Error; err != nil {
				log.Printf("Error updating user balance: %v", err)
			}

			// Create transaction record
			prizeFloat, _ := prizeAmount.Float64()
			transaction := models.Transaction{
				UserID:      participant.UserID,
				Amount:      prizeFloat,
				Type:        "contest_prize",
				Description: fmt.Sprintf("Contest prize: %s (Rank #%d)", contest.Name, rank),
			}
			s.db.Create(&transaction)
		}
	}

	// Update contest status to DISTRIBUTED
	if err := s.db.Model(&contest).Update("status", "DISTRIBUTED").Error; err != nil {
		return err
	}

	s.LogAdminAction(adminID, "END_CONTEST", "CONTEST", &contestID, map[string]interface{}{
		"participants_count": len(participants),
	})

	log.Printf("Contest %d ended and prizes distributed", contestID)
	return nil
}

// calculateUserPnL calculates a user's total PnL
func (s *AdminService) calculateUserPnL(userID uint) decimal.Decimal {
	var totalPnL decimal.Decimal

	// Sum all transactions that affect PnL
	s.db.Table("transactions").
		Where("user_id = ? AND transaction_type IN ('TRADE_PROFIT', 'TRADE_LOSS', 'CONTEST_PRIZE')", userID).
		Select("COALESCE(SUM(amount), 0)").
		Row().Scan(&totalPnL)

	return totalPnL
}

// JoinContest adds a user to a contest
func (s *AdminService) JoinContest(contestID uint, userID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if contest is active
	var contest models.Contest
	if err := s.db.First(&contest, contestID).Error; err != nil {
		return fmt.Errorf("contest not found: %w", err)
	}

	if contest.Status != "ACTIVE" {
		return fmt.Errorf("contest is not active")
	}

	// Check if already joined
	var existing models.ContestParticipant
	if err := s.db.Where("contest_id = ? AND user_id = ?", contestID, userID).First(&existing).Error; err == nil {
		return fmt.Errorf("user already joined this contest")
	}

	// Get user's current PnL
	entryPnL := s.calculateUserPnL(userID)

	participant := models.ContestParticipant{
		ContestID: contestID,
		UserID:    userID,
		EntryPnL:  entryPnL,
		FinalPnL:  decimal.Zero,
	}

	return s.db.Create(&participant).Error
}

// GetContestLeaderboard returns contest leaderboard
func (s *AdminService) GetContestLeaderboard(contestID uint) ([]models.ContestParticipant, error) {
	var participants []models.ContestParticipant
	if err := s.db.Where("contest_id = ?", contestID).
		Preload("User").
		Order("final_pnl DESC").Find(&participants).Error; err != nil {
		return nil, err
	}

	// Update current PnL for active contests
	var contest models.Contest
	if err := s.db.First(&contest, contestID).Error; err == nil && contest.Status == "ACTIVE" {
		for i := range participants {
			currentPnL := s.calculateUserPnL(participants[i].UserID)
			participants[i].FinalPnL = currentPnL.Sub(participants[i].EntryPnL)
		}
		// Re-sort
		sort.Slice(participants, func(i, j int) bool {
			return participants[i].FinalPnL.GreaterThan(participants[j].FinalPnL)
		})
	}

	return participants, nil
}

// GetActiveContests returns active contests for users
func (s *AdminService) GetActiveContests() ([]models.Contest, error) {
	var contests []models.Contest
	if err := s.db.Where("status = ?", "ACTIVE").Order("end_date ASC").Find(&contests).Error; err != nil {
		return nil, err
	}
	return contests, nil
}

// RestrictUser restricts a user (ban, suspend, etc.)
func (s *AdminService) RestrictUser(userID uint, restrictionType string, reason string,
	durationDays *int, adminID uint) (*models.UserRestriction, error) {

	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if user exists
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	var expiresAt *time.Time
	if durationDays != nil {
		expTime := time.Now().AddDate(0, 0, *durationDays)
		expiresAt = &expTime
	}

	restriction := models.UserRestriction{
		UserID:          userID,
		RestrictionType: restrictionType,
		Reason:          reason,
		DurationDays:    durationDays,
		CreatedBy:       adminID,
		ExpiresAt:       expiresAt,
		IsActive:        true,
	}

	if err := s.db.Create(&restriction).Error; err != nil {
		return nil, err
	}

	s.LogAdminAction(adminID, "RESTRICT_USER", "USER", &userID, map[string]interface{}{
		"restriction_type": restrictionType,
		"reason":           reason,
		"duration_days":    durationDays,
	})

	log.Printf("User %d restricted: %s", userID, restrictionType)
	return &restriction, nil
}

// RemoveRestriction removes a user restriction
func (s *AdminService) RemoveRestriction(restrictionID uint, adminID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.db.Model(&models.UserRestriction{}).Where("id = ?", restrictionID).
		Update("is_active", false).Error; err != nil {
		return err
	}

	s.LogAdminAction(adminID, "REMOVE_RESTRICTION", "USER_RESTRICTION", &restrictionID, nil)
	return nil
}

// GetUserRestrictions returns active restrictions for a user
func (s *AdminService) GetUserRestrictions(userID uint) ([]models.UserRestriction, error) {
	var restrictions []models.UserRestriction
	if err := s.db.Where("user_id = ? AND is_active = ?", userID, true).Find(&restrictions).Error; err != nil {
		return nil, err
	}
	return restrictions, nil
}

// IsUserRestricted checks if a user has a specific restriction
func (s *AdminService) IsUserRestricted(userID uint, restrictionType string) bool {
	var restriction models.UserRestriction
	now := time.Now()

	result := s.db.Where("user_id = ? AND restriction_type = ? AND is_active = ? AND (expires_at IS NULL OR expires_at > ?)",
		userID, restrictionType, true, now).First(&restriction)

	return result.Error == nil
}

// LogAdminAction logs an admin action
func (s *AdminService) LogAdminAction(adminID uint, action string, resourceType string,
	resourceID *uint, details map[string]interface{}) error {

	adminLog := models.AdminLog{
		AdminID:      adminID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      models.JSONB(details),
	}

	return s.db.Create(&adminLog).Error
}

// GetAdminLogs returns admin activity logs
func (s *AdminService) GetAdminLogs(limit int, offset int) ([]models.AdminLog, error) {
	var logs []models.AdminLog
	if err := s.db.Preload("Admin").Preload("Admin.User").
		Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// GetPlatformStats returns platform statistics for a date
func (s *AdminService) GetPlatformStats(date time.Time) (*models.PlatformStats, error) {
	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)

	var stats models.PlatformStats
	result := s.db.Where("DATE(date) = ?", dateOnly.Format("2006-01-02")).First(&stats)

	if result.Error == gorm.ErrRecordNotFound {
		// Calculate and create stats
		stats = s.calculatePlatformStats(dateOnly)
		if err := s.db.Create(&stats).Error; err != nil {
			return nil, err
		}
		return &stats, nil
	}

	return &stats, result.Error
}

// calculatePlatformStats calculates platform statistics
func (s *AdminService) calculatePlatformStats(date time.Time) models.PlatformStats {
	var totalUsers int64
	var activeUsers int64
	var totalTrades int64
	var totalVolume decimal.Decimal
	var totalMarkets int64
	var activeMarkets int64

	s.db.Model(&models.User{}).Count(&totalUsers)
	s.db.Model(&models.User{}).Where("updated_at >= ?", date).Count(&activeUsers)
	s.db.Model(&models.Trade{}).Where("DATE(created_at) = ?", date.Format("2006-01-02")).Count(&totalTrades)

	row := s.db.Table("trades").Where("DATE(created_at) = ?", date.Format("2006-01-02")).
		Select("COALESCE(SUM(total_amount), 0)").Row()
	row.Scan(&totalVolume)

	s.db.Model(&models.Market{}).Count(&totalMarkets)
	s.db.Model(&models.Market{}).Where("status = ?", "active").Count(&activeMarkets)

	return models.PlatformStats{
		Date:          date,
		TotalUsers:    int(totalUsers),
		ActiveUsers:   int(activeUsers),
		TotalTrades:   int(totalTrades),
		TotalVolume:   totalVolume,
		TotalMarkets:  int(totalMarkets),
		ActiveMarkets: int(activeMarkets),
	}
}

// GetAllUsers returns all users with optional filtering
func (s *AdminService) GetAllUsers(limit int, offset int, search string) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	query := s.db.Model(&models.User{})
	if search != "" {
		query = query.Where("x_username ILIKE ?", "%"+search+"%")
	}

	query.Count(&total)
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// UpdateUserBalance updates a user's balance (admin action)
func (s *AdminService) UpdateUserBalance(userID uint, amount decimal.Decimal, reason string, adminID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.db.Model(&models.User{}).Where("id = ?", userID).
		Update("virtual_balance", gorm.Expr("virtual_balance + ?", amount)).Error; err != nil {
		return err
	}

	// Create transaction record
	txType := "admin_credit"
	if amount.LessThan(decimal.Zero) {
		txType = "admin_debit"
	}

	amountFloat, _ := amount.Float64()
	transaction := models.Transaction{
		UserID:      userID,
		Amount:      amountFloat,
		Type:        txType,
		Description: reason,
	}
	s.db.Create(&transaction)

	s.LogAdminAction(adminID, "UPDATE_BALANCE", "USER", &userID, map[string]interface{}{
		"amount": amount.String(),
		"reason": reason,
	})

	return nil
}
