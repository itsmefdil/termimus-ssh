package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
)

type AuthMiddleware struct {
	requiredToken string
}

func NewAuth(requiredToken string) *AuthMiddleware {
	return &AuthMiddleware{requiredToken: strings.TrimSpace(requiredToken)}
}

func (a *AuthMiddleware) Wrap(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// If no token is configured on the server, allow all requests
		if a.requiredToken == "" {
			next(w, r)
			return
		}

		// 1. Check Authorization header: Bearer <token>
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if strings.TrimSpace(token) == a.requiredToken {
				next(w, r)
				return
			}
		}

		// 2. Check query parameter: ?token=<token> (needed for WebSockets)
		if qToken := r.URL.Query().Get("token"); qToken != "" {
			if strings.TrimSpace(qToken) == a.requiredToken {
				next(w, r)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: invalid or missing authentication token",
		})
	}
}
