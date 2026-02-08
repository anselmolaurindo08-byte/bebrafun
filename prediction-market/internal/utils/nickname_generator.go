package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

var adjectives = []string{
	"Swift", "Brave", "Clever", "Bold", "Mighty",
	"Silent", "Wild", "Golden", "Iron", "Silver",
	"Dark", "Bright", "Storm", "Shadow", "Fire",
	"Ice", "Thunder", "Wind", "Steel", "Diamond",
}

var nouns = []string{
	"Falcon", "Tiger", "Dragon", "Wolf", "Eagle",
	"Bear", "Lion", "Hawk", "Phoenix", "Panther",
	"Fox", "Raven", "Viper", "Shark", "Lynx",
	"Cobra", "Stallion", "Jaguar", "Orca", "Leopard",
}

// GenerateNickname creates a random nickname in the format "Adjective_Noun_XXXX"
// where XXXX is a random 4-digit number
func GenerateNickname() (string, error) {
	// Pick random adjective
	adjIdx, err := rand.Int(rand.Reader, big.NewInt(int64(len(adjectives))))
	if err != nil {
		return "", fmt.Errorf("failed to generate random adjective: %w", err)
	}

	// Pick random noun
	nounIdx, err := rand.Int(rand.Reader, big.NewInt(int64(len(nouns))))
	if err != nil {
		return "", fmt.Errorf("failed to generate random noun: %w", err)
	}

	// Generate random 4-digit suffix
	suffix, err := rand.Int(rand.Reader, big.NewInt(10000))
	if err != nil {
		return "", fmt.Errorf("failed to generate random suffix: %w", err)
	}

	nickname := fmt.Sprintf("%s_%s_%04d",
		adjectives[adjIdx.Int64()],
		nouns[nounIdx.Int64()],
		suffix.Int64(),
	)

	return nickname, nil
}
