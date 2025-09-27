package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type CreateServerRequest struct {
	Name       string   `json:"name" binding:"required"`
	Extensions []string `json:"extensions"`
}

func setupRoutes(r *gin.Engine, pm *ProcessManager, lm *LogManager) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "Databricks Devbox API",
		})
	})

	// Server management endpoints
	r.GET("/servers", listServers(pm))
	r.POST("/servers", createServer(pm))
	r.POST("/servers/create-with-workspace", createServerWithWorkspace(pm))

	// Multi-step server creation endpoints
	r.POST("/servers/create-metadata", createServerMetadata(pm))
	r.POST("/servers/:id/install-extensions", installServerExtensions(pm))
	r.POST("/servers/:id/clone-workspace", cloneServerWorkspace(pm))

	r.POST("/servers/:id/start", startServer(pm))
	r.POST("/servers/:id/stop", stopServer(pm))
	r.POST("/servers/:id/restart", restartServer(pm))
	r.DELETE("/servers/:id", deleteServer(pm))
	r.GET("/servers/:id/health", getServerHealth(pm))
	r.GET("/servers/:id/logs", getServerLogs(pm))
	r.POST("/servers/:id/refresh-status", refreshServerStatus(pm))
	r.POST("/servers/refresh-all", refreshAllServersStatus(pm))

	// WebSocket endpoint for real-time logs
	r.GET("/ws/logs", func(c *gin.Context) {
		lm.HandleWebSocket(c.Writer, c.Request)
	})
	r.GET("/ws/logs/:serverId", func(c *gin.Context) {
		lm.HandleWebSocket(c.Writer, c.Request)
	})

	// Proxy endpoints for code-server
	r.Any("/vscode/:port/*path", proxyToCodeServer(pm))
	r.Any("/vscode/:port", proxyToCodeServer(pm))

	// Create a sub-filesystem for the web UI assets directory
	assetsSubFS, _ := fs.Sub(webUIFS, "web_ui_dist/assets")
	r.StaticFS("/assets", http.FS(assetsSubFS))

	// Serve embedded logo as favicon and logo
	r.GET("/favicon.ico", serveEmbeddedLogo)
	r.GET("/logo.png", serveEmbeddedLogo)

	// Serve React app for client-side routing (but not for asset files)
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Don't serve index.html for asset files (js, css, etc.)
		if strings.HasSuffix(path, ".js") ||
			strings.HasSuffix(path, ".css") ||
			strings.HasSuffix(path, ".map") ||
			strings.HasSuffix(path, ".ico") ||
			strings.HasSuffix(path, ".svg") ||
			strings.HasSuffix(path, ".png") ||
			strings.HasSuffix(path, ".jpg") ||
			strings.HasSuffix(path, ".woff") ||
			strings.HasSuffix(path, ".woff2") {
			c.Status(http.StatusNotFound)
			return
		}

		// Serve embedded index.html for client-side routing
		data, err := webUIFS.ReadFile("web_ui_dist/index.html")
		if err != nil {
			c.String(http.StatusNotFound, "App not found")
			return
		}
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
}

func listServers(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		servers := pm.ListServers()
		c.JSON(http.StatusOK, servers)
	}
}

func createServerWithWorkspace(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Handle multipart form data
		name := c.PostForm("name")
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}

		extensions := []string{}
		if extStr := c.PostForm("extensions"); extStr != "" {
			// Parse extensions JSON string
			if err := json.Unmarshal([]byte(extStr), &extensions); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid extensions format: " + err.Error()})
				return
			}
		}

		githubURL := c.PostForm("github_url")
		zipFilePath := ""

		// Handle file upload if present
		if file, err := c.FormFile("zip_file"); err == nil {
			// Save uploaded file to temporary location
			tempFile := filepath.Join(os.TempDir(), file.Filename)
			if err := c.SaveUploadedFile(file, tempFile); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
				return
			}
			zipFilePath = tempFile
			defer os.Remove(tempFile) // Clean up after use
		}

		server, err := pm.CreateServer(name, "", extensions, zipFilePath, githubURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, server)
	}
}

func createServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateServerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		server, err := pm.CreateServer(req.Name, "", req.Extensions, "", "")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, server)
	}
}

func startServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := pm.StartServer(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		server, _ := pm.GetServer(id)
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Server started",
			"data":    server,
		})
	}
}

func stopServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := pm.StopServer(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		server, _ := pm.GetServer(id)
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Server stopped",
			"data":    server,
		})
	}
}

func restartServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := pm.RestartServer(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		server, _ := pm.GetServer(id)
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Server restarted",
			"data":    server,
		})
	}
}

func deleteServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := pm.DeleteServer(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Server deleted",
		})
	}
}

func getServerHealth(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		health, err := pm.GetServerHealth(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data":   health,
		})
	}
}

func getServerLogs(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		linesStr := c.DefaultQuery("lines", "50")

		lines, err := strconv.Atoi(linesStr)
		if err != nil {
			lines = 50
		}

		logs, err := pm.GetServerLogs(id, lines)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data":   gin.H{"logs": logs},
		})
	}
}

func refreshServerStatus(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		pm.mutex.Lock()
		server, exists := pm.servers[id]
		if !exists {
			pm.mutex.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
			return
		}

		oldStatus := server.Status
		pidExists := server.PID != nil
		var pidStatus string
		var healthzStatus string
		var isHealthy bool

		// Check PID status
		if pidExists {
			pidStatus = fmt.Sprintf("PID %d exists", *server.PID)
		} else {
			pidStatus = "No PID"
		}

		// Check HTTP health endpoint
		if pidExists {
			isHealthy = pm.isServerHealthy(server.Port)
			if isHealthy {
				healthzStatus = fmt.Sprintf("Health endpoint responding on port %d", server.Port)
			} else {
				healthzStatus = fmt.Sprintf("Health endpoint not responding on port %d", server.Port)
			}
		} else {
			healthzStatus = "No process to check"
			isHealthy = false
		}

		// Determine new status
		var newStatus ServerStatus
		if pidExists {
			if isHealthy {
				newStatus = StatusRunning
			} else {
				newStatus = StatusStopped
			}
		} else {
			newStatus = StatusStopped
		}

		// Update status if changed
		updated := false
		if server.Status != newStatus {
			server.Status = newStatus
			pm.saveServers()
			pm.logger.LogProcessEvent(id, server.Name, "STATUS_REFRESHED",
				fmt.Sprintf("Status updated from %s to %s (PID: %s, Health: %s)",
					oldStatus, newStatus, pidStatus, healthzStatus))
			updated = true
		}

		pm.mutex.Unlock()

		c.JSON(http.StatusOK, gin.H{
			"status":         "success",
			"id":             id,
			"name":           server.Name,
			"port":           server.Port,
			"old_status":     oldStatus,
			"new_status":     newStatus,
			"pid_status":     pidStatus,
			"healthz_status": healthzStatus,
			"updated":        updated,
		})
	}
}

func refreshAllServersStatus(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		pm.mutex.Lock()
		defer pm.mutex.Unlock()

		updated := 0
		total := len(pm.servers)
		serverDetails := make([]gin.H, 0, total)

		for id, server := range pm.servers {
			oldStatus := server.Status
			pidExists := server.PID != nil
			var pidStatus string
			var healthzStatus string
			var isHealthy bool

			// Check PID status
			if pidExists {
				pidStatus = fmt.Sprintf("PID %d exists", *server.PID)
			} else {
				pidStatus = "No PID"
			}

			// Check HTTP health endpoint
			if pidExists {
				isHealthy = pm.isServerHealthy(server.Port)
				if isHealthy {
					healthzStatus = fmt.Sprintf("Health endpoint responding on port %d", server.Port)
				} else {
					healthzStatus = fmt.Sprintf("Health endpoint not responding on port %d", server.Port)
				}
			} else {
				healthzStatus = "No process to check"
				isHealthy = false
			}

			// Determine new status
			var newStatus ServerStatus
			if pidExists {
				if isHealthy {
					newStatus = StatusRunning
				} else {
					newStatus = StatusStopped
				}
			} else {
				newStatus = StatusStopped
			}

			// Create detailed server info
			serverDetail := gin.H{
				"id":             id,
				"name":           server.Name,
				"port":           server.Port,
				"old_status":     oldStatus,
				"new_status":     newStatus,
				"pid_status":     pidStatus,
				"healthz_status": healthzStatus,
				"updated":        false,
			}

			// Update status if changed
			if server.Status != newStatus {
				server.Status = newStatus
				updated++
				serverDetail["updated"] = true
				pm.logger.LogProcessEvent(id, server.Name, "STATUS_REFRESHED",
					fmt.Sprintf("Status updated from %s to %s (PID: %s, Health: %s)",
						oldStatus, newStatus, pidStatus, healthzStatus))
			}

			serverDetails = append(serverDetails, serverDetail)
		}

		// Save changes if any updates
		if updated > 0 {
			pm.saveServers()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":        "success",
			"total_servers": total,
			"updated":       updated,
			"message":       fmt.Sprintf("Updated %d out of %d servers", updated, total),
			"servers":       serverDetails,
		})
	}
}

// Multi-step server creation handlers
func createServerMetadata(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateServerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create server metadata only (no extensions, no workspace initialization)
		server, err := pm.CreateServerMetadata(req.Name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, server)
	}
}

func installServerExtensions(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Extensions []string `json:"extensions"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := pm.InstallExtensionsForServer(id, req.Extensions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		server, _ := pm.GetServer(id)
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Extensions installed",
			"data":    server,
		})
	}
}

func cloneServerWorkspace(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Handle multipart form data
		githubURL := c.PostForm("github_url")
		zipFilePath := ""

		// Handle file upload if present
		if file, err := c.FormFile("zip_file"); err == nil {
			// Save uploaded file to temporary location
			tempFile := filepath.Join(os.TempDir(), file.Filename)
			if err := c.SaveUploadedFile(file, tempFile); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
				return
			}
			zipFilePath = tempFile
			defer os.Remove(tempFile) // Clean up after use
		}

		if githubURL == "" && zipFilePath == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Either github_url or zip_file must be provided"})
			return
		}

		if err := pm.InitializeWorkspaceForServer(id, zipFilePath, githubURL); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		server, _ := pm.GetServer(id)
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Workspace initialized",
			"data":    server,
		})
	}
}

// proxyToCodeServer is defined in proxy.go
