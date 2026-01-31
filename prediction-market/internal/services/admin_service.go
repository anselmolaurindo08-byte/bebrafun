package services

import (
	"fmt"
	"log"
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

	// Use AMMTrades for trade count
	s.db.Model(&models.AMMTrade{}).Where("DATE(created_at) = ?", date.Format("2006-01-02")).Count(&totalTrades)

	// Sum AMMTrade volumes?
	// AMMTrade stores input/output as int64 (lamports/tokens).
	// We'll skip precise volume calc for now or do a simple sum if possible.
	// row := s.db.Table("amm_trades").Where("DATE(created_at) = ?", date.Format("2006-01-02")).
	// 	Select("COALESCE(SUM(input_amount), 0)").Row()
	// row.Scan(&totalVolume)
	// For now set to Zero as type mismatch is possible
	totalVolume = decimal.Zero

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
