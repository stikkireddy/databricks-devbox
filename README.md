# Databricks Devbox

A Python-based web application for managing Devbox instances with real-time monitoring and process control.

## Features

- **Server Management**: Create, start, stop, restart, and delete Devbox instances
- **Real-time Monitoring**: Live health metrics including CPU usage, memory consumption, and uptime
- **Process Control**: Full lifecycle management with process health checking
- **Reactive UI**: Pure Python frontend using Reflex framework
- **WebSocket Updates**: Real-time status updates without page refresh
- **System Metrics**: Monitor overall system CPU, memory, and disk usage

## Architecture

- **Backend**: FastAPI with WebSocket support for real-time communication
- **Frontend**: Reflex (Pure Python reactive UI framework)
- **Process Management**: Python subprocess + psutil for Devbox lifecycle
- **Real-time Updates**: WebSockets for live status monitoring

## Quick Start

### Prerequisites

- Python 3.11+
- uv package manager

### Installation & Running

1. **Install dependencies:**
   ```bash
   make install
   ```

2. **Run the application:**
   ```bash
   make run
   ```

3. **Access the application:**
   - Application UI: http://localhost:3000 (frontend + API on same port)
   - API Documentation: http://localhost:3000/docs

## Available Commands

```bash
make install    # Install dependencies with uv sync
make run        # Run the complete application (frontend + API on port 3000)
make dev        # Run in development mode
make backend    # Run only FastAPI backend server (port 8000)
make frontend   # Run only Reflex frontend (port 3000)
make init       # Initialize Reflex (first-time setup)
make clean      # Clean up build artifacts
make help       # Show available commands
```

## Usage

### Creating a Devbox

1. Click "New Server" in the UI
2. Enter server name, port, and workspace path
3. Click "Create Server"
4. Start the server using the "Start" button

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
- `WS /ws` - WebSocket for real-time updates

## Development

For development with auto-reload:

```bash
# Terminal 1: Backend only
make backend

# Terminal 2: Frontend only
make frontend
```

## Requirements

- **Python 3.11+**: Required for modern async features
- **uv**: Fast Python package manager
- **code-server**: Automatically installed on first server creation

## License

MIT License