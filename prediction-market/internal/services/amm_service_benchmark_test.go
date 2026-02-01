package services

import (
	"context"
	"fmt"
	"testing"

	"prediction-market/internal/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func BenchmarkGetPool(b *testing.B) {
	// Setup in-memory DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Discard,
	})
	if err != nil {
		b.Fatalf("failed to connect database: %v", err)
	}

	// Migrate schema (using manual table creation or modified struct to avoid Postgres-specific functions in SQLite)
	// SQLite doesn't support gen_random_uuid(), so we define a compatible struct for migration
	type TestAMMPool struct {
		models.AMMPool
		ID uuid.UUID `gorm:"type:uuid;primaryKey"`
	}

	if err := db.Table("amm_pools").AutoMigrate(&TestAMMPool{}); err != nil {
		b.Fatalf("failed to migrate database: %v", err)
	}

	// Seed a pool
	poolID := uuid.New()
	pool := models.AMMPool{
		ID:         poolID,
		ProgramID:  fmt.Sprintf("program-%s", poolID),
		Authority:  "auth-1",
		YesMint:    "yes-1",
		NoMint:     "no-1",
		YesReserve: 1000,
		NoReserve:  1000,
		Status:     models.PoolStatusActive,
	}
	if err := db.Create(&pool).Error; err != nil {
		b.Fatalf("failed to seed pool: %v", err)
	}

	// Create service with nil SolanaClient (to benchmark logic/DB overhead)
	service := NewAMMService(db, nil)
	ctx := context.Background()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := service.GetPool(ctx, poolID)
			if err != nil {
				b.Errorf("GetPool failed: %v", err)
			}
		}
	})
}
