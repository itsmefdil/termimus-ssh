package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port      string
	DBPath    string
	DataDir   string
	AuthToken string
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	dataDir := getEnv("DATA_DIR", "./data")
	dbPath := getEnv("DB_PATH", filepath.Join(dataDir, "sync.db"))
	authToken := getEnv("TERMIMUS_AUTH_TOKEN", "")

	return &Config{
		Port:      port,
		DataDir:   dataDir,
		DBPath:    dbPath,
		AuthToken: authToken,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
