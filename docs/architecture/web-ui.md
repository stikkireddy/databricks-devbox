# Web UI Architecture

The Databricks DevBox web UI is a modern React application built with TypeScript, Vite, and Tailwind CSS.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **State Management**: React Context + hooks
- **HTTP Client**: Fetch API
- **WebSocket**: Native WebSocket API
- **Icons**: Lucide React

## Project Structure

```
web_ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui base components
│   │   ├── ServerCard.tsx
│   │   ├── CreateServerDialog.tsx
│   │   └── LogViewer.tsx
│   ├── lib/
│   │   ├── api.ts          # API client functions
│   │   └── utils.ts        # Utility functions
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles
├── public/
│   └── logo.png
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Core Components

### 1. Server Card

Displays server information and actions.

```tsx
// ServerCard.tsx
interface ServerCardProps {
  server: ServerInstance;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (port: number) => void;
}

export function ServerCard({ server, ...actions }: ServerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{server.name}</CardTitle>
        <Badge variant={statusVariant(server.status)}>
          {server.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <p>Port: {server.port}</p>
        <p>CPU: {server.cpu_percent?.toFixed(1)}%</p>
        <p>Memory: {server.memory_mb?.toFixed(0)} MB</p>
        <p>Uptime: {formatUptime(server.uptime)}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={() => actions.onStart(server.id)}>Start</Button>
        <Button onClick={() => actions.onStop(server.id)}>Stop</Button>
        <Button onClick={() => actions.onOpen(server.port)}>Open</Button>
      </CardFooter>
    </Card>
  );
}
```

### 2. Create Server Dialog

Modal for creating new servers.

```tsx
// CreateServerDialog.tsx
export function CreateServerDialog({ open, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceConfig>({});

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Server</DialogTitle>
        </DialogHeader>

        <Form onSubmit={handleSubmit}>
          <Input
            label="Server Name"
            value={name}
            onChange={setName}
          />

          <ExtensionGroupSelector
            groups={extensionGroups}
            selected={selectedExtensions}
            onSelect={setSelectedExtensions}
          />

          <WorkspaceSelector
            config={workspace}
            onChange={setWorkspace}
          />

          <Button type="submit">Create</Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Log Viewer

Real-time log streaming component.

```tsx
// LogViewer.tsx
export function LogViewer({ serverId }: { serverId?: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const wsUrl = serverId
      ? `ws://localhost:8000/ws/logs/${serverId}`
      : `ws://localhost:8000/ws/logs`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const log = JSON.parse(event.data) as LogEntry;
      setLogs((prev) => [...prev, log].slice(-500));  // Keep last 500
    };

    return () => ws.close();
  }, [serverId]);

  return (
    <div className="h-96 overflow-y-auto bg-black text-white font-mono p-4">
      {logs.map((log, i) => (
        <LogLine key={i} log={log} />
      ))}
      {connected && <div className="text-green-500">● Connected</div>}
    </div>
  );
}
```

## API Client

### HTTP API

```typescript
// lib/api.ts
const API_BASE = 'http://localhost:8000';

export const api = {
  // Server management
  async listServers(): Promise<ServerInstance[]> {
    const res = await fetch(`${API_BASE}/servers`);
    return res.json();
  },

  async createServer(data: CreateServerRequest): Promise<ServerInstance> {
    const res = await fetch(`${API_BASE}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async startServer(id: string): Promise<void> {
    await fetch(`${API_BASE}/servers/${id}/start`, { method: 'POST' });
  },

  async stopServer(id: string): Promise<void> {
    await fetch(`${API_BASE}/servers/${id}/stop`, { method: 'POST' });
  },

  async deleteServer(id: string): Promise<void> {
    await fetch(`${API_BASE}/servers/${id}`, { method: 'DELETE' });
  },

  // Configuration
  async getConfig(): Promise<DevboxConfig> {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },

  async getTemplates(): Promise<PackagedAssets> {
    const res = await fetch(`${API_BASE}/templates`);
    const data = await res.json();
    return data.data;
  },
};
```

### WebSocket Client

```typescript
// lib/websocket.ts
export class LogStreamClient {
  private ws: WebSocket | null = null;

  connect(serverId?: string) {
    const url = serverId
      ? `ws://localhost:8000/ws/logs/${serverId}`
      : `ws://localhost:8000/ws/logs`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      const log = JSON.parse(event.data);
      this.onLog(log);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  onLog(log: LogEntry) {
    // Override in consumer
  }
}
```

## Type Definitions

```typescript
// types/index.ts
export interface ServerInstance {
  id: string;
  name: string;
  port: number;
  workspace_path: string;
  extensions: string[];
  status: 'running' | 'stopped' | 'failed';
  pid?: number;
  start_time?: string;
  command?: string[];
  uptime?: number;
  cpu_percent?: number;
  memory_mb?: number;
  last_update?: string;
}

export interface ExtensionGroup {
  name: string;
  description: string;
  extensions: string[];
  user_settings?: Record<string, any>;
}

export interface DevboxConfig {
  extension_groups: Record<string, ExtensionGroup>;
  server: ServerConfig;
  ui: UIConfig;
  packaged_assets?: PackagedAssets;
}

export interface CreateServerRequest {
  name: string;
  extensions?: string[];
}

export interface LogEntry {
  type: 'log';
  server_id: string;
  server_name: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  timestamp: string;
}
```

## State Management

### Application State

Using React Context and hooks:

```tsx
// App.tsx
export function App() {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [config, setConfig] = useState<DevboxConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    Promise.all([
      api.listServers(),
      api.getConfig(),
    ]).then(([servers, config]) => {
      setServers(servers);
      setConfig(config);
      setLoading(false);
    });
  }, []);

  // Auto-refresh servers every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const updated = await api.listServers();
      setServers(updated);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // ... render UI
}
```

## Styling

### Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF3621',  // Databricks orange
        secondary: '#00A972',
      },
    },
  },
  plugins: [],
};
```

### shadcn/ui Components

Pre-built, accessible components:

- `Button`, `Card`, `Dialog`
- `Input`, `Select`, `Checkbox`
- `Badge`, `Alert`, `Tabs`
- `Tooltip`, `Dropdown`

## Build & Deployment

### Development

```bash
# Install dependencies
pnpm install

# Start dev server (with HMR)
pnpm dev

# Runs on http://localhost:5173
```

### Production

```bash
# Build for production
pnpm build

# Output: dist/
# - index.html
# - assets/*.js
# - assets/*.css
```

### Embedded in Go Binary

The built web UI is embedded in the Go binary:

```go
// assets.go
//go:embed web_ui_dist
var webUIFS embed.FS

// In routes.go
assetsSubFS, _ := fs.Sub(webUIFS, "web_ui_dist/assets")
r.StaticFS("/assets", http.FS(assetsSubFS))

// Serve index.html for client-side routing
r.NoRoute(func(c *gin.Context) {
    data, _ := webUIFS.ReadFile("web_ui_dist/index.html")
    c.Data(http.StatusOK, "text/html; charset=utf-8", data)
})
```

## User Interactions

### Creating a Server

```
1. User clicks "New Server"
2. Dialog opens with form
3. User enters name, selects extensions
4. User selects workspace source (empty/GitHub/upload)
5. Submit form
6. POST /servers
7. Server created (may take time for extensions)
8. UI auto-refreshes and shows new server
```

### Starting a Server

```
1. User clicks "Start" on server card
2. POST /servers/:id/start
3. Server status changes to "running"
4. Metrics start updating
5. "Open" button becomes available
```

### Opening code-server

```
1. User clicks "Open"
2. Window opens: /vscode/{port}/
3. Proxy forwards to code-server instance
4. code-server loads in new tab
```

### Viewing Logs

```
1. User navigates to Logs tab
2. WebSocket connects to /ws/logs
3. Logs stream in real-time
4. Auto-scrolls to bottom
5. Color-coded by level (INFO/WARN/ERROR)
```

## Performance Optimizations

- **Auto-refresh**: 5-second polling for server list
- **WebSocket**: Real-time log streaming (no polling)
- **Lazy Loading**: Components loaded on-demand
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large log lists (future)

## Next Steps

<div class="grid cards" markdown>

- **[Configuration →](../configuration/devbox-yaml.md)**

    Configuration reference

- **[API Reference →](../api-reference.md)**

    Full API documentation

</div>