# Databricks DevBox

A powerful web-based development environment management platform that brings VS Code to your browser, powered by code-server and optimized for Databricks workflows.

## What is Databricks DevBox?

Databricks DevBox is a Go-based server application that manages multiple code-server instances, allowing you to create isolated development environments with custom extensions, configurations, and workspace setups. It's designed to be deployed as a Databricks Lakehouse App, providing developers with instant access to cloud-based IDEs directly within their Databricks workspace.

## Key Features

### 🚀 Instant Development Environments
Create and launch isolated code-server instances in seconds with pre-configured extension groups for Python, Jupyter, Databricks, and more.

### 🤖 AI-Powered Coding Assistants
Built-in support for multiple vibe coding tools:

- **Claude Code**: Anthropic's AI coding assistant
- **Claude Code Router (CCR)**: Proxy for Databricks-hosted AI models
- **OpenAI Codex**: GitHub Copilot-style code completion
- **Google Gemini**: Google's generative AI assistant

### 📦 Workspace Templates
Quick-start templates for common scenarios:

- Databricks Workshops
- Python Data Science projects
- Machine Learning experiments
- Custom GitHub repository cloning

### 📊 Real-time Monitoring
Track server health, CPU usage, memory consumption, and uptime for all running instances through a modern React-based UI.

### 🔒 Enterprise Security
- Databricks SDK authentication
- Auto-generated tokens with configurable expiry
- Unity Catalog integration
- Isolated workspaces per instance

## Architecture Overview

```
User Browser → React Web UI → Go Server (port 8000)
                                    ↓
                          ┌─────────┴─────────┐
                          ↓                   ↓
                    code-server         code-server
                    (port 8010)         (port 8011)
                          ↓                   ↓
                    Workspace 1         Workspace 2
```

The system consists of three main components:

1. **Go Server** (`databricks_devbox_go/`): Core server managing code-server processes, routing, and lifecycle
2. **Python Wrapper** (`app/`): Handles Databricks App deployment, token management, and vibe coding tools setup
3. **Web UI** (`web_ui/`): React-based interface for managing servers

## Quick Start

### As a Databricks App (Recommended)

1. Copy the `app/` folder to your Databricks workspace
2. Create a Databricks App from the workspace
3. The app automatically downloads required binaries (Go server, code-server, Databricks CLI)
4. Access the UI through your Databricks App URL

See the [full documentation](https://databricks-devbox.dev) for detailed deployment instructions.

### Local Development

```bash
# Install dependencies
make install

# Run development servers (frontend + backend)
make run

# Access the application
# - Backend + Frontend: http://localhost:8005
# - Frontend dev server: http://localhost:3000
```

## Available Commands

```bash
make install          # Install all dependencies (Python + Node.js)
make run             # Run development servers (backend + frontend)
make dev             # Same as 'run' command
make build-go        # Build Go binary for current platform
make build-all       # Build Go binaries for all supported platforms
make build-release   # Build optimized release binaries with version info
make backend         # Run only Go backend server (port 8005)
make frontend        # Run only React frontend dev server (port 3000)
make build           # Build React app for production
make prod            # Run production server (backend serves built frontend)
make docs            # Serve documentation with live reload
make docs-serve      # Same as 'docs' command
make docs-build      # Build static documentation site to ./site/
make docs-deploy     # Deploy documentation to GitHub Pages
make clean           # Clean up build artifacts and dependencies
make help            # Show help message
```

## Usage

### Creating a Server

1. Click "New Server" in the UI
2. Enter server name, port, and workspace settings
3. Select extension groups (Python, Jupyter, Databricks, etc.)
4. Choose a workspace template (optional)
5. Click "Create Server"
6. Start the server using the "Start" button

### Managing Servers

- **Start**: Launch a stopped server
- **Stop**: Gracefully stop a running server
- **Restart**: Stop and start a server
- **Delete**: Remove server configuration
- **Open**: Access the VS Code interface in browser

### Monitoring

The application provides real-time monitoring of:

- Server status (running/stopped/error)
- CPU usage percentage
- Memory consumption
- Process uptime
- System-wide metrics

## API Endpoints

- `GET /servers` - List all servers
- `POST /servers` - Create new server
- `POST /servers/{id}/start` - Start server
- `POST /servers/{id}/stop` - Stop server
- `POST /servers/{id}/restart` - Restart server
- `DELETE /servers/{id}` - Delete server
- `GET /servers/{id}/health` - Get server health
- `GET /servers/{id}/logs` - Get server logs
- `WS /ws/logs/{id}` - WebSocket for real-time log streaming

## Configuration

### devbox.yaml

The `app/devbox.yaml` file configures:

- Extension groups (sets of VS Code extensions)
- Workspace templates (GitHub repos or local templates)
- Port ranges for code-server instances
- Default settings

Example:

```yaml
extension_groups:
  python:
    - ms-python.python
    - ms-python.vscode-pylance

workspace_templates:
  - name: "Python Data Science"
    type: "git"
    url: "https://github.com/example/data-science-template"
```

See the [configuration documentation](https://databricks-devbox.dev/configuration/devbox-yaml/) for full reference.

## What Makes It Different?

### Not VS Code Desktop

Databricks DevBox uses **code-server**, which is an open-source fork of VS Code that runs in the browser. This means:

- **Web-based**: Access from any device
- **No installation**: Works immediately in browser
- **Remote execution**: Code runs on server
- **Different marketplace**: Uses Open VSX instead of Microsoft's marketplace

### Multi-Instance Management

Unlike running a single code-server instance, Databricks DevBox:

- Manages multiple isolated instances
- Provides dynamic port allocation
- Includes health monitoring and auto-restart
- Offers a web UI for lifecycle management

## Use Cases

1. **Training & Workshops**: Deploy pre-configured development environments for Databricks training sessions
2. **Remote Development**: Provide team members with consistent, cloud-based IDEs
3. **AI-Assisted Coding**: Leverage multiple AI coding assistants (Claude Code, Codex, Gemini)
4. **VS Code-Like Development**: Full-featured IDE with extensions, terminal, debugging, and Git

## System Requirements

### For Databricks App
- Databricks Workspace (AWS, Azure, or GCP)
- Unity Catalog enabled (recommended)
- Databricks Runtime 13.3 LTS or higher

### For Local Development
- Python 3.11+
- Go 1.21+ (for building from source)
- Node.js 18+ (for web UI development)
- uv package manager

## Documentation

Full documentation is available at [https://databricks-devbox.dev](https://databricks-devbox.dev)

Topics covered:
- Installation (Databricks App & Local)
- Architecture & Components
- Configuration & Extension Groups
- AI Coding Assistants Setup
- Authentication & Security
- API Reference

## Development

For development with separate frontend and backend:

```bash
# Terminal 1: Backend only
make backend

# Terminal 2: Frontend only
make frontend
```

## Community & Support

- **GitHub**: [stikkireddy/databricks-devbox](https://github.com/stikkireddy/databricks-devbox)
- **Issues**: [Report bugs or request features](https://github.com/stikkireddy/databricks-devbox/issues)
- **Documentation**: [https://databricks-devbox.dev](https://databricks-devbox.dev)
- **Contributions**: Pull requests welcome!

## License

MIT License - see LICENSE file for details.
