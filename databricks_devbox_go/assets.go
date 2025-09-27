package main

import (
	"embed"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Embed the logo.png file into the binary
//
//go:embed logo.png
var logoBytes []byte

// Embed the entire React build directory
//
//go:embed web_ui_dist
var webUIFS embed.FS

// serveEmbeddedLogo serves the embedded logo.png file
func serveEmbeddedLogo(c *gin.Context) {
	if len(logoBytes) == 0 {
		c.String(http.StatusNotFound, "Logo not embedded")
		return
	}

	c.Header("Content-Type", "image/png")
	c.Header("Cache-Control", "public, max-age=86400") // Cache for 1 day
	c.Data(http.StatusOK, "image/png", logoBytes)
}

// serveEmbeddedLogoAsSVG serves the embedded logo as SVG for VS Code dark support
func serveEmbeddedLogoAsSVG(c *gin.Context) {
	// Create a simple SVG that embeds the PNG as base64
	if len(logoBytes) == 0 {
		c.String(http.StatusNotFound, "Logo not embedded")
		return
	}

	// Convert PNG bytes to base64
	logoBase64 := base64.StdEncoding.EncodeToString(logoBytes)

	// Create SVG with embedded PNG
	svgContent := `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="48" height="48" viewBox="0 0 48 48">
		<image href="data:image/png;base64,` + logoBase64 + `" width="48" height="48"/>
	</svg>`

	c.Header("Content-Type", "image/svg+xml")
	c.Header("Cache-Control", "public, max-age=86400") // Cache for 1 day
	c.String(http.StatusOK, svgContent)
}
