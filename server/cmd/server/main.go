package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/termimus/termimus-server/internal/config"
	"github.com/termimus/termimus-server/internal/db"
	"github.com/termimus/termimus-server/internal/handlers"
	"github.com/termimus/termimus-server/internal/hub"
	"github.com/termimus/termimus-server/internal/middleware"
)

func main() {
	log.Println("─────────────────────────────────────────────────────────────")
	log.Println("  Termimus Sync Server (Zero-Knowledge Self-Hosted Relay)   ")
	log.Println("─────────────────────────────────────────────────────────────")

	cfg := config.Load()

	// 1. Initialize SQLite Database
	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("Fatal: Failed to open SQLite database: %v", err)
	}
	defer database.Close()
	log.Printf("[DB] Connected to SQLite database at: %s", cfg.DBPath)

	// 2. Initialize WebSocket Hub
	eventHub := hub.New()

	// 3. Initialize Handlers & Auth
	h := handlers.New(cfg, database, eventHub)
	auth := middleware.NewAuth(cfg.AuthToken)

	if cfg.AuthToken == "" {
		log.Println("[Security Warning] TERMIMUS_AUTH_TOKEN is not set! Running in OPEN mode.")
	} else {
		log.Println("[Security] Bearer token authentication is enabled.")
	}

	// 4. Setup Routes
	mux := http.NewServeMux()

	// Public health check
	mux.HandleFunc("/health", h.Health)

	// Sync API endpoints (Protected)
	mux.HandleFunc("/api/v1/sync/status", auth.Wrap(h.SyncStatus))
	mux.HandleFunc("/api/v1/sync/bundle", auth.Wrap(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.GetBundle(w, r)
		case http.MethodPost:
			h.PostBundle(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))
	mux.HandleFunc("/api/v1/sync/devices", auth.Wrap(h.GetDevices))
	mux.HandleFunc("/api/v1/sync/ws", auth.Wrap(h.WebSocket))

	// Apply CORS
	handler := middleware.CORS(mux)

	// 5. Start HTTP Server with Graceful Shutdown
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[HTTP] Termimus Sync Server listening on http://0.0.0.0%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fatal: HTTP server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("[Shutdown] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[Shutdown] Server forced to shutdown: %v", err)
	}
	log.Println("[Shutdown] Termimus Sync Server exited cleanly.")
}
