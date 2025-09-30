# Local Development Setup

Run Databricks DevBox locally for development and testing.

## Prerequisites

- **Python 3.11+**
- **Go 1.21+** (if building from source)
- **Node.js 18+** and **pnpm** (for web UI development)
- **uv** package manager

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/stikkireddy/databricks-devbox.git
cd databricks-devbox
```

### 2. Install Python Dependencies

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync
```

### 3. Build or Download Go Binary

#### Option A: Download Pre-built Binary

```bash
make download-binary
```

#### Option B: Build from Source

```bash
# Requires Go 1.21+
make build-go
```

### 4. Run the Server

```bash
# Run complete application
make run

# Or run Go server directly
./build/databricks-devbox-<os>-<arch>
```

The server will start on `http://localhost:8000`

## Development Mode

For active development with hot-reload:

### Backend Development

```bash
# Terminal 1: Run Go server with auto-restart
go run databricks_devbox_go/*.go
```

### Frontend Development

```bash
# Terminal 2: Run web UI dev server
cd web_ui
pnpm install
pnpm dev
```

Web UI runs on `http://localhost:5173` with hot module replacement.

## Configuration

### Local devbox.yaml

Create or modify `app/devbox.yaml` for local testing:

```yaml
extension_groups:
  python:
    name: "Python"
    extensions:
      - "ms-python.python"

server:
  default_port: 8000
  code_server_port_range:
    start: 8010
    end: 8100

ui:
  default_extension_groups:
    - "python"
```

### Environment Variables

Set these in your shell or `.env` file:

```bash
# Server port (default: 8005, overridden by DEVBOX_SERVER_PORT)
export DEVBOX_SERVER_PORT=8000

# Config file path
export DEVBOX_CONFIG_PATH=./app/devbox.yaml

# Code-server version
export CODE_SERVER_VERSION=4.104.1

# Binary version (for downloads)
export LHA_SERVER_VERSION=0.1.0
```

## Build Options

### Build Go Server

```bash
# Build for current platform
make build-go

# Build for all platforms
make build-all

# Output: build/databricks-devbox-<os>-<arch>
```

### Build Web UI

```bash
# Build production web UI
make build-ui

# Output: web_ui/dist/
```

### Build Everything

```bash
# Build Go server + Web UI
make build
```

## Testing

### Run Tests

```bash
# Go tests
cd databricks_devbox_go
go test ./...

# Frontend tests (if available)
cd web_ui
pnpm test
```

## Docker Development (Optional)

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  devbox:
    build: .
    ports:
      - "8000:8000"
      - "8010-8100:8010-8100"
    volumes:
      - ./data:/app/data
      - ./workspace:/app/workspace
    environment:
      - DEVBOX_CONFIG_PATH=/app/devbox.yaml
```

Run:

```bash
docker-compose up
```

## Directory Structure

```
databricks-devbox/
├── app/                          # Databricks App files
│   ├── app.py                   # Python entry point
│   ├── vibe_code.py             # Vibe coding tools
│   └── devbox.yaml              # Configuration
├── databricks_devbox_go/        # Go server source
│   ├── main.go
│   ├── process_manager.go
│   ├── routes.go
│   ├── config.go
│   └── ...
├── web_ui/                      # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── build/                       # Compiled binaries
├── data/                        # Runtime data
│   ├── servers.json
│   └── <server-id>/
├── workspace/                   # Code-server workspaces
├── logs/                        # Server logs
└── Makefile
```

## Makefile Commands

```bash
# Installation
make install          # Install Python deps with uv

# Building
make build-go        # Build Go server
make build-ui        # Build web UI
make build-all       # Build for all platforms

# Running
make run             # Run the application

# Cleaning
make clean           # Remove build artifacts
make clean-all       # Remove all generated files

# Help
make help            # Show all commands
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Go Binary Not Found

```bash
# Build manually
cd databricks_devbox_go
go build -o ../build/databricks-devbox

# Or download
curl -L https://github.com/stikkireddy/databricks-devbox/releases/latest/download/databricks-devbox-<os>-<arch> -o build/databricks-devbox
chmod +x build/databricks-devbox
```

### Code-Server Not Installing

Manually install code-server:

```bash
# macOS/Linux
curl -fsSL https://code-server.dev/install.sh | sh

# Or using npm
npm install -g code-server
```

### Vibe Coding Tools (Optional for Local)

Local setup doesn't require vibe coding tools, but you can install them:

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @musistudio/claude-code-router
npm install -g @openai/codex
npm install -g @google/gemini-cli
```

## IDE Setup

### VS Code

Recommended extensions:

```json
{
  "recommendations": [
    "golang.go",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode"
  ]
}
```

### GoLand / IntelliJ

1. Open `databricks_devbox_go` as Go module
2. Set Go SDK to 1.21+
3. Enable Go modules

## Next Steps

<div class="grid cards" markdown>

- **[Architecture Overview →](../architecture/index.md)**

    Understand the codebase

- **[Configuration →](../configuration/devbox-yaml.md)**

    Customize settings

- **[API Reference →](../api-reference.md)**

    REST API documentation

</div>