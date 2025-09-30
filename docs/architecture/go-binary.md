# Go Binary Components

The Go server is the heart of Databricks DevBox, managing all code-server instances and providing the API layer.

## File Structure

```
databricks_devbox_go/
├── main.go              # Entry point, server initialization
├── process_manager.go   # Core process lifecycle management (1595 lines)
├── routes.go           # API endpoint definitions (672 lines)
├── config.go           # Configuration loading and parsing (249 lines)
├── proxy.go            # HTTP proxy to code-server instances
├── log_manager.go      # Log aggregation and WebSocket streaming
├── logger.go           # Process event logging
├── assets.go           # Embedded web UI assets
└── go.mod              # Go module dependencies
```

## Core Components

### 1. Main Server (`main.go`)

Entry point and HTTP server setup using Gin framework.

**Key Functions:**

```go
func main() {
    // Initialize configuration
    InitializeConfig()

    // Create services
    logManager := NewLogManager()
    processManager := NewProcessManager()

    // Setup router with middleware
    r := gin.New()
    r.Use(gin.Logger())
    r.Use(gin.Recovery())
    r.Use(CORSMiddleware())

    // Setup routes
    setupRoutes(r, processManager, logManager)

    // Start server
    srv := &http.Server{
        Addr: ":" + port,
        Handler: r,
    }
    srv.ListenAndServe()
}
```

**Middleware:**

- `gin.Logger()` - Request logging
- `gin.Recovery()` - Panic recovery
- `CORSMiddleware()` - CORS headers for web UI

### 2. Process Manager (`process_manager.go`)

The most complex component, handling all code-server instance lifecycle.

**Data Structures:**

```go
type ProcessManager struct {
    servers                map[string]*ServerInstance
    mutex                  sync.RWMutex
    portMap                map[int]string  // port → server_id
    nextPort               int
    logger                 *ProcessLogger
    logManager             *LogManager
    dataDir                string
    serversFile            string
    extensionProgress      map[string]*ExtensionInstallationProgress
    extensionProgressMutex sync.RWMutex
}

type ServerInstance struct {
    ID            string       `json:"id"`
    Name          string       `json:"name"`
    Port          int          `json:"port"`
    WorkspacePath string       `json:"workspace_path"`
    Extensions    []string     `json:"extensions"`
    Status        ServerStatus `json:"status"`  // running/stopped/failed
    PID           *int         `json:"pid,omitempty"`
    StartTime     *time.Time   `json:"start_time,omitempty"`
    Command       []string     `json:"command,omitempty"`
    Uptime        *float64     `json:"uptime,omitempty"`
    CPUPercent    *float64     `json:"cpu_percent,omitempty"`
    MemoryMB      *float64     `json:"memory_mb,omitempty"`
    LastUpdate    *time.Time   `json:"last_update,omitempty"`
}
```

**Key Methods:**

| Method | Description | Location |
|--------|-------------|----------|
| `NewProcessManager()` | Initialize manager, load state | process_manager.go:84 |
| `CreateServer()` | Create server with extensions & workspace | process_manager.go:131 |
| `StartServer()` | Start code-server process | process_manager.go:239 |
| `StopServer()` | Stop running server | process_manager.go:357 |
| `DeleteServer()` | Remove server and cleanup | process_manager.go:410 |
| `RestartServer()` | Stop and start server | process_manager.go:748 |
| `GetServerHealth()` | Get health metrics | process_manager.go:574 |
| `installExtensions()` | Install VS Code extensions | process_manager.go:800 |

**Background Goroutines:**

```go
// Health monitoring (every 30 seconds)
go pm.startHealthMonitor()  // process_manager.go:102

// State refresh from disk (every 1 second)
go pm.startStateRefreshRoutine()  // process_manager.go:104

// Per-server process monitoring
go pm.monitorProcess(id, cmd)  // process_manager.go:352
```

### 3. Configuration (`config.go`)

Loads and validates `devbox.yaml` configuration.

**Data Structures:**

```go
type DevboxConfig struct {
    ExtensionGroups map[string]ExtensionGroup
    Server          ServerConfig
    UI              UIConfig
    PackagedAssets  *PackagedAssets
}

type ExtensionGroup struct {
    Name         string
    Description  string
    Extensions   []string
    UserSettings map[string]interface{}  // VS Code settings
}
```

**Loading Process:**

```go
// 1. Read DEVBOX_CONFIG_PATH env var
configPath := os.Getenv("DEVBOX_CONFIG_PATH")
if configPath == "" {
    configPath = "app/devbox.yaml"  // Default
}

// 2. Load YAML file
config, err := loadConfigFromFile(configPath)

// 3. Validate and fill defaults
config = validateAndFillDefaults(config)

// 4. Store globally
globalConfig = config
```

### 4. API Routes (`routes.go`)

Defines all REST API endpoints using Gin handlers.

**Route Groups:**

```go
// Health check
r.GET("/health", ...)

// Configuration
r.GET("/config", getConfig())
r.GET("/templates", getTemplates())

// Server management
r.GET("/servers", listServers(pm))
r.POST("/servers", createServer(pm))
r.POST("/servers/:id/start", startServer(pm))
r.POST("/servers/:id/stop", stopServer(pm))
r.POST("/servers/:id/restart", restartServer(pm))
r.DELETE("/servers/:id", deleteServer(pm))

// Health & logs
r.GET("/servers/:id/health", getServerHealth(pm))
r.GET("/servers/:id/logs", getServerLogs(pm))

// WebSocket
r.GET("/ws/logs", ...)
r.GET("/ws/logs/:serverId", ...)

// Proxy to code-server
r.Any("/vscode/:port/*path", proxyToCodeServer(pm))
```

**Handler Pattern:**

```go
func startServer(pm *ProcessManager) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")

        if err := pm.StartServer(id); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        server, _ := pm.GetServer(id)
        c.JSON(http.StatusOK, gin.H{
            "status": "success",
            "data": server,
        })
    }
}
```

### 5. Proxy Handler (`proxy.go`)

Forwards requests from `/vscode/:port/*` to code-server instances.

**Implementation:**

```go
func proxyToCodeServer(pm *ProcessManager) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Extract port from URL
        portStr := c.Param("port")
        port, _ := strconv.Atoi(portStr)

        // Find server by port
        server, err := pm.GetServerByPort(port)
        if err != nil {
            c.JSON(404, gin.H{"error": "Server not found"})
            return
        }

        // Build target URL
        targetURL := fmt.Sprintf("http://localhost:%d", port)

        // Create reverse proxy
        proxy := httputil.NewSingleHostReverseProxy(targetURL)
        proxy.ServeHTTP(c.Writer, c.Request)
    }
}
```

**URL Rewriting:**

```
User Request: /vscode/8010/path/to/file
Proxy To: http://localhost:8010/path/to/file
```

### 6. Log Manager (`log_manager.go`)

Aggregates logs from all code-server instances and streams via WebSocket.

**Features:**

- In-memory ring buffer for recent logs
- WebSocket broadcasting to connected clients
- Per-server log isolation
- System-wide log aggregation

**WebSocket Protocol:**

```json
{
  "type": "log",
  "server_id": "uuid",
  "server_name": "my-server",
  "level": "INFO",
  "source": "server",
  "message": "Server started",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Code-Server Process Lifecycle

### Starting a Server

```go
func (pm *ProcessManager) StartServer(id string) error {
    // 1. Get server metadata
    server := pm.servers[id]

    // 2. Create data directories
    userDataDir := filepath.Join(pm.dataDir, id)
    configDir := filepath.Join(userDataDir, "code-server")
    os.MkdirAll(configDir, 0755)

    // 3. Build command
    cmd := exec.Command("code-server",
        "--bind-addr", fmt.Sprintf("0.0.0.0:%d", server.Port),
        "--user-data-dir", configDir,
        "--auth", "none",
        "--disable-telemetry",
        server.WorkspacePath,
    )

    // 4. Set environment variables
    cmd.Env = []string{
        fmt.Sprintf("XDG_DATA_HOME=%s", userDataDir),
        "NODE_OPTIONS=--max-old-space-size=2048",
        // ... more env vars
    }

    // 5. Start process
    cmd.Start()

    // 6. Update server state
    server.PID = cmd.Process.Pid
    server.Status = StatusRunning
    pm.saveServers()

    // 7. Monitor process
    go pm.monitorProcess(id, cmd)

    return nil
}
```

### Extension Installation

```go
func (pm *ProcessManager) installExtension(env []string, extensionID string) bool {
    // Run: code-server --install-extension <extension-id>
    cmd := exec.Command("code-server", "--install-extension", extensionID)
    cmd.Env = env  // Include XDG_DATA_HOME

    output, err := cmd.Output()
    return err == nil
}
```

### Health Checking

```go
func (pm *ProcessManager) isServerHealthy(port int) bool {
    // 1. HTTP client with timeout
    client := &http.Client{Timeout: 3 * time.Second}

    // 2. Request health endpoint
    resp, err := client.Get(fmt.Sprintf("http://localhost:%d/healthz", port))
    if err != nil {
        return false
    }
    defer resp.Body.Close()

    // 3. Check response
    if resp.StatusCode != 200 {
        return false
    }

    // 4. Parse JSON
    var healthResponse struct {
        Status        string `json:"status"`
        LastHeartbeat int64  `json:"lastHeartbeat"`
    }
    json.NewDecoder(resp.Body).Decode(&healthResponse)

    return healthResponse.Status == "alive"
}
```

## Metrics Collection

Using `github.com/shirou/gopsutil/v3/process`:

```go
func (pm *ProcessManager) updateServerMetrics() {
    for _, server := range pm.servers {
        if server.PID != nil {
            proc, _ := process.NewProcess(int32(*server.PID))

            // CPU usage
            cpuPercent, _ := proc.CPUPercent()
            server.CPUPercent = &cpuPercent

            // Memory usage
            memInfo, _ := proc.MemoryInfo()
            memoryMB := float64(memInfo.RSS) / 1024 / 1024
            server.MemoryMB = &memoryMB

            // Uptime
            uptime := time.Since(*server.StartTime).Seconds()
            server.Uptime = &uptime
        }
    }
    pm.saveServers()
}
```

## Performance Considerations

### Concurrency

- **RWMutex**: Used for server map access
  - Read-heavy operations use `RLock()`
  - Write operations use `Lock()`
- **Goroutines**: One per running server for monitoring
- **Channel Communication**: For log streaming

### Memory Management

- **Ring Buffers**: For log storage (limited size)
- **Connection Pooling**: HTTP client reuse
- **Cleanup**: Proper resource cleanup on server deletion

### File I/O

- **Atomic Writes**: `os.WriteFile()` for `servers.json`
- **Frequent Saves**: Every state change persisted
- **Reload on Refresh**: State refreshed every second from disk

## Dependencies

```go
require (
    github.com/gin-gonic/gin v1.9.1
    github.com/google/uuid v1.3.0
    github.com/shirou/gopsutil/v3 v3.23.0
    gopkg.in/yaml.v2 v2.4.0
)
```

## Building

```bash
# Build for current platform
go build -o databricks-devbox *.go

# Build with version info
go build -ldflags "-X main.version=0.1.0" -o databricks-devbox *.go

# Cross-compile for multiple platforms
GOOS=linux GOARCH=amd64 go build -o databricks-devbox-linux-amd64 *.go
GOOS=darwin GOARCH=arm64 go build -o databricks-devbox-darwin-arm64 *.go
```

## Next Steps

<div class="grid cards" markdown>

- **[Process Management →](process-management.md)**

    Detailed process lifecycle

- **[Configuration →](../configuration/devbox-yaml.md)**

    Configuration reference

</div>