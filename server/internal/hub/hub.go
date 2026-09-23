package hub

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type EventMessage struct {
	Type       string `json:"type"` // "SYNC_UPDATED"
	Version    int64  `json:"version"`
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name"`
}

type Hub struct {
	clients map[*websocket.Conn]bool
	mu      sync.RWMutex
}

func New() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	log.Printf("[Hub] Client connected: %s (total clients: %d)", conn.RemoteAddr(), len(h.clients))
}

func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		conn.Close()
		log.Printf("[Hub] Client disconnected: %s (remaining: %d)", conn.RemoteAddr(), len(h.clients))
	}
}

func (h *Hub) Broadcast(msg EventMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[Hub] Failed to marshal broadcast event: %v", err)
		return
	}

	for conn := range h.clients {
		err := conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Printf("[Hub] Failed to send message to %s: %v", conn.RemoteAddr(), err)
			conn.Close()
			delete(h.clients, conn)
		}
	}
}
