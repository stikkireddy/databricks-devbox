package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type LogEntry struct {
	Timestamp  string `json:"timestamp"`
	Level      string `json:"level"`
	ServerID   string `json:"serverId,omitempty"`
	ServerName string `json:"serverName,omitempty"`
	Source     string `json:"source"` // 'system' | 'server' | 'stdout' | 'stderr'
	Message    string `json:"message"`
}

type LogManager struct {
	mutex   sync.RWMutex
	logs    []LogEntry
	maxLogs int
	clients map[*websocket.Conn]bool
}

func NewLogManager() *LogManager {
	return &LogManager{
		logs:    make([]LogEntry, 0, 10000),
		maxLogs: 10000,
		clients: make(map[*websocket.Conn]bool),
	}
}

func (lm *LogManager) AddLog(entry LogEntry) {
	lm.mutex.Lock()
	defer lm.mutex.Unlock()

	// Add timestamp if not provided
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().Format(time.RFC3339)
	}

	// Add to logs and maintain max size
	lm.logs = append(lm.logs, entry)
	if len(lm.logs) > lm.maxLogs {
		lm.logs = lm.logs[1:] // Remove oldest log
	}

	// Broadcast to all connected WebSocket clients
	lm.broadcastLog(entry)
}

func (lm *LogManager) AddSystemLog(level, message string) {
	lm.AddLog(LogEntry{
		Level:   level,
		Source:  "system",
		Message: message,
	})
}

func (lm *LogManager) AddServerLog(serverID, serverName, level, source, message string) {
	lm.AddLog(LogEntry{
		Level:      level,
		ServerID:   serverID,
		ServerName: serverName,
		Source:     source,
		Message:    message,
	})
}

func (lm *LogManager) GetLogs(serverId string) []LogEntry {
	lm.mutex.RLock()
	defer lm.mutex.RUnlock()

	if serverId == "" {
		// Return all logs
		result := make([]LogEntry, len(lm.logs))
		copy(result, lm.logs)
		return result
	}

	// Filter logs for specific server
	var filtered []LogEntry
	for _, entry := range lm.logs {
		if entry.ServerID == serverId {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

func (lm *LogManager) AddWebSocketClient(conn *websocket.Conn) {
	lm.mutex.Lock()
	defer lm.mutex.Unlock()
	lm.clients[conn] = true
}

func (lm *LogManager) RemoveWebSocketClient(conn *websocket.Conn) {
	lm.mutex.Lock()
	defer lm.mutex.Unlock()
	delete(lm.clients, conn)
	conn.Close()
}

func (lm *LogManager) broadcastLog(entry LogEntry) {
	message := map[string]interface{}{
		"type": "new_log",
		"log":  entry,
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling log message: %v", err)
		return
	}

	// Send to all connected clients
	var disconnectedClients []*websocket.Conn
	for client := range lm.clients {
		err := client.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			disconnectedClients = append(disconnectedClients, client)
		}
	}

	// Remove disconnected clients
	for _, client := range disconnectedClients {
		delete(lm.clients, client)
		client.Close()
	}
}

var logUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin in development
	},
}

func (lm *LogManager) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := logUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Extract server ID from path if provided
	serverId := r.URL.Path[len("/ws/logs"):]
	if serverId != "" && serverId[0] == '/' {
		serverId = serverId[1:] // Remove leading slash
	}

	log.Printf("New WebSocket connection for logs (serverId: %s)", serverId)

	// Add client to manager
	lm.AddWebSocketClient(conn)

	// Send initial logs
	logs := lm.GetLogs(serverId)
	initialMessage := map[string]interface{}{
		"type": "initial_logs",
		"logs": logs,
	}

	data, err := json.Marshal(initialMessage)
	if err != nil {
		log.Printf("Error marshaling initial logs: %v", err)
		lm.RemoveWebSocketClient(conn)
		return
	}

	err = conn.WriteMessage(websocket.TextMessage, data)
	if err != nil {
		log.Printf("Error sending initial logs: %v", err)
		lm.RemoveWebSocketClient(conn)
		return
	}

	// Keep connection alive and handle disconnection
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}
	}

	lm.RemoveWebSocketClient(conn)
}

// Enhanced ProcessOutputCapture that integrates with LogManager
type EnhancedProcessOutputCapture struct {
	logger     *ProcessLogger
	logManager *LogManager
	serverID   string
	serverName string
}

func NewEnhancedProcessOutputCapture(logger *ProcessLogger, logManager *LogManager, serverID, serverName string) *EnhancedProcessOutputCapture {
	return &EnhancedProcessOutputCapture{
		logger:     logger,
		logManager: logManager,
		serverID:   serverID,
		serverName: serverName,
	}
}

func (poc *EnhancedProcessOutputCapture) CaptureOutput(stdout, stderr io.Reader) {
	// Start goroutines to capture both stdout and stderr
	go func() {
		if stdout != nil {
			poc.captureStream(stdout, "stdout")
		}
	}()

	go func() {
		if stderr != nil {
			poc.captureStream(stderr, "stderr")
		}
	}()
}

func (poc *EnhancedProcessOutputCapture) captureStream(stream io.Reader, streamType string) {
	scanner := bufio.NewScanner(stream)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" {
			// Original logging to files
			poc.logger.LogProcessOutput(poc.serverID, poc.serverName, line, streamType == "stderr")

			// Also log to LogManager for real-time WebSocket streaming
			level := "INFO"
			if streamType == "stderr" {
				level = "WARN"
			}

			poc.logManager.AddServerLog(poc.serverID, poc.serverName, level, streamType, line)
		}
	}

	if err := scanner.Err(); err != nil {
		errorMsg := fmt.Sprintf("Error reading %s stream: %v", streamType, err)
		poc.logger.LogProcessOutput(poc.serverID, poc.serverName, errorMsg, true)
		poc.logManager.AddServerLog(poc.serverID, poc.serverName, "ERROR", streamType, errorMsg)
	}
}
