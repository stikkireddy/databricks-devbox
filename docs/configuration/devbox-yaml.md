# devbox.yaml Reference

Complete reference for the `devbox.yaml` configuration file.

## File Location

- **Environment Variable**: `DEVBOX_CONFIG_PATH`
- **Default**: `./app/devbox.yaml`

## Top-Level Structure

```yaml
extension_groups:    # Map of extension group definitions
  <group-key>:       # Unique identifier for the group
    # ...

server:              # Server configuration
  # ...

ui:                  # UI configuration
  # ...

packaged_assets:     # Template definitions (optional)
  # ...
```

## Extension Groups

Define reusable sets of VS Code extensions.

### Schema

```yaml
extension_groups:
  <group-key>:                    # Unique identifier (e.g., "python", "jupyter")
    name: string                  # Display name in UI
    description: string           # Description shown in UI
    extensions: string[]          # List of extension IDs
    user_settings: object         # Optional VS Code settings (optional)
```

### Example

```yaml
extension_groups:
  python:
    name: "Python"
    description: "Python development tools and language support"
    extensions:
      - "ms-python.python"
      - "ms-pyright.pyright"
    user_settings:
      "python.languageServer": "None"
      "python.defaultInterpreterPath": "/usr/bin/python3"

  jupyter:
    name: "Jupyter"
    description: "Jupyter notebook support and tools"
    extensions:
      - "ms-toolsai.jupyter"
      - "ms-toolsai.jupyter-renderers"
      - "ms-toolsai.jupyter-keymap"
      - "ms-toolsai.vscode-jupyter-cell-tags"

  databricks:
    name: "Databricks"
    description: "Databricks platform integration and SQL tools"
    extensions:
      - "databricks.databricks"
      - "databricks.sqltools-databricks-driver"
```

### Extension IDs

Extension IDs follow the format: `<publisher>.<extension-name>`

**Finding Extension IDs:**

1. Search [Open VSX Registry](https://open-vsx.org/)
2. Look for "Identifier" on extension page
3. Example: `ms-python.python`

### User Settings

VS Code settings applied when extensions are installed.

**Common settings:**

```yaml
user_settings:
  # Python
  "python.languageServer": "Pylance"
  "python.linting.enabled": true
  "python.formatting.provider": "black"

  # Editor
  "editor.fontSize": 14
  "editor.tabSize": 4
  "editor.rulers": [80, 120]

  # Terminal
  "terminal.integrated.fontSize": 12
  "terminal.integrated.shell.linux": "/bin/bash"

  # Files
  "files.autoSave": "afterDelay"
  "files.autoSaveDelay": 1000
```

## Server Configuration

Controls server ports and networking.

### Schema

```yaml
server:
  default_port: number            # Manager server port (default: 8000)
  code_server_port_range:
    start: number                 # First port for code-server (default: 8010)
    end: number                   # Last port for code-server (default: 8100)
```

### Example

```yaml
server:
  default_port: 8000              # DevBox manager runs on :8000
  code_server_port_range:
    start: 8010                   # code-server instances use :8010-8100
    end: 8100                     # Maximum 90 concurrent servers
```

### Port Management

- **Manager Port**: Single port for web UI and API
- **code-server Range**: One port per instance
- **Dynamic Allocation**: Ports assigned sequentially from start

**Calculating Capacity:**

```
Max Servers = end - start + 1
Example: 8100 - 8010 + 1 = 91 servers
```

## UI Configuration

Customize web interface behavior.

### Schema

```yaml
ui:
  default_extension_groups: string[]    # Pre-selected groups in UI
  settings:
    auto_refresh_interval: number       # Milliseconds between refreshes
    show_advanced_options: boolean      # Show advanced options
    enable_dark_mode: boolean           # Enable dark theme
  workspace:
    default_type: string                # "empty" | "upload" | "github"
    max_upload_size_mb: number          # Max ZIP upload size
    supported_archive_types: string[]   # Allowed file types
```

### Example

```yaml
ui:
  # Pre-select these extension groups in "Create Server" dialog
  default_extension_groups:
    - "python"
    - "jupyter"

  settings:
    auto_refresh_interval: 5000         # Refresh server list every 5 seconds
    show_advanced_options: false        # Hide advanced options by default
    enable_dark_mode: true              # Use dark theme

  workspace:
    default_type: "empty"               # Default to empty workspace
    max_upload_size_mb: 100             # Max 100MB ZIP uploads
    supported_archive_types:
      - ".zip"
      - ".tar.gz"
```

## Packaged Assets (Templates)

Define quick-start templates with pre-configured extensions and workspaces.

See [Packaged Assets documentation](packaged-assets.md) for complete reference.

## Complete Configuration Example

```yaml
# Databricks Devbox Configuration
# This file controls extension groups, server settings, and UI configuration

# Extension groups available for devbox instances
extension_groups:
  python:
    name: "Python"
    description: "Python development tools and language support"
    extensions:
      - "ms-python.python"
      - "ms-pyright.pyright"
    user_settings:
      "python.languageServer": "None"

  jupyter:
    name: "Jupyter"
    description: "Jupyter notebook support and tools"
    extensions:
      - "ms-toolsai.jupyter"
      - "ms-toolsai.jupyter-renderers"
      - "ms-toolsai.jupyter-keymap"
      - "ms-toolsai.vscode-jupyter-cell-tags"

  databricks:
    name: "Databricks"
    description: "Databricks platform integration and SQL tools"
    extensions:
      - "databricks.databricks"
      - "databricks.sqltools-databricks-driver"

# Server configuration
server:
  # Default port for the devbox manager server
  default_port: 8000

  # Port range for code-server instances
  code_server_port_range:
    start: 8010
    end: 8100

# UI configuration
ui:
  # Default extension groups to pre-select
  default_extension_groups:
    - "python"
    - "jupyter"

  # UI behavior settings
  settings:
    auto_refresh_interval: 5000  # milliseconds
    show_advanced_options: false
    enable_dark_mode: true

  # Workspace initialization defaults
  workspace:
    default_type: "empty"  # empty, upload, github
    max_upload_size_mb: 100
    supported_archive_types:
      - ".zip"
      - ".tar.gz"

# Packaged assets (templates)
packaged_assets:
  tabs:
  - name: "Workshops"
    items:
    - name: "Databricks Workshop"
      description: "Databricks Workshop starter project"
      extensions_groups:
        - "python"
        - "databricks"
      thumbnail_url: "https://example.com/thumbnail.jpg"
      github_url: "https://github.com/org/workshop.git"
      icon_links:
        - lucide_icon: "book"
          url: "https://docs.example.com/workshop"
        - lucide_icon: "youtube"
          url: "https://youtube.com/watch?v=..."
```

## Configuration Validation

The server validates configuration on startup:

### Required Fields

- ✅ At least one extension group must be defined
- ✅ `server.code_server_port_range.start` < `server.code_server_port_range.end`
- ✅ All extension IDs are valid strings

### Optional Fields

Missing optional fields are filled with defaults:

```go
// Default values
DefaultPort: 8000
CodeServerPortRange: {Start: 8010, End: 8100}
AutoRefreshInterval: 5000
ShowAdvancedOptions: false
EnableDarkMode: true
DefaultType: "empty"
MaxUploadSizeMB: 100
```

## Reloading Configuration

Currently, configuration changes require a server restart:

```bash
# Stop server
curl -X POST http://localhost:8000/shutdown

# Restart with new config
DEVBOX_CONFIG_PATH=./new-config.yaml ./databricks-devbox
```

Future versions may support hot-reloading via API endpoint.

## Environment Variable Overrides

Some settings can be overridden via environment variables:

```bash
# Override server port
export DEVBOX_SERVER_PORT=9000

# Override config file location
export DEVBOX_CONFIG_PATH=/custom/path/devbox.yaml
```

## Best Practices

### 1. Use Descriptive Names

```yaml
# Good
extension_groups:
  ml-stack:
    name: "Machine Learning Stack"
    description: "Complete ML development environment"

# Avoid
extension_groups:
  group1:
    name: "Group 1"
```

### 2. Group Related Extensions

```yaml
# Good - logically grouped
data-science:
  extensions:
    - "ms-python.python"
    - "ms-toolsai.jupyter"
    - "ms-python.vscode-pylance"

# Avoid - unrelated extensions
mixed:
  extensions:
    - "ms-python.python"
    - "golang.go"
    - "rust-lang.rust"
```

### 3. Document Custom Settings

```yaml
python:
  user_settings:
    # Disable Pylance for compatibility with Databricks
    "python.languageServer": "None"

    # Auto-format on save
    "editor.formatOnSave": true
```

### 4. Reasonable Port Ranges

```yaml
# Good - allows 90 concurrent servers
code_server_port_range:
  start: 8010
  end: 8100

# Avoid - too many ports (security risk)
code_server_port_range:
  start: 8010
  end: 9999  # 1989 ports!
```

## Troubleshooting

### Configuration Not Loading

```bash
# Check file exists
ls -la $DEVBOX_CONFIG_PATH

# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('devbox.yaml'))"

# Check server logs
tail -f logs/server.log | grep "config"
```

### Extensions Not Installing

- Verify extension IDs on [Open VSX](https://open-vsx.org/)
- Check network connectivity
- Review installation logs in web UI

### Port Conflicts

```bash
# Check if ports are available
lsof -i :8000
lsof -i :8010

# Kill conflicting processes
kill -9 <PID>
```

## Next Steps

<div class="grid cards" markdown>

- **[Extension Groups →](extension-groups.md)**

    Detailed extension configuration

- **[Packaged Assets →](packaged-assets.md)**

    Template configuration

</div>