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

// coalesce returns the first non-empty string from the given arguments
func coalesce(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
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

		// Check if this is a Streamlit proxy request - route directly to Streamlit
		if strings.Contains(path, "/proxy/") && strings.Contains(path, "_stcore") {
			fmt.Printf("DEBUG: Streamlit proxy request detected, routing directly\n")
			// Extract the target port from the path: /proxy/{port}/...
			parts := strings.Split(path, "/")
			if len(parts) >= 3 && parts[1] == "proxy" {
				if streamlitPort, err := strconv.Atoi(parts[2]); err == nil {
					// Remove /proxy/{port} from the path
					streamlitPath := "/" + strings.Join(parts[3:], "/")

					if isWebSocketRequest(c.Request) {
						fmt.Printf("DEBUG: Streamlit WebSocket request, connecting directly to port %d, path: %s\n", streamlitPort, streamlitPath)
						handleStreamlitWebSocketProxy(c, streamlitPort, streamlitPath)
						return
					} else {
						fmt.Printf("DEBUG: Streamlit HTTP request, connecting directly to port %d, path: %s\n", streamlitPort, streamlitPath)
						handleStreamlitHTTPProxy(c, streamlitPort, streamlitPath)
						return
					}
				}
			}
		}

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
	// Get the path that should be proxied (strip /vscode/{port} prefix)
	path := c.Param("path")

	// Determine if incoming request is secure (HTTPS/WSS)
	scheme := "ws"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" || c.Request.Header.Get("X-Forwarded-Ssl") == "on" {
		scheme = "ws" // Backend connections are always plain WS to localhost
	}

	// Build the correct target WebSocket URL (always WS to localhost backend)
	var targetURL string
	if path != "" {
		targetURL = "ws://127.0.0.1:" + strconv.Itoa(targetPort) + path
	} else {
		targetURL = "ws://127.0.0.1:" + strconv.Itoa(targetPort) + "/"
	}

	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	fmt.Printf("DEBUG WS PROXY: Connecting to WebSocket at: %s (client scheme: %s)\n", targetURL, scheme)

	// Check if this is a Streamlit-specific path that needs enhanced handling
	isStreamlitPath := strings.Contains(path, "_stcore/stream")

	// Create headers for the target connection
	headers := http.Header{}

	// For Streamlit paths, forward safe WebSocket headers (avoid auto-managed ones)
	if isStreamlitPath {
		// For localhost backend connections, use localhost origin to avoid CORS issues
		headers.Set("Origin", "http://localhost:"+strconv.Itoa(targetPort))
		// Note: Don't set Sec-Websocket-Protocol and Sec-Websocket-Extensions manually
		// as the Go websocket library manages these automatically
		if cookie := c.Request.Header.Get("Cookie"); cookie != "" {
			headers.Set("Cookie", cookie)
		}
		if userAgent := c.Request.Header.Get("User-Agent"); userAgent != "" {
			headers.Set("User-Agent", userAgent)
		}
	}

	// Create upgrader - use enhanced version for Streamlit, basic for others
	var clientUpgrader websocket.Upgrader
	if isStreamlitPath {
		clientUpgrader = websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
			Subprotocols: websocket.Subprotocols(c.Request),
		}
	} else {
		clientUpgrader = websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		}
	}

	// Upgrade the client connection
	clientConn, err := clientUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("DEBUG WS PROXY: Failed to upgrade client connection: %v\n", err)
		return
	}
	defer clientConn.Close()

	// Connect to target WebSocket server
	dialer := websocket.DefaultDialer
	targetConn, resp, err := dialer.Dial(targetURL, headers)
	if err != nil {
		fmt.Printf("DEBUG WS PROXY: Failed to connect to target WebSocket: %v (response: %+v)\n", err, resp)
		clientConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to target"))
		return
	}
	defer targetConn.Close()

	fmt.Printf("DEBUG WS PROXY: Successfully connected to target WebSocket (Streamlit-enhanced: %v)\n", isStreamlitPath)

	// Proxy messages bidirectionally
	done := make(chan struct{})
	var closeOnce sync.Once

	// Client to target
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				if !websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("DEBUG WS PROXY: Client connection closed normally\n")
				} else {
					fmt.Printf("DEBUG WS PROXY: Error reading from client: %v\n", err)
				}
				return
			}
			if err := targetConn.WriteMessage(messageType, message); err != nil {
				fmt.Printf("DEBUG WS PROXY: Error writing to target: %v\n", err)
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
				if !websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("DEBUG WS PROXY: Target connection closed normally\n")
				} else {
					fmt.Printf("DEBUG WS PROXY: Error reading from target: %v\n", err)
				}
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				fmt.Printf("DEBUG WS PROXY: Error writing to client: %v\n", err)
				return
			}
		}
	}()

	<-done
	fmt.Printf("DEBUG WS PROXY: WebSocket proxy connection closed\n")
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

		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}

		// Set critical nginx-style proxy headers for WebSocket support
		req.Header.Set("X-Forwarded-For", coalesce(c.Request.Header.Get("X-Forwarded-For"), c.ClientIP()))
		req.Header.Set("X-Forwarded-Host", coalesce(c.Request.Header.Get("X-Forwarded-Host"), c.Request.Host))
		req.Header.Set("X-Forwarded-Preferred-Username", c.Request.Header.Get("X-Forwarded-Preferred-Username"))
		req.Header.Set("X-Forwarded-Proto", scheme)
		req.Header.Set("Host", target.Host)

		// Critical WebSocket headers for upgrade support
		if c.Request.Header.Get("Upgrade") != "" {
			req.Header.Set("Upgrade", c.Request.Header.Get("Upgrade"))
			req.Header.Set("Connection", "upgrade")
		}

		// Set target URL properties
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host

		// Set the path (preserve the path after /_proxy/{port})
		if path != "" {
			req.URL.Path = path
		} else {
			req.URL.Path = "/"
		}

		fmt.Printf("DEBUG HTTP PROXY: Final request URL: %s, Host: %s\n", req.URL.String(), req.Host)
	}

	// Handle the proxy
	proxy.ServeHTTP(c.Writer, c.Request)
}

func handleStreamlitWebSocketProxy(c *gin.Context, targetPort int, targetPath string) {
	// Determine if incoming request is secure (HTTPS/WSS) - but always connect plain WS to localhost backend
	clientScheme := "ws"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" || c.Request.Header.Get("X-Forwarded-Ssl") == "on" {
		clientScheme = "wss"
	}

	// Build the correct target WebSocket URL directly to Streamlit (always WS to localhost)
	targetURL := "ws://127.0.0.1:" + strconv.Itoa(targetPort) + targetPath
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	fmt.Printf("DEBUG STREAMLIT WS: Connecting directly to WebSocket at: %s (client using: %s)\n", targetURL, clientScheme)

	// Create headers for the target connection with Streamlit-specific headers
	headers := http.Header{}
	// For localhost backend connections, use localhost origin to avoid CORS issues
	headers.Set("Origin", "http://localhost:"+strconv.Itoa(targetPort))
	if cookie := c.Request.Header.Get("Cookie"); cookie != "" {
		headers.Set("Cookie", cookie)
	}
	if userAgent := c.Request.Header.Get("User-Agent"); userAgent != "" {
		headers.Set("User-Agent", userAgent)
	}

	// Create upgrader with Streamlit subprotocol support
	clientUpgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
		Subprotocols: websocket.Subprotocols(c.Request),
	}

	// Upgrade the client connection
	clientConn, err := clientUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Printf("DEBUG STREAMLIT WS: Failed to upgrade client connection: %v\n", err)
		return
	}
	defer clientConn.Close()

	// Connect to Streamlit WebSocket server
	dialer := websocket.DefaultDialer
	targetConn, resp, err := dialer.Dial(targetURL, headers)
	if err != nil {
		fmt.Printf("DEBUG STREAMLIT WS: Failed to connect to Streamlit WebSocket: %v (response: %+v)\n", err, resp)
		clientConn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to Streamlit"))
		return
	}
	defer targetConn.Close()

	fmt.Printf("DEBUG STREAMLIT WS: Successfully connected to Streamlit WebSocket\n")

	// Proxy messages bidirectionally
	done := make(chan struct{})
	var closeOnce sync.Once

	// Client to target
	go func() {
		defer closeOnce.Do(func() { close(done) })
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				if !websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("DEBUG STREAMLIT WS: Client connection closed normally\n")
				} else {
					fmt.Printf("DEBUG STREAMLIT WS: Error reading from client: %v\n", err)
				}
				return
			}
			if err := targetConn.WriteMessage(messageType, message); err != nil {
				fmt.Printf("DEBUG STREAMLIT WS: Error writing to Streamlit: %v\n", err)
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
				if !websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					fmt.Printf("DEBUG STREAMLIT WS: Streamlit connection closed normally\n")
				} else {
					fmt.Printf("DEBUG STREAMLIT WS: Error reading from Streamlit: %v\n", err)
				}
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				fmt.Printf("DEBUG STREAMLIT WS: Error writing to client: %v\n", err)
				return
			}
		}
	}()

	<-done
	fmt.Printf("DEBUG STREAMLIT WS: Streamlit WebSocket proxy connection closed\n")
}

func handleStreamlitHTTPProxy(c *gin.Context, targetPort int, targetPath string) {
	// Build the correct target URL directly to Streamlit
	targetURL := fmt.Sprintf("http://0.0.0.0:%d", targetPort)

	fmt.Printf("DEBUG STREAMLIT HTTP: Connecting directly to Streamlit at: %s, path: %s\n", targetURL, targetPath)

	// Parse target URL
	target, err := url.Parse(targetURL)
	if err != nil {
		fmt.Printf("DEBUG STREAMLIT HTTP: URL parse error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid target URL"})
		return
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Customize the director to set headers and path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}

		// Set nginx-style proxy headers
		req.Header.Set("X-Forwarded-For", coalesce(c.Request.Header.Get("X-Forwarded-For"), c.ClientIP()))
		req.Header.Set("X-Forwarded-Host", coalesce(c.Request.Header.Get("X-Forwarded-Host"), c.Request.Host))
		req.Header.Set("X-Forwarded-Preferred-Username", c.Request.Header.Get("X-Forwarded-Preferred-Username"))
		req.Header.Set("X-Forwarded-Proto", scheme)
		req.Header.Set("Host", target.Host)

		// Critical WebSocket headers for upgrade support
		if c.Request.Header.Get("Upgrade") != "" {
			req.Header.Set("Upgrade", c.Request.Header.Get("Upgrade"))
			req.Header.Set("Connection", "upgrade")
		}

		// Set target URL properties
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path = targetPath

		fmt.Printf("DEBUG STREAMLIT HTTP: Final request URL: %s, Host: %s\n", req.URL.String(), req.Host)
	}

	// Handle the proxy
	proxy.ServeHTTP(c.Writer, c.Request)
}
