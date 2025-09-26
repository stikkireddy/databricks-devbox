package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

func proxyToCodeServer(pm *ProcessManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		portStr := c.Param("port")
		path := c.Param("path")
		fmt.Printf("DEBUG: Proxy request - port: %s, path: %s, method: %s, url: %s\n", portStr, path, c.Request.Method, c.Request.URL.String())

		// Intercept VS Code favicon requests and serve our embedded logo
		if path == "/_static/src/browser/media/favicon.ico" {
			fmt.Printf("DEBUG: Intercepting VS Code favicon.ico request\n")
			serveEmbeddedLogo(c)
			return
		}
		if path == "/_static/src/browser/media/favicon-dark-support.svg" {
			fmt.Printf("DEBUG: Intercepting VS Code favicon-dark-support.svg request\n")
			serveEmbeddedLogoAsSVG(c)
			return
		}

		port, err := strconv.Atoi(portStr)
		if err != nil {
			fmt.Printf("DEBUG: Invalid port: %s\n", portStr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid port"})
			return
		}

		// Find the server with this port (like Python version)
		server, err := pm.GetServerByPort(port)
		if err != nil || server.Status != StatusRunning {
			fmt.Printf("DEBUG: Server not found or not running - err: %v, status: %v\n", err, server)
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("No running server found on port %d", port)})
			return
		}

		fmt.Printf("DEBUG: Server found - %s on port %d, status: %s\n", server.Name, server.Port, server.Status)

		// Check if this is a WebSocket upgrade request
		if isWebSocketRequest(c.Request) {
			fmt.Printf("DEBUG: WebSocket request detected\n")
			handleWebSocketProxy(c, port)
			return
		}

		// Handle regular HTTP proxy with transparent headers
		fmt.Printf("DEBUG: HTTP proxy request\n")
		handleHTTPProxy(c, port)
	}
}

func isWebSocketRequest(r *http.Request) bool {
	return strings.ToLower(r.Header.Get("Connection")) == "upgrade" &&
		strings.ToLower(r.Header.Get("Upgrade")) == "websocket"
}

func handleWebSocketProxy(c *gin.Context, targetPort int) {
	// Upgrade the client connection
	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer clientConn.Close()

	// Connect to target WebSocket server
	targetURL := "ws://127.0.0.1:" + strconv.Itoa(targetPort) + c.Request.URL.Path
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	targetConn, _, err := websocket.DefaultDialer.Dial(targetURL, nil)
	if err != nil {
		clientConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to target"))
		return
	}
	defer targetConn.Close()

	// Proxy messages bidirectionally
	done := make(chan struct{})
	var closeOnce sync.Once

	// Client to target
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				return
			}
			if err := targetConn.WriteMessage(messageType, message); err != nil {
				return
			}
		}
	}()

	// Target to client
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			messageType, message, err := targetConn.ReadMessage()
			if err != nil {
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				return
			}
		}
	}()

	<-done
}

func handleHTTPProxy(c *gin.Context, targetPort int) {
	// Get the path that should be proxied (strip /vscode/{port} prefix)
	path := c.Param("path")

	// Build the correct target URL - just the base server URL
	targetURL := fmt.Sprintf("http://127.0.0.1:%d", targetPort)

	fmt.Printf("DEBUG HTTP PROXY: Original path: %s, Extracted path: %s, Target URL: %s\n", c.Request.URL.Path, path, targetURL)

	// Parse target URL
	target, err := url.Parse(targetURL)
	if err != nil {
		fmt.Printf("DEBUG HTTP PROXY: URL parse error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid target URL"})
		return
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Customize the director to modify the request path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.URL.Host = target.Host
		req.URL.Scheme = target.Scheme

		// Set the correct path (the extracted path, not the original /vscode/{port}/path)
		if path != "" {
			req.URL.Path = path
		} else {
			req.URL.Path = "/"
		}

		fmt.Printf("DEBUG HTTP PROXY: Final request URL: %s, Host: %s\n", req.URL.String(), req.Host)

		// Remove the host header to avoid conflicts (like Python version)
		req.Header.Del("Host")
	}

	// Handle the proxy
	proxy.ServeHTTP(c.Writer, c.Request)
}
