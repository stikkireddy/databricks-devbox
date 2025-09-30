package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/shirou/gopsutil/v3/process"
)

type ServerStatus string

const (
	StatusRunning ServerStatus = "running"
	StatusStopped ServerStatus = "stopped"
	StatusFailed  ServerStatus = "failed"
)

type ExtensionInstallStatus string

const (
	ExtensionPending    ExtensionInstallStatus = "pending"
	ExtensionInstalling ExtensionInstallStatus = "installing"
	ExtensionCompleted  ExtensionInstallStatus = "completed"
	ExtensionFailed     ExtensionInstallStatus = "failed"
)

type ExtensionProgress struct {
	Name   string                 `json:"name"`
	Status ExtensionInstallStatus `json:"status"`
	Error  string                 `json:"error,omitempty"`
}

type ExtensionInstallationProgress struct {
	ServerID         string              `json:"server_id"`
	Total            int                 `json:"total"`
	Completed        int                 `json:"completed"`
	Failed           int                 `json:"failed"`
	CurrentExtension string              `json:"current_extension"`
	Extensions       []ExtensionProgress `json:"extensions"`
	IsComplete       bool                `json:"is_complete"`
}

type ServerInstance struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Port          int          `json:"port"`
	WorkspacePath string       `json:"workspace_path"`
	Extensions    []string     `json:"extensions"`
	Status        ServerStatus `json:"status"`
	PID           *int         `json:"pid,omitempty"`
	StartTime     *time.Time   `json:"start_time,omitempty"`
	Command       []string     `json:"command,omitempty"`
	Uptime        *float64     `json:"uptime,omitempty"`      // Uptime in seconds
	CPUPercent    *float64     `json:"cpu_percent,omitempty"` // CPU usage percentage
	MemoryMB      *float64     `json:"memory_mb,omitempty"`   // Memory usage in MB
	LastUpdate    *time.Time   `json:"last_update,omitempty"` // Last metrics update time
}

type ProcessManager struct {
	servers                map[string]*ServerInstance
	mutex                  sync.RWMutex
	portMap                map[int]string // port -> server_id mapping
	nextPort               int
	logger                 *ProcessLogger
	logManager             *LogManager
	dataDir                string
	serversFile            string
	extensionProgress      map[string]*ExtensionInstallationProgress // server_id -> progress
	extensionProgressMutex sync.RWMutex
}

func NewProcessManager() *ProcessManager {
	dataDir := "data"
	os.MkdirAll(dataDir, 0755)

	pm := &ProcessManager{
		servers:           make(map[string]*ServerInstance),
		portMap:           make(map[int]string),
		nextPort:          8500, // Start from 8500 like Python version
		logger:            NewProcessLogger(),
		dataDir:           dataDir,
		serversFile:       filepath.Join(dataDir, "servers.json"),
		extensionProgress: make(map[string]*ExtensionInstallationProgress),
	}

	// Load existing servers from file
	pm.loadServers()

	// Start single health monitoring routine for all servers
	go pm.startHealthMonitor()

	// Start separate state refresh routine
	go pm.startStateRefreshRoutine()

	return pm
}

func (pm *ProcessManager) SetLogManager(lm *LogManager) {
	pm.logManager = lm
	// Add initial system log
	lm.AddSystemLog("INFO", "Process Manager initialized")
}

func (pm *ProcessManager) getNextAvailablePort() int {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	for {
		if _, exists := pm.portMap[pm.nextPort]; !exists {
			pm.portMap[pm.nextPort] = "" // Reserve the port
			port := pm.nextPort
			pm.nextPort++
			return port
		}
		pm.nextPort++
	}
}

func (pm *ProcessManager) CreateServer(name, workspacePath string, extensions []string, zipFilePath, githubURL string) (*ServerInstance, error) {
	// Generate unique ID and port (don't lock here since getNextAvailablePort locks internally)
	id := uuid.New().String()
	port := pm.getNextAvailablePort()

	// Create workspace directory if it doesn't exist (like Python version)
	if workspacePath == "" || workspacePath == "." {
		workspacePath = filepath.Join("workspace", id)
	}

	// Convert to absolute path to avoid VS Code creating nested directories
	absWorkspacePath, err := filepath.Abs(workspacePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute workspace path: %v", err)
	}
	workspacePath = absWorkspacePath

	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create workspace directory: %v", err)
	}

	// Initialize workspace from zip file or GitHub repository
	if zipFilePath != "" {
		log.Printf("Initializing workspace from zip file: %s", zipFilePath)
		if err := pm.extractZipFile(zipFilePath, workspacePath); err != nil {
			return nil, fmt.Errorf("failed to initialize workspace from zip file: %v", err)
		}
		log.Printf("Workspace successfully initialized from zip file")
	} else if githubURL != "" {
		log.Printf("Initializing workspace from GitHub repository: %s", githubURL)
		if err := pm.cloneGithubRepo(githubURL, workspacePath); err != nil {
			return nil, fmt.Errorf("failed to clone GitHub repository: %v", err)
		}
		log.Printf("Workspace successfully initialized from GitHub repository")
	}

	// Create server data directory for extensions and Code-Server settings (like Python version)
	serverDataDir := filepath.Join(pm.dataDir, id)
	if err := os.MkdirAll(serverDataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create server data directory: %v", err)
	}
	log.Printf("Created server data directory: %s", serverDataDir)

	server := &ServerInstance{
		ID:            id,
		Name:          name,
		Port:          port,
		WorkspacePath: workspacePath,
		Extensions:    extensions,
		Status:        StatusStopped, // ONLY creates metadata, doesn't start process
		StartTime:     nil,
		PID:           nil,
	}

	// Lock only for the actual storage operations
	pm.mutex.Lock()
	pm.servers[id] = server
	pm.portMap[port] = id
	pm.saveServers() // Save to disk like Python version
	pm.mutex.Unlock()

	// Log creation
	pm.logger.LogProcessEvent(id, name, "CREATED", fmt.Sprintf("Server created on port %d", port))
	if pm.logManager != nil {
		pm.logManager.AddSystemLog("INFO", fmt.Sprintf("Server %s created on port %d", name, port))
		pm.logManager.AddServerLog(id, name, "INFO", "server", fmt.Sprintf("Server created on port %d with workspace %s", port, workspacePath))
	}
	// Install extensions if provided (blocking operation like Python version)
	if len(extensions) > 0 {
		log.Printf("Installing extensions for server %s: %v", id, extensions)

		// Set up environment for extension installation (like Python version)
		env := os.Environ()

		// Get absolute path for XDG_DATA_HOME (same as server startup)
		userDataDir := filepath.Join(pm.dataDir, id) // data/{server_id}
		absDataDir, err := filepath.Abs(userDataDir)
		if err != nil {
			log.Printf("Failed to get absolute data dir path: %v", err)
			absDataDir = userDataDir // Fallback to relative path
		}

		env = append(env,
			// fmt.Sprintf("VSCODE_PROXY_URI=./vscode/%d", port),
			fmt.Sprintf("XDG_DATA_HOME=%s", absDataDir), // data/{server_id}
		)

		// Install extensions synchronously (blocks API call until complete)
		extensionSuccess := pm.installExtensions(env, extensions, id, name)

		if extensionSuccess {
			log.Printf("All extensions installed successfully for server %s", id)
		} else {
			log.Printf("Some extensions failed to install for server %s", id)
			// Continue anyway, don't fail server creation
		}

		// Apply user settings after extension installation
		if err := pm.applyUserSettings(id, extensions); err != nil {
			log.Printf("Failed to apply user settings for server %s: %v", id, err)
			// Continue anyway, don't fail server creation
		}
	}

	log.Printf("Created server %s (%s) on port %d", name, id, port)
	return server, nil
}

func (pm *ProcessManager) StartServer(id string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	server, exists := pm.servers[id]
	if !exists {
		return fmt.Errorf("server not found: %s", id)
	}

	if server.Status == StatusRunning {
		return fmt.Errorf("server is already running")
	}

	// Create user data directory and config directory (like Python version)
	userDataDir := filepath.Join(pm.dataDir, id)
	configDir := filepath.Join(userDataDir, "code-server") // Like Python: data/{server_id}/code-server
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %v", err)
	}

	// Get absolute path for config directory
	absConfigDir, err := filepath.Abs(configDir)
	if err != nil {
		log.Printf("Failed to get absolute config dir path: %v", err)
		absConfigDir = configDir // Fallback to relative path
	}

	// Build code-server command with all stability options
	args := []string{
		"--bind-addr", fmt.Sprintf("0.0.0.0:%d", server.Port),
		"--user-data-dir", absConfigDir, // Use absolute config dir like Python version
		"--auth", "none",
		"--disable-telemetry",
		"--disable-update-check",
		"--disable-file-downloads",
		"--log", "info",
		server.WorkspacePath,
	}

	cmd := exec.Command("code-server", args...)
	cmd.Dir = server.WorkspacePath

	// Set comprehensive environment variables (like Python version)
	env := os.Environ()

	// Get absolute path for XDG_DATA_HOME (parent of config dir)
	absDataDir, err := filepath.Abs(userDataDir) // data/{server_id}
	if err != nil {
		log.Printf("Failed to get absolute data dir path: %v", err)
		absDataDir = userDataDir // Fallback to relative path
	}

	env = append(env,
		// fmt.Sprintf("VSCODE_PROXY_URI=./vscode/%d", server.Port),
		fmt.Sprintf("XDG_DATA_HOME=%s", absDataDir), // Match Python: absolute path to data/{server_id}
		"NODE_OPTIONS=--max-old-space-size=2048",
		"VSCODE_LOGS=info",
		"CODE_SERVER_LOG=info",
		"UV_THREADPOOL_SIZE=128",
		"NODE_TLS_REJECT_UNAUTHORIZED=0",
		"VSCODE_DISABLE_CRASH_REPORTER=true",
		"ELECTRON_NO_ATTACH_CONSOLE=1",
		"DISABLE_TELEMETRY=true",
	)
	cmd.Env = env

	// Log process start
	pm.logger.LogProcessEvent(id, server.Name, "STARTING", fmt.Sprintf("Starting on port %d", server.Port))
	if pm.logManager != nil {
		pm.logManager.AddServerLog(id, server.Name, "INFO", "server", fmt.Sprintf("Starting code-server on port %d", server.Port))
	}

	// Get stdout and stderr pipes for logging
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		server.Status = StatusStopped
		return fmt.Errorf("failed to get stdout pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		server.Status = StatusStopped
		return fmt.Errorf("failed to get stderr pipe: %v", err)
	}

	// Start the process
	if err := cmd.Start(); err != nil {
		server.Status = StatusStopped
		pm.logger.LogProcessEvent(id, server.Name, "START_FAILED", err.Error())
		return fmt.Errorf("failed to start code-server: %v", err)
	}

	// Update server state
	now := time.Now()
	server.PID = &cmd.Process.Pid
	server.StartTime = &now
	server.Status = StatusRunning
	server.Command = append([]string{"code-server"}, args...)

	// Save updated state to file (critical!)
	pm.saveServers()

	// Start output capture with LogManager integration for real-time WebSocket streaming
	outputCapture := NewEnhancedProcessOutputCapture(pm.logger, pm.logManager, id, server.Name)
	go outputCapture.CaptureOutput(stdout, stderr)

	pm.logger.LogProcessEvent(id, server.Name, "STARTED", fmt.Sprintf("Process started with PID %d on port %d", *server.PID, server.Port))
	log.Printf("Started server %s (PID: %d) on port %d", server.Name, *server.PID, server.Port)
	if pm.logManager != nil {
		pm.logManager.AddServerLog(id, server.Name, "INFO", "server", fmt.Sprintf("code-server started with PID %d on port %d", *server.PID, server.Port))
	}

	// Monitor process in background (process lifecycle)
	go pm.monitorProcess(id, cmd)

	return nil
}

func (pm *ProcessManager) StopServer(id string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	server, exists := pm.servers[id]
	if !exists {
		return fmt.Errorf("server not found: %s", id)
	}

	if server.Status != StatusRunning || server.PID == nil {
		return fmt.Errorf("server is not running")
	}

	// Try graceful shutdown first
	if proc, err := os.FindProcess(*server.PID); err == nil {
		if err := proc.Signal(syscall.SIGTERM); err == nil {
			// Wait up to 10 seconds for graceful shutdown
			go func() {
				time.Sleep(10 * time.Second)
				pm.mutex.Lock()
				defer pm.mutex.Unlock()
				// Force kill if process still exists
				if server.PID != nil {
					if p, err := os.FindProcess(*server.PID); err == nil {
						p.Kill()
					}
				}
				server.Status = StatusStopped
				server.PID = nil
				server.StartTime = nil
				pm.saveServers()
			}()
		} else {
			// Force kill immediately if SIGTERM fails
			proc.Kill()
		}
	}

	// Immediately set to stopped
	server.Status = StatusStopped
	server.PID = nil
	server.StartTime = nil

	// Save updated state to file
	pm.saveServers()

	log.Printf("Stopped server %s", server.Name)
	if pm.logManager != nil {
		pm.logManager.AddServerLog(id, server.Name, "INFO", "server", "Server stopped")
	}
	return nil
}

func (pm *ProcessManager) DeleteServer(id string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	server, exists := pm.servers[id]
	if !exists {
		return fmt.Errorf("server not found: %s", id)
	}

	// Log deletion event
	pm.logger.LogProcessEvent(id, server.Name, "DELETING", "Server deletion requested")

	// Stop server if running
	if server.Status == StatusRunning && server.PID != nil {
		if proc, err := os.FindProcess(*server.PID); err == nil {
			proc.Kill()
		}
	}

	// Clean up data directory (includes config subdirectory)
	dataDir := filepath.Join(pm.dataDir, id)
	if _, err := os.Stat(dataDir); err == nil {
		if err := os.RemoveAll(dataDir); err != nil {
			log.Printf("Failed to remove data directory %s: %v", dataDir, err)
		} else {
			log.Printf("Removed data directory: %s", dataDir)
		}
	}

	// Clean up workspace directory
	if _, err := os.Stat(server.WorkspacePath); err == nil {
		if err := os.RemoveAll(server.WorkspacePath); err != nil {
			log.Printf("Failed to remove workspace directory %s: %v", server.WorkspacePath, err)
		} else {
			log.Printf("Removed workspace directory: %s", server.WorkspacePath)
		}
	}

	// Clean up logs directory
	logsDir := filepath.Join("logs", id)
	if _, err := os.Stat(logsDir); err == nil {
		if err := os.RemoveAll(logsDir); err != nil {
			log.Printf("Failed to remove logs directory %s: %v", logsDir, err)
		} else {
			log.Printf("Removed logs directory: %s", logsDir)
		}
	}

	// Clean up port mapping
	delete(pm.portMap, server.Port)
	delete(pm.servers, id)

	// Save updated state to file (critical!)
	pm.saveServers()

	// Final log entry
	pm.logger.LogProcessEvent(id, server.Name, "DELETED", "Server deleted successfully")

	log.Printf("Deleted server %s and cleaned up all directories", server.Name)
	if pm.logManager != nil {
		pm.logManager.AddServerLog(id, server.Name, "INFO", "server", "Server deleted and all directories cleaned up")
	}
	return nil
}

func (pm *ProcessManager) ListServers() []*ServerInstance {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	servers := make([]*ServerInstance, 0, len(pm.servers))
	for _, server := range pm.servers {
		servers = append(servers, server)
	}

	return servers
}

func (pm *ProcessManager) GetServer(id string) (*ServerInstance, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	server, exists := pm.servers[id]
	if !exists {
		return nil, fmt.Errorf("server not found: %s", id)
	}

	return server, nil
}

func (pm *ProcessManager) GetServerByPort(port int) (*ServerInstance, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	serverID, exists := pm.portMap[port]
	if !exists || serverID == "" {
		return nil, fmt.Errorf("no server found on port %d", port)
	}

	server, exists := pm.servers[serverID]
	if !exists {
		return nil, fmt.Errorf("server not found: %s", serverID)
	}

	return server, nil
}

func (pm *ProcessManager) monitorProcess(id string, cmd *exec.Cmd) {
	// Wait for process to finish
	err := cmd.Wait()

	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	server, exists := pm.servers[id]
	if !exists {
		return
	}

	// Get PID before clearing it, in case it was already cleared by stop
	var pidStr string
	if server.PID != nil {
		pidStr = fmt.Sprintf("PID: %d", *server.PID)
	} else {
		pidStr = "PID: unknown"
	}

	if err != nil {
		log.Printf("Server %s (%s) exited with error: %v", server.Name, pidStr, err)
		pm.logger.LogProcessEvent(id, server.Name, "PROCESS_EXITED_ERROR", err.Error())
		if pm.logManager != nil {
			pm.logManager.AddServerLog(id, server.Name, "ERROR", "server", fmt.Sprintf("Server process exited with error: %v", err))
		}
		server.Status = StatusStopped
	} else {
		log.Printf("Server %s (%s) exited normally", server.Name, pidStr)
		pm.logger.LogProcessEvent(id, server.Name, "PROCESS_EXITED", "Process exited normally")
		if pm.logManager != nil {
			pm.logManager.AddServerLog(id, server.Name, "INFO", "server", "Server process exited normally")
		}
		server.Status = StatusStopped
	}

	server.PID = nil
	server.StartTime = nil

	// Save updated state
	pm.saveServers()
}

func (pm *ProcessManager) Cleanup() {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	log.Println("Cleaning up all running servers...")
	for _, server := range pm.servers {
		if server.Status == StatusRunning && server.PID != nil {
			if proc, err := os.FindProcess(*server.PID); err == nil {
				proc.Kill()
			}
		}
	}
}

// Health monitoring functions
func (pm *ProcessManager) GetServerHealth(id string) (map[string]interface{}, error) {
	pm.mutex.RLock()
	server, exists := pm.servers[id]
	if !exists {
		pm.mutex.RUnlock()
		return nil, fmt.Errorf("server not found: %s", id)
	}

	health := map[string]interface{}{
		"status": server.Status,
	}

	// If server is running, get detailed health info
	if server.Status == StatusRunning && server.PID != nil && server.StartTime != nil {
		port := server.Port
		pid := *server.PID
		startTime := *server.StartTime
		pm.mutex.RUnlock()

		// Check HTTP health
		isHealthy := pm.isServerHealthy(port)
		health["http_healthy"] = isHealthy

		// Get process stats
		if proc, err := process.NewProcess(int32(pid)); err == nil {
			if cpuPercent, err := proc.CPUPercent(); err == nil {
				health["cpu_percent"] = cpuPercent
			}

			if memInfo, err := proc.MemoryInfo(); err == nil {
				health["memory_mb"] = float64(memInfo.RSS) / 1024 / 1024
			}

			// Calculate uptime
			health["uptime_seconds"] = time.Since(startTime).Seconds()
		} else {
			// Process doesn't exist anymore
			health["cpu_percent"] = 0
			health["memory_mb"] = 0
			health["uptime_seconds"] = 0
			health["process_exists"] = false
		}
	} else {
		pm.mutex.RUnlock()
		health["cpu_percent"] = 0
		health["memory_mb"] = 0
		health["uptime_seconds"] = 0
	}

	return health, nil
}

// Log related methods
func (pm *ProcessManager) GetServerLogs(id string, lines int) ([]string, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	_, exists := pm.servers[id]
	if !exists {
		return nil, fmt.Errorf("server not found: %s", id)
	}

	return pm.logger.GetRecentLogs(id, lines)
}

// Persistent storage methods (like Python version)
func (pm *ProcessManager) loadServers() {
	// This is the initial load on startup
	pm.loadServersFromFile()

	// Log existing running servers (only on startup)
	for _, server := range pm.servers {
		if server.Status == StatusRunning && server.PID != nil {
			log.Printf("Found existing running server %s (PID: %d)", server.Name, *server.PID)
		}
	}
}

func (pm *ProcessManager) loadServersFromFile() {
	// This reloads from file without starting monitoring (used for refreshing state)
	data, err := os.ReadFile(pm.serversFile)
	if err != nil {
		log.Printf("Error reading servers file: %v", err)
		return
	}

	var servers map[string]*ServerInstance
	if err := json.Unmarshal(data, &servers); err != nil {
		log.Printf("Error parsing servers file: %v", err)
		return
	}

	// Clear existing state and rebuild from file
	pm.servers = servers
	pm.portMap = make(map[int]string)

	// Rebuild port map
	for id, server := range servers {
		pm.portMap[server.Port] = id
		if server.Port >= pm.nextPort {
			pm.nextPort = server.Port + 1
		}
	}
}

func (pm *ProcessManager) saveServers() {
	data, err := json.MarshalIndent(pm.servers, "", "  ")
	if err != nil {
		log.Printf("Error marshaling servers: %v", err)
		return
	}

	if err := os.WriteFile(pm.serversFile, data, 0644); err != nil {
		log.Printf("Error saving servers file: %v", err)
		return
	}
}

// Workspace initialization helper methods
func (pm *ProcessManager) extractZipFile(zipPath, targetPath string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		// Sanitize file path to prevent directory traversal
		if strings.Contains(file.Name, "..") {
			continue
		}

		filePath := filepath.Join(targetPath, file.Name)

		if file.FileInfo().IsDir() {
			os.MkdirAll(filePath, file.FileInfo().Mode())
			continue
		}

		// Create parent directories
		if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
			return err
		}

		// Extract file
		fileReader, err := file.Open()
		if err != nil {
			return err
		}
		defer fileReader.Close()

		targetFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.FileInfo().Mode())
		if err != nil {
			return err
		}
		defer targetFile.Close()

		if _, err := io.Copy(targetFile, fileReader); err != nil {
			return err
		}
	}

	return nil
}

func (pm *ProcessManager) cloneGithubRepo(repoURL, targetPath string) error {
	cmd := exec.Command("git", "clone", repoURL, targetPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to clone repository: %v", err)
	}
	return nil
}

// Restart server functionality
func (pm *ProcessManager) RestartServer(id string) error {
	pm.mutex.Lock()
	server, exists := pm.servers[id]
	if !exists {
		pm.mutex.Unlock()
		return fmt.Errorf("server not found: %s", id)
	}

	pm.logger.LogProcessEvent(id, server.Name, "RESTARTING", "Server restart requested")
	if pm.logManager != nil {
		pm.logManager.AddServerLog(id, server.Name, "INFO", "server", "Server restart requested")
	}
	pm.mutex.Unlock()

	// Stop the server if running
	if server.Status == StatusRunning {
		if err := pm.StopServer(id); err != nil {
			return fmt.Errorf("failed to stop server for restart: %v", err)
		}

		// Wait a moment before starting
		time.Sleep(time.Second)
	}

	// Start the server
	return pm.StartServer(id)
}

// Extension installation methods (like Python version)
func (pm *ProcessManager) installExtension(env []string, extensionID, serverID, serverName string) bool {
	log.Printf("Installing extension: %s", extensionID)

	cmd := exec.Command("code-server", "--install-extension", extensionID)
	cmd.Env = env

	stdout, err := cmd.Output()
	if err != nil {
		log.Printf("Failed to install extension %s: %v", extensionID, err)
		pm.logger.LogProcessEvent(serverID, serverName, "EXTENSION_INSTALL_FAILED",
			fmt.Sprintf("Failed to install %s: %v", extensionID, err))
		return false
	}

	log.Printf("Successfully installed extension: %s", extensionID)
	if len(stdout) > 0 {
		log.Printf("Extension install output: %s", string(stdout))
	}
	pm.logger.LogProcessEvent(serverID, serverName, "EXTENSION_INSTALLED",
		fmt.Sprintf("Successfully installed %s", extensionID))
	return true
}

func (pm *ProcessManager) installExtensions(env []string, extensions []string, serverID, serverName string) bool {
	if len(extensions) == 0 {
		return true
	}

	log.Printf("Installing %d extensions: %v", len(extensions), extensions)
	successCount := 0

	for _, extension := range extensions {
		if pm.installExtension(env, extension, serverID, serverName) {
			successCount++
		} else {
			log.Printf("Failed to install extension: %s", extension)
		}
	}

	log.Printf("Successfully installed %d/%d extensions", successCount, len(extensions))
	return successCount == len(extensions)
}

// State refresh routine - refreshes server state from file every second
func (pm *ProcessManager) startStateRefreshRoutine() {
	ticker := time.NewTicker(1 * time.Second) // Refresh every second
	defer ticker.Stop()

	log.Println("State refresh routine started - refreshing server state every second")

	for range ticker.C {
		pm.refreshStateFromFile()
	}
}

func (pm *ProcessManager) refreshStateFromFile() {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// First, update metrics for all running servers
	pm.updateServerMetrics()

	// Reload servers from file
	if _, err := os.Stat(pm.serversFile); os.IsNotExist(err) {
		return // File doesn't exist
	}

	data, err := os.ReadFile(pm.serversFile)
	if err != nil {
		// Don't log every second if file read fails, just skip this refresh
		return
	}

	var servers map[string]*ServerInstance
	if err := json.Unmarshal(data, &servers); err != nil {
		// Don't log every second if parse fails, just skip this refresh
		return
	}

	// Update in-memory state with fresh data from file, but preserve current metrics
	oldServers := pm.servers
	pm.servers = servers
	pm.portMap = make(map[int]string)

	// Rebuild port map and preserve current metrics for running servers
	for id, server := range servers {
		pm.portMap[server.Port] = id
		if server.Port >= pm.nextPort {
			pm.nextPort = server.Port + 1
		}

		// Preserve current metrics if server was previously running
		if oldServer, exists := oldServers[id]; exists {
			if server.Status == StatusRunning && server.PID != nil {
				server.Uptime = oldServer.Uptime
				server.CPUPercent = oldServer.CPUPercent
				server.MemoryMB = oldServer.MemoryMB
				server.LastUpdate = oldServer.LastUpdate
			}
		}
	}

	// Save updated state with metrics
	pm.saveServers()
}

// Single health monitoring routine for all servers (more efficient)
func (pm *ProcessManager) startHealthMonitor() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	defer ticker.Stop()

	log.Println("Health monitor started - checking all servers every 30 seconds")

	for range ticker.C {
		pm.performHealthCheck()
	}
}

func (pm *ProcessManager) performHealthCheck() {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	runningCount := 0
	stoppedCount := 0
	serversToUpdate := make([]*ServerInstance, 0)

	for serverID, server := range pm.servers {
		if server.Status == StatusRunning && server.PID != nil {
			runningCount++

			// Check if server is healthy via HTTP health endpoint
			isHealthy := pm.isServerHealthy(server.Port)

			if !isHealthy {
				// Server is not responding to health checks, mark as stopped
				log.Printf("Health check: Server %s on port %d failed health check", server.Name, server.Port)
				pm.logger.LogProcessEvent(serverID, server.Name, "HEALTH_CHECK_FAILED",
					fmt.Sprintf("Server on port %d failed to respond to /healthz", server.Port))

				if pm.logManager != nil {
					pm.logManager.AddServerLog(serverID, server.Name, "WARN", "server",
						fmt.Sprintf("Health check failed - server marked as stopped (port %d)", server.Port))
				}

				server.Status = StatusStopped
				server.PID = nil
				server.StartTime = nil
				serversToUpdate = append(serversToUpdate, server)
				runningCount-- // Adjust count since this server just stopped
				stoppedCount++
			} else {
				// Server is healthy, log periodic health check (every 5 minutes)
				if time.Now().Unix()%300 == 0 {
					pm.logger.LogProcessEvent(serverID, server.Name, "HEALTH_CHECK_OK",
						fmt.Sprintf("Server on port %d is healthy", server.Port))
				}
			}
		} else {
			stoppedCount++
		}
	}

	// Save updates if any servers changed status
	if len(serversToUpdate) > 0 {
		pm.saveServers()
		log.Printf("Health check: Updated status for %d servers that died", len(serversToUpdate))
	}

	// Log summary every 2 minutes (every 4th check)
	if time.Now().Unix()%120 == 0 {
		log.Printf("Health check summary: %d running, %d stopped servers", runningCount, stoppedCount)
	}
}

func (pm *ProcessManager) isServerHealthy(port int) bool {
	// Create HTTP client with short timeout and no redirect following
	client := &http.Client{
		Timeout: 3 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Don't follow redirects, just return them as responses
			return http.ErrUseLastResponse
		},
	}

	// First, hit the root endpoint to wake up the server (ignore redirects and errors)
	rootResp, err := client.Get(fmt.Sprintf("http://localhost:%d/", port))
	if err == nil {
		rootResp.Body.Close()
	}
	// Ignore any errors from root request - we just want to wake up the server

	// Now make request to health endpoint
	resp, err := client.Get(fmt.Sprintf("http://localhost:%d/healthz", port))
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// Check if response is successful
	if resp.StatusCode != http.StatusOK {
		return false
	}

	// Parse the JSON response to check status
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false
	}

	var healthResponse struct {
		Status        string `json:"status"`
		LastHeartbeat int64  `json:"lastHeartbeat"`
	}

	if err := json.Unmarshal(body, &healthResponse); err != nil {
		return false
	}

	// Check if status is "alive"
	return healthResponse.Status == "alive"
}

// updateServerMetrics collects and updates CPU, memory, and uptime metrics for all running servers
func (pm *ProcessManager) updateServerMetrics() {
	now := time.Now()

	for _, server := range pm.servers {
		// Only update metrics for running servers with valid PID and start time
		if server.Status != StatusRunning || server.PID == nil || server.StartTime == nil {
			// Clear metrics for non-running servers
			server.Uptime = nil
			server.CPUPercent = nil
			server.MemoryMB = nil
			server.LastUpdate = nil
			continue
		}

		// Check if process still exists and collect metrics
		if proc, err := process.NewProcess(int32(*server.PID)); err == nil {
			// Check if process still exists by trying to get its status
			if exists, err := proc.IsRunning(); err == nil && exists {
				// Calculate uptime
				uptime := now.Sub(*server.StartTime).Seconds()
				server.Uptime = &uptime

				// Get CPU percentage
				if cpuPercent, err := proc.CPUPercent(); err == nil {
					server.CPUPercent = &cpuPercent
				} else {
					// Set to 0 if we can't get CPU data but process exists
					zero := 0.0
					server.CPUPercent = &zero
				}

				// Get memory info
				if memInfo, err := proc.MemoryInfo(); err == nil {
					memoryMB := float64(memInfo.RSS) / 1024 / 1024
					server.MemoryMB = &memoryMB
				} else {
					// Set to 0 if we can't get memory data but process exists
					zero := 0.0
					server.MemoryMB = &zero
				}

				// Update last update time
				server.LastUpdate = &now
			} else {
				// Process doesn't exist anymore, mark as stopped and clear metrics
				if pm.logManager != nil {
					pm.logManager.AddServerLog("", server.Name, "WARN", "server", "Process no longer exists - marking as stopped")
				}
				server.Status = StatusStopped
				server.PID = nil
				server.StartTime = nil
				server.Uptime = nil
				server.CPUPercent = nil
				server.MemoryMB = nil
				server.LastUpdate = &now
			}
		} else {
			// Can't access process, mark as stopped and clear metrics
			if pm.logManager != nil {
				pm.logManager.AddServerLog("", server.Name, "WARN", "server", "Cannot access process - marking as stopped")
			}
			server.Status = StatusStopped
			server.PID = nil
			server.StartTime = nil
			server.Uptime = nil
			server.CPUPercent = nil
			server.MemoryMB = nil
			server.LastUpdate = &now
		}
	}
}

// Multi-step server creation methods
func (pm *ProcessManager) CreateServerMetadata(name string) (*ServerInstance, error) {
	// Generate unique ID and port
	id := uuid.New().String()
	port := pm.getNextAvailablePort()

	// Create workspace directory
	workspacePath := filepath.Join("workspace", id)
	absWorkspacePath, err := filepath.Abs(workspacePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute workspace path: %v", err)
	}
	workspacePath = absWorkspacePath

	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create workspace directory: %v", err)
	}

	// Create server data directory
	serverDataDir := filepath.Join(pm.dataDir, id)
	if err := os.MkdirAll(serverDataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create server data directory: %v", err)
	}

	server := &ServerInstance{
		ID:            id,
		Name:          name,
		Port:          port,
		WorkspacePath: workspacePath,
		Extensions:    []string{},
		Status:        StatusStopped,
		StartTime:     nil,
		PID:           nil,
	}

	// Lock and store server
	pm.mutex.Lock()
	pm.servers[id] = server
	pm.portMap[port] = id
	pm.saveServers()
	pm.mutex.Unlock()

	pm.logger.LogProcessEvent(id, name, "METADATA_CREATED", fmt.Sprintf("Server metadata created on port %d", port))
	log.Printf("Created server metadata %s (%s) on port %d", name, id, port)
	return server, nil
}

func (pm *ProcessManager) InstallExtensionsForServer(serverID string, extensions []string) error {
	return pm.InstallExtensionsWithProgress(serverID, extensions, []string{}, nil)
}

// InstallSingleExtension installs a single extension for a server
func (pm *ProcessManager) InstallSingleExtension(serverID string, extension string) error {
	pm.mutex.RLock()
	server, exists := pm.servers[serverID]
	if !exists {
		pm.mutex.RUnlock()
		return fmt.Errorf("server not found: %s", serverID)
	}
	pm.mutex.RUnlock()

	log.Printf("Installing single extension for server %s: %s", serverID, extension)

	// Set up environment for extension installation
	env := os.Environ()
	userDataDir := filepath.Join(pm.dataDir, serverID)
	absDataDir, err := filepath.Abs(userDataDir)
	if err != nil {
		log.Printf("Failed to get absolute data dir path: %v", err)
		absDataDir = userDataDir
	}

	env = append(env, fmt.Sprintf("XDG_DATA_HOME=%s", absDataDir))

	// Install the extension
	success := pm.installExtension(env, extension, serverID, server.Name)
	if !success {
		return fmt.Errorf("failed to install extension: %s", extension)
	}

	// Update server extensions list
	pm.mutex.Lock()
	if server.Extensions == nil {
		server.Extensions = []string{}
	}
	// Add extension if not already present
	found := false
	for _, ext := range server.Extensions {
		if ext == extension {
			found = true
			break
		}
	}
	if !found {
		server.Extensions = append(server.Extensions, extension)
		pm.saveServers()
	}
	pm.mutex.Unlock()

	log.Printf("Successfully installed extension %s for server %s", extension, serverID)
	return nil
}

func (pm *ProcessManager) InstallExtensionsWithProgress(serverID string, extensions []string, groupsWithUserSettings []string, onProgress func(step string, current int, total int)) error {
	pm.mutex.RLock()
	server, exists := pm.servers[serverID]
	if !exists {
		pm.mutex.RUnlock()
		return fmt.Errorf("server not found: %s", serverID)
	}
	pm.mutex.RUnlock()

	if len(extensions) == 0 {
		return nil
	}

	log.Printf("Installing extensions for server %s: %v", serverID, extensions)

	// Set up environment for extension installation
	env := os.Environ()

	// Get absolute path for XDG_DATA_HOME
	userDataDir := filepath.Join(pm.dataDir, serverID)
	absDataDir, err := filepath.Abs(userDataDir)
	if err != nil {
		log.Printf("Failed to get absolute data dir path: %v", err)
		absDataDir = userDataDir
	}

	env = append(env,
		fmt.Sprintf("XDG_DATA_HOME=%s", absDataDir),
	)

	// Install extensions one by one with progress reporting
	successCount := 0
	totalSteps := len(extensions) + len(groupsWithUserSettings) // Extensions + user settings steps
	currentStep := 0

	for i, extension := range extensions {
		currentStep++
		if onProgress != nil {
			onProgress(fmt.Sprintf("Installing extension: %s", extension), currentStep, totalSteps)
		}

		log.Printf("Installing extension %d/%d: %s", i+1, len(extensions), extension)

		if pm.installExtension(env, extension, serverID, server.Name) {
			successCount++
		} else {
			log.Printf("Failed to install extension: %s", extension)
		}
	}

	// Update server extensions list
	pm.mutex.Lock()
	if successCount > 0 {
		server.Extensions = extensions
		pm.saveServers()
	}
	pm.mutex.Unlock()

	// Apply user settings for each group separately with progress
	for _, groupName := range groupsWithUserSettings {
		currentStep++
		if onProgress != nil {
			onProgress(fmt.Sprintf("Applying user settings for %s...", groupName), currentStep, totalSteps)
		}

		if err := pm.applyGroupUserSettings(serverID, groupName); err != nil {
			log.Printf("Failed to apply user settings for group %s: %v", groupName, err)
			// Continue anyway, don't fail extension installation
		}
	}

	if successCount == len(extensions) {
		log.Printf("All extensions installed successfully for server %s", serverID)
		return nil
	} else {
		log.Printf("Some extensions failed to install for server %s: %d/%d succeeded", serverID, successCount, len(extensions))
		return fmt.Errorf("some extensions failed to install: %d/%d succeeded", successCount, len(extensions))
	}
}

func (pm *ProcessManager) InitializeWorkspaceForServer(serverID, zipFilePath, githubURL string) error {
	pm.mutex.RLock()
	server, exists := pm.servers[serverID]
	if !exists {
		pm.mutex.RUnlock()
		return fmt.Errorf("server not found: %s", serverID)
	}
	workspacePath := server.WorkspacePath
	pm.mutex.RUnlock()

	// Initialize workspace from zip file or GitHub repository
	if zipFilePath != "" {
		log.Printf("Initializing workspace from zip file: %s", zipFilePath)
		if err := pm.extractZipFile(zipFilePath, workspacePath); err != nil {
			return fmt.Errorf("failed to initialize workspace from zip file: %v", err)
		}
		log.Printf("Workspace successfully initialized from zip file for server %s", serverID)
	} else if githubURL != "" {
		log.Printf("Initializing workspace from GitHub repository: %s", githubURL)
		if err := pm.cloneGithubRepo(githubURL, workspacePath); err != nil {
			return fmt.Errorf("failed to clone GitHub repository: %v", err)
		}
		log.Printf("Workspace successfully initialized from GitHub repository for server %s", serverID)
	} else {
		return fmt.Errorf("either zipFilePath or githubURL must be provided")
	}

	pm.logger.LogProcessEvent(serverID, server.Name, "WORKSPACE_INITIALIZED", "Workspace initialized successfully")
	return nil
}

// applyUserSettings merges user_settings from extension groups into VS Code settings.json
func (pm *ProcessManager) applyUserSettings(serverID string, installedExtensions []string) error {
	config := GetConfig()
	if config == nil {
		return fmt.Errorf("config not available")
	}

	// Collect user settings from all installed extension groups
	userSettings := make(map[string]interface{})

	// Map installed extensions to their extension groups
	for groupName, group := range config.ExtensionGroups {
		if group.UserSettings == nil || len(group.UserSettings) == 0 {
			continue
		}

		// Check if any extensions from this group are installed
		groupHasInstalledExtensions := false
		for _, installedExt := range installedExtensions {
			for _, groupExt := range group.Extensions {
				if installedExt == groupExt {
					groupHasInstalledExtensions = true
					break
				}
			}
			if groupHasInstalledExtensions {
				break
			}
		}

		// If this group has installed extensions, merge its user settings
		if groupHasInstalledExtensions {
			log.Printf("Applying user settings from extension group '%s' for server %s", groupName, serverID)
			for key, value := range group.UserSettings {
				userSettings[key] = value
			}
		}
	}

	if len(userSettings) == 0 {
		log.Printf("No user settings to apply for server %s", serverID)
		return nil
	}

	// Create the settings file path
	userDataDir := filepath.Join(pm.dataDir, serverID)
	configDir := filepath.Join(userDataDir, "code-server")
	userDir := filepath.Join(configDir, "User")
	settingsFile := filepath.Join(userDir, "settings.json")

	// Ensure User directory exists
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return fmt.Errorf("failed to create User directory: %v", err)
	}

	// Read existing settings if file exists
	existingSettings := make(map[string]interface{})
	if data, err := os.ReadFile(settingsFile); err == nil {
		if err := json.Unmarshal(data, &existingSettings); err != nil {
			log.Printf("Warning: Could not parse existing settings.json for server %s: %v", serverID, err)
		}
	}

	// Merge user settings into existing settings (user settings take precedence)
	for key, value := range userSettings {
		existingSettings[key] = value
		log.Printf("Applied setting %s = %v for server %s", key, value, serverID)
	}

	// Write merged settings back to file
	data, err := json.MarshalIndent(existingSettings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %v", err)
	}

	if err := os.WriteFile(settingsFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write settings file: %v", err)
	}

	log.Printf("Successfully applied %d user settings to %s", len(userSettings), settingsFile)
	return nil
}

// applyGroupUserSettings applies user settings for a specific extension group
func (pm *ProcessManager) applyGroupUserSettings(serverID string, groupName string) error {
	config := GetConfig()
	if config == nil {
		return fmt.Errorf("config not available")
	}

	group, exists := config.ExtensionGroups[groupName]
	if !exists {
		return fmt.Errorf("extension group %s not found", groupName)
	}

	if group.UserSettings == nil || len(group.UserSettings) == 0 {
		log.Printf("No user settings to apply for group %s", groupName)
		return nil
	}

	// Get server data directory
	userDataDir := filepath.Join(pm.dataDir, serverID)
	configDir := filepath.Join(userDataDir, "code-server")
	userDir := filepath.Join(configDir, "User")
	settingsFile := filepath.Join(userDir, "settings.json")

	// Ensure User directory exists
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return fmt.Errorf("failed to create User directory: %v", err)
	}

	// Read existing settings if file exists
	existingSettings := make(map[string]interface{})
	if data, err := os.ReadFile(settingsFile); err == nil {
		if err := json.Unmarshal(data, &existingSettings); err != nil {
			log.Printf("Warning: Could not parse existing settings.json for server %s: %v", serverID, err)
		}
	}

	// Apply user settings from this group
	settingsApplied := 0
	for key, value := range group.UserSettings {
		existingSettings[key] = value
		log.Printf("Applied setting %s = %v for group %s on server %s", key, value, groupName, serverID)
		settingsApplied++
	}

	// Write merged settings back to file
	data, err := json.MarshalIndent(existingSettings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %v", err)
	}

	if err := os.WriteFile(settingsFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write settings file: %v", err)
	}

	log.Printf("Successfully applied %d user settings for group %s to %s", settingsApplied, groupName, settingsFile)
	return nil
}

// InitializeExtensionProgress creates initial progress tracking for extension installation
func (pm *ProcessManager) InitializeExtensionProgress(serverID string, extensions []string) (*ExtensionInstallationProgress, error) {
	pm.extensionProgressMutex.Lock()
	defer pm.extensionProgressMutex.Unlock()

	// Check if server exists
	pm.mutex.RLock()
	_, exists := pm.servers[serverID]
	pm.mutex.RUnlock()
	if !exists {
		return nil, fmt.Errorf("server not found: %s", serverID)
	}

	extensionList := make([]ExtensionProgress, len(extensions))
	for i, ext := range extensions {
		extensionList[i] = ExtensionProgress{
			Name:   ext,
			Status: ExtensionPending,
		}
	}

	progress := &ExtensionInstallationProgress{
		ServerID:         serverID,
		Total:            len(extensions),
		Completed:        0,
		Failed:           0,
		CurrentExtension: "",
		Extensions:       extensionList,
		IsComplete:       false,
	}

	pm.extensionProgress[serverID] = progress
	log.Printf("Initialized extension progress for server %s with %d extensions", serverID, len(extensions))
	return progress, nil
}

// GetExtensionProgress returns the current installation progress for a server
func (pm *ProcessManager) GetExtensionProgress(serverID string) (*ExtensionInstallationProgress, error) {
	pm.extensionProgressMutex.RLock()
	defer pm.extensionProgressMutex.RUnlock()

	progress, exists := pm.extensionProgress[serverID]
	if !exists {
		return nil, fmt.Errorf("no extension installation progress found for server: %s", serverID)
	}

	return progress, nil
}

// installExtensionsProgressively installs extensions one by one with progress tracking
func (pm *ProcessManager) installExtensionsProgressively(serverID string, extensions []string) {
	pm.mutex.RLock()
	server, exists := pm.servers[serverID]
	if !exists {
		pm.mutex.RUnlock()
		return
	}
	pm.mutex.RUnlock()

	if len(extensions) == 0 {
		pm.markExtensionInstallationComplete(serverID)
		return
	}

	log.Printf("Installing extensions progressively for server %s: %v", serverID, extensions)

	// Set up environment for extension installation
	env := os.Environ()

	// Get absolute path for XDG_DATA_HOME
	userDataDir := filepath.Join(pm.dataDir, serverID)
	absDataDir, err := filepath.Abs(userDataDir)
	if err != nil {
		log.Printf("Failed to get absolute data dir path: %v", err)
		absDataDir = userDataDir
	}

	env = append(env,
		fmt.Sprintf("XDG_DATA_HOME=%s", absDataDir),
	)

	// Install extensions one by one
	for i, extension := range extensions {
		pm.updateExtensionStatus(serverID, extension, ExtensionInstalling)

		log.Printf("Installing extension %d/%d: %s", i+1, len(extensions), extension)

		success := pm.installExtension(env, extension, serverID, server.Name)

		if success {
			pm.updateExtensionStatus(serverID, extension, ExtensionCompleted)
		} else {
			pm.updateExtensionStatus(serverID, extension, ExtensionFailed)
		}
	}

	// Update server extensions list with successfully installed extensions
	pm.mutex.Lock()
	if server, exists := pm.servers[serverID]; exists {
		server.Extensions = extensions
		pm.saveServers()
	}
	pm.mutex.Unlock()

	// Apply user settings after extension installation
	if err := pm.applyUserSettings(serverID, extensions); err != nil {
		log.Printf("Failed to apply user settings for server %s: %v", serverID, err)
	}

	pm.markExtensionInstallationComplete(serverID)
	log.Printf("Extension installation completed for server %s", serverID)
}

// updateExtensionStatus updates the status of a specific extension
func (pm *ProcessManager) updateExtensionStatus(serverID string, extensionName string, status ExtensionInstallStatus) {
	pm.extensionProgressMutex.Lock()
	defer pm.extensionProgressMutex.Unlock()

	progress, exists := pm.extensionProgress[serverID]
	if !exists {
		return
	}

	// Update the specific extension status
	for i := range progress.Extensions {
		if progress.Extensions[i].Name == extensionName {
			oldStatus := progress.Extensions[i].Status
			progress.Extensions[i].Status = status

			// Update current extension
			if status == ExtensionInstalling {
				progress.CurrentExtension = extensionName
			}

			// Update counters
			if oldStatus == ExtensionPending && status == ExtensionCompleted {
				progress.Completed++
			} else if oldStatus == ExtensionPending && status == ExtensionFailed {
				progress.Failed++
			} else if oldStatus == ExtensionInstalling && status == ExtensionCompleted {
				progress.Completed++
				progress.CurrentExtension = ""
			} else if oldStatus == ExtensionInstalling && status == ExtensionFailed {
				progress.Failed++
				progress.CurrentExtension = ""
			}

			break
		}
	}
}

// markExtensionInstallationComplete marks the installation as complete
func (pm *ProcessManager) markExtensionInstallationComplete(serverID string) {
	pm.extensionProgressMutex.Lock()
	defer pm.extensionProgressMutex.Unlock()

	progress, exists := pm.extensionProgress[serverID]
	if !exists {
		return
	}

	progress.IsComplete = true
	progress.CurrentExtension = ""

	log.Printf("Extension installation marked as complete for server %s: %d completed, %d failed",
		serverID, progress.Completed, progress.Failed)
}
