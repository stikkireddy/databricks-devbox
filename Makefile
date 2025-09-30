.PHONY: install run dev backend frontend clean build build-go build-all build-release docs docs-serve docs-build docs-deploy help

# Install all dependencies (Python + Node.js)
install:
	uv sync
	cd web_ui && npm install

# Run the complete application in development mode (frontend + backend)
run: install
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8005"
	@echo "Frontend: http://localhost:3000"
	@make -j2 backend frontend

# Development mode - same as run
dev: run

# Build the Go binary for current platform into build folder
build-go: build
	@echo "Building Go binary for current platform..."
	@mkdir -p build
	@cp web_ui/public/logo.png databricks_devbox_go/logo.png
	@cp -r web_ui/dist databricks_devbox_go/web_ui_dist
	cd databricks_devbox_go && go fmt && go build -ldflags="-s -w" -o ../build/databricks-devbox
	@chmod +x build/databricks-devbox

# Build Go binaries for all supported platforms
build-all: build
	@echo "Building for all platforms..."
	@mkdir -p build
	@cp web_ui/public/logo.png databricks_devbox_go/logo.png
	@rm -rf databricks_devbox_go/web_ui_dist
	@cp -r web_ui/dist databricks_devbox_go/web_ui_dist
	cd databricks_devbox_go && go fmt
	cd databricks_devbox_go && GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../build/databricks-devbox-windows-amd64.exe
	cd databricks_devbox_go && GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o ../build/databricks-devbox-darwin-arm64
	cd databricks_devbox_go && GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ../build/databricks-devbox-linux-amd64
	cd databricks_devbox_go && GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ../build/databricks-devbox-linux-arm64
	@chmod +x build/databricks-devbox-*
	@echo "Built binaries in ./build/ directory:"
	@ls -la build/

# Build optimized release binaries
build-release: build
	@echo "Building optimized release binaries..."
	@mkdir -p build
	@rm -rf databricks_devbox_go/web_ui_dist
	@cp web_ui/public/logo.png databricks_devbox_go/logo.png
	@cp -r web_ui/dist databricks_devbox_go/web_ui_dist
	cd databricks_devbox_go && go fmt
	cd databricks_devbox_go && GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -X main.version=$$(date +%Y.%m.%d)" -o ../build/databricks-devbox-windows-amd64.exe
	cd databricks_devbox_go && GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w -X main.version=$$(date +%Y.%m.%d)" -o ../build/databricks-devbox-darwin-arm64
	cd databricks_devbox_go && GOOS=linux GOARCH=amd64 go build -ldflags="-s -w -X main.version=$$(date +%Y.%m.%d)" -o ../build/databricks-devbox-linux-amd64
	cd databricks_devbox_go && GOOS=linux GOARCH=arm64 go build -ldflags="-s -w -X main.version=$$(date +%Y.%m.%d)" -o ../build/databricks-devbox-linux-arm64
	@chmod +x build/databricks-devbox-*
	@echo "Built release binaries in ./build/ directory:"
	@ls -la build/

# Run only the backend (port 8005) - Go version with built frontend
backend: build-release
	uv run app/app.py

# Run only the React frontend (port 3000)
frontend: install
	cd web_ui && npm run dev

# Build the React app for production
build: install
	cd web_ui && npm run build

# Run the production application (backend serves built frontend)
prod: build-release
	python app/app.py

# Documentation commands
docs-serve:
	@echo "Starting documentation server..."
	@echo "Documentation will be available at http://127.0.0.1:8000"
	uv run python -m mkdocs serve

docs-build:
	@echo "Building documentation..."
	uv run python -m mkdocs build
	@echo "Documentation built to ./site/"

docs-deploy:
	@echo "Deploying documentation to GitHub Pages..."
	uv run python -m mkdocs gh-deploy

docs: docs-serve

# Clean up build artifacts and cache
clean:
	rm -rf __pycache__/
	rm -rf **/__pycache__/
	rm -rf .pytest_cache/
	rm -rf data/
	rm -rf logs/
	rm -rf workspace/
	rm -rf web_ui/node_modules/
	rm -rf web_ui/dist/
	rm -rf build/
	rm -rf site/
	rm -f databricks_devbox_go/databricks-devbox-*
	rm -f databricks_devbox_go/logo.png
	rm -rf databricks_devbox_go/web_ui_dist

# Show help
help:
	@echo "Available commands:"
	@echo "  install      - Install all dependencies (Python + Node.js)"
	@echo "  run          - Run development servers (Go backend on :8005, frontend on :3000)"
	@echo "  dev          - Same as 'run' command"
	@echo "  build-all    - Build Go binaries for all supported platforms"
	@echo "  build-release- Build optimized release binaries with version info"
	@echo "  backend      - Run only Go backend server (port 8005)"
	@echo "  frontend     - Run only React frontend dev server (port 3000)"
	@echo "  build        - Build React app for production"
	@echo "  prod         - Run production server (backend serves built frontend)"
	@echo "  docs         - Serve documentation with live reload (http://127.0.0.1:8000)"
	@echo "  docs-serve   - Same as 'docs' command"
	@echo "  docs-build   - Build static documentation site to ./site/"
	@echo "  docs-deploy  - Deploy documentation to GitHub Pages"
	@echo "  clean        - Clean up build artifacts and dependencies"
	@echo "  help         - Show this help message"