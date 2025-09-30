---
hide:
  - navigation
---

# API Reference

Complete REST API documentation for Databricks DevBox.

## Base URL

```
http://localhost:8000
```

Replace `localhost:8000` with your actual server address.

## Health Check

### Get Server Health

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "Databricks Devbox API"
}
```

## Configuration

### Get Configuration

```http
GET /config
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "extension_groups": {...},
    "server": {...},
    "ui": {...},
    "packaged_assets": {...}
  }
}
```

### Get Templates

```http
GET /templates
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "tabs": [
      {
        "name": "Workshops",
        "items": [...]
      }
    ]
  }
}
```

## Server Management

### List Servers

```http
GET /servers
```

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "my-server",
    "port": 8010,
    "workspace_path": "/path/to/workspace",
    "extensions": ["ms-python.python"],
    "status": "running",
    "pid": 12345,
    "start_time": "2025-01-15T10:00:00Z",
    "uptime": 3600.5,
    "cpu_percent": 15.2,
    "memory_mb": 512.3
  }
]
```

### Create Server

```http
POST /servers
Content-Type: application/json

{
  "name": "my-server",
  "extensions": ["ms-python.python", "ms-toolsai.jupyter"]
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "my-server",
  "port": 8010,
  "workspace_path": "/path/to/workspace",
  "extensions": ["ms-python.python", "ms-toolsai.jupyter"],
  "status": "stopped",
  "pid": null
}
```

**Status:** `201 Created`

### Create Server with Workspace

```http
POST /servers/create-with-workspace
Content-Type: multipart/form-data

name=my-server
extensions=["ms-python.python"]
github_url=https://github.com/org/repo.git
# OR
zip_file=<binary>
```

**Response:**

```json
{
  "id": "uuid",
  "name": "my-server",
  "port": 8010,
  "workspace_path": "/path/to/workspace",
  "status": "stopped"
}
```

**Status:** `201 Created`

### Create from Template

```http
POST /servers/create-from-template
Content-Type: application/json

{
  "name": "workshop-server",
  "template_id": "Databricks Workshop",
  "tab_name": "Workshops"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "workshop-server",
  "port": 8010,
  "status": "stopped"
}
```

**Status:** `201 Created`

### Start Server

```http
POST /servers/:id/start
```

**Response:**

```json
{
  "status": "success",
  "message": "Server started",
  "data": {
    "id": "uuid",
    "status": "running",
    "pid": 12345
  }
}
```

### Stop Server

```http
POST /servers/:id/stop
```

**Response:**

```json
{
  "status": "success",
  "message": "Server stopped",
  "data": {
    "id": "uuid",
    "status": "stopped",
    "pid": null
  }
}
```

### Restart Server

```http
POST /servers/:id/restart
```

**Response:**

```json
{
  "status": "success",
  "message": "Server restarted",
  "data": {
    "id": "uuid",
    "status": "running",
    "pid": 12346
  }
}
```

### Delete Server

```http
DELETE /servers/:id
```

**Response:**

```json
{
  "status": "success",
  "message": "Server deleted"
}
```

**Status:** `200 OK`

## Health & Monitoring

### Get Server Health

```http
GET /servers/:id/health
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "status": "running",
    "http_healthy": true,
    "cpu_percent": 15.2,
    "memory_mb": 512.3,
    "uptime_seconds": 3600.5,
    "process_exists": true
  }
}
```

### Get Server Logs

```http
GET /servers/:id/logs?lines=50
```

**Query Parameters:**

- `lines` (optional): Number of lines to return (default: 50)

**Response:**

```json
{
  "status": "success",
  "data": {
    "logs": [
      "[2025-01-15 10:00:00] INFO: Server started",
      "[2025-01-15 10:00:01] INFO: Extensions loaded"
    ]
  }
}
```

### Refresh Server Status

```http
POST /servers/:id/refresh-status
```

**Response:**

```json
{
  "status": "success",
  "id": "uuid",
  "name": "my-server",
  "port": 8010,
  "old_status": "running",
  "new_status": "running",
  "pid_status": "PID 12345 exists",
  "healthz_status": "Health endpoint responding on port 8010",
  "updated": false
}
```

### Refresh All Servers

```http
POST /servers/refresh-all
```

**Response:**

```json
{
  "status": "success",
  "total_servers": 5,
  "updated": 2,
  "message": "Updated 2 out of 5 servers",
  "servers": [...]
}
```

## WebSocket API

### Log Streaming

Connect to WebSocket for real-time log streaming.

**Endpoint:**

```
ws://localhost:8000/ws/logs
```

Or for specific server:

```
ws://localhost:8000/ws/logs/:serverId
```

**Message Format:**

```json
{
  "type": "log",
  "server_id": "uuid",
  "server_name": "my-server",
  "level": "INFO",
  "source": "server",
  "message": "Server started successfully",
  "timestamp": "2025-01-15T10:00:00Z"
}
```

**Example (JavaScript):**

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/logs');

ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(`[${log.level}] ${log.message}`);
};

ws.onopen = () => console.log('Connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

## Proxy Endpoints

### Access code-server

```http
GET /vscode/:port/*path
```

**Example:**

```
http://localhost:8000/vscode/8010/
```

Forwards to code-server instance on port 8010.

## Multi-Step Server Creation

For advanced scenarios, create servers in steps:

### 1. Create Metadata

```http
POST /servers/create-metadata
Content-Type: application/json

{
  "name": "my-server"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "my-server",
  "port": 8010,
  "workspace_path": "/path/to/workspace",
  "extensions": [],
  "status": "stopped"
}
```

### 2. Install Extensions

```http
POST /servers/:id/install-extensions
Content-Type: application/json

{
  "extensions": ["ms-python.python", "ms-toolsai.jupyter"]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Extensions installed",
  "data": {...}
}
```

### 3. Install Single Extension

```http
POST /servers/:id/install-extension
Content-Type: application/json

{
  "extension": "ms-python.python"
}
```

### 4. Apply Group Settings

```http
POST /servers/:id/apply-group-settings
Content-Type: application/json

{
  "groupName": "python"
}
```

### 5. Clone Workspace

```http
POST /servers/:id/clone-workspace
Content-Type: multipart/form-data

github_url=https://github.com/org/repo.git
# OR
zip_file=<binary>
```

### 6. Start Server

```http
POST /servers/:id/start
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid request parameters"
}
```

### 404 Not Found

```json
{
  "error": "Server not found: uuid"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to start server: <reason>"
}
```

## Rate Limiting

Currently, no rate limiting is enforced. This may change in future versions.

## Authentication

- **Databricks App**: Uses Databricks SSO (automatic)
- **Local**: No authentication (development only)

## CORS

CORS is enabled for all origins:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Example Usage

### Python

```python
import requests

BASE_URL = "http://localhost:8000"

# List servers
response = requests.get(f"{BASE_URL}/servers")
servers = response.json()

# Create server
response = requests.post(
    f"{BASE_URL}/servers",
    json={"name": "my-server", "extensions": ["ms-python.python"]}
)
server = response.json()

# Start server
server_id = server["id"]
requests.post(f"{BASE_URL}/servers/{server_id}/start")

# Open in browser
print(f"http://localhost:8000/vscode/{server['port']}/")
```

### JavaScript

```javascript
const BASE_URL = 'http://localhost:8000';

// List servers
const response = await fetch(`${BASE_URL}/servers`);
const servers = await response.json();

// Create server
const createResponse = await fetch(`${BASE_URL}/servers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-server',
    extensions: ['ms-python.python']
  })
});
const server = await createResponse.json();

// Start server
await fetch(`${BASE_URL}/servers/${server.id}/start`, {
  method: 'POST'
});

// Open in browser
window.open(`/vscode/${server.port}/`, '_blank');
```

### cURL

```bash
# List servers
curl http://localhost:8000/servers

# Create server
curl -X POST http://localhost:8000/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"my-server","extensions":["ms-python.python"]}'

# Start server
curl -X POST http://localhost:8000/servers/<uuid>/start

# Get logs
curl http://localhost:8000/servers/<uuid>/logs?lines=100
```

## Next Steps

<div class="grid cards" markdown>

- **[Architecture →](architecture/index.md)**

    Understand the system

- **[Configuration →](configuration/devbox-yaml.md)**

    Customize settings

- **[Installation →](installation/databricks-app.md)**

    Deploy to Databricks

</div>