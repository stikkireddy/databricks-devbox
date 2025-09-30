# Configuration Overview

Databricks DevBox is configured through a YAML file (`devbox.yaml`) that controls extension groups, server settings, UI behavior, and workspace templates.

## Configuration File Location

The configuration file can be specified via environment variable:

```bash
export DEVBOX_CONFIG_PATH=/path/to/devbox.yaml
```

**Default locations:**

- Databricks App: `/app/python/source_code/app/devbox.yaml`
- Local: `./app/devbox.yaml`

## Configuration Sections

### 1. Extension Groups

Define reusable sets of VS Code extensions with optional user settings.

```yaml
extension_groups:
  python:
    name: "Python"
    description: "Python development tools"
    extensions:
      - "ms-python.python"
      - "ms-pyright.pyright"
    user_settings:
      "python.languageServer": "None"
```

[Learn more →](extension-groups.md)

### 2. Server Configuration

Control server ports and networking.

```yaml
server:
  default_port: 8000
  code_server_port_range:
    start: 8010
    end: 8100
```

[Learn more →](devbox-yaml.md#server-configuration)

### 3. UI Configuration

Set defaults for the web interface.

```yaml
ui:
  default_extension_groups:
    - "python"
    - "jupyter"
  settings:
    auto_refresh_interval: 5000
    show_advanced_options: false
    enable_dark_mode: true
```

[Learn more →](devbox-yaml.md#ui-configuration)

### 4. Packaged Assets (Templates)

Define quick-start templates for common scenarios.

```yaml
packaged_assets:
  tabs:
  - name: "Workshops"
    items:
    - name: "Databricks Workshop"
      description: "ML workshop starter"
      extensions_groups:
        - "python"
        - "databricks"
      github_url: "https://github.com/org/workshop.git"
```

[Learn more →](packaged-assets.md)

## Complete Example

```yaml
# Databricks Devbox Configuration
extension_groups:
  python:
    name: "Python"
    description: "Python development tools"
    extensions:
      - "ms-python.python"
      - "ms-pyright.pyright"
    user_settings:
      "python.languageServer": "None"

  jupyter:
    name: "Jupyter"
    description: "Jupyter notebooks"
    extensions:
      - "ms-toolsai.jupyter"
      - "ms-toolsai.jupyter-renderers"

  databricks:
    name: "Databricks"
    description: "Databricks integration"
    extensions:
      - "databricks.databricks"

server:
  default_port: 8000
  code_server_port_range:
    start: 8010
    end: 8100

ui:
  default_extension_groups:
    - "python"
    - "jupyter"
  settings:
    auto_refresh_interval: 5000
    show_advanced_options: false
    enable_dark_mode: true
  workspace:
    default_type: "empty"
    max_upload_size_mb: 100
    supported_archive_types:
      - ".zip"
      - ".tar.gz"

packaged_assets:
  tabs:
  - name: "Workshops"
    items:
    - name: "Databricks Workshop"
      description: "Complete workshop environment"
      extensions_groups:
        - "python"
        - "jupyter"
        - "databricks"
      thumbnail_url: "https://example.com/image.jpg"
      github_url: "https://github.com/org/workshop.git"
      icon_links:
        - lucide_icon: "book"
          url: "https://docs.example.com"
```

## Configuration Loading

### Priority Order

1. Environment variable: `DEVBOX_CONFIG_PATH`
2. Default: `./app/devbox.yaml`
3. Fallback: Built-in defaults

### Validation

The server validates configuration on startup:

- ✅ All required fields present
- ✅ Port ranges valid
- ✅ Extension groups well-formed
- ✅ Template URLs accessible

### Defaults

Missing values are filled with sensible defaults:

```go
// Default extension groups
if len(config.ExtensionGroups) == 0 {
    config.ExtensionGroups = defaultExtensionGroups
}

// Default server port
if config.Server.DefaultPort == 0 {
    config.Server.DefaultPort = 8000
}

// Default port range
if config.Server.CodeServerPortRange.Start == 0 {
    config.Server.CodeServerPortRange = PortRange{Start: 8010, End: 8100}
}
```

## Reloading Configuration

Configuration can be reloaded without restarting the server (future feature):

```bash
# Reload config via API
curl -X POST http://localhost:8000/config/reload
```

Currently, changes require a server restart.

## Environment Variables

Override configuration at runtime:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEVBOX_CONFIG_PATH` | Path to devbox.yaml | `./app/devbox.yaml` |
| `DEVBOX_SERVER_PORT` | Manager server port | `8000` |
| `CODE_SERVER_VERSION` | code-server version | `4.104.1` |
| `LHA_SERVER_VERSION` | Go binary version | `latest` |
| `CLAUDE_CODE_TOKEN_EXPIRY_SECONDS` | Token expiry | `3600` |

## Troubleshooting

### Configuration Not Loading

**Check the path:**

```bash
echo $DEVBOX_CONFIG_PATH
ls -la $DEVBOX_CONFIG_PATH
```

**Check logs:**

```bash
# Look for "Successfully loaded configuration from..."
# or "Warning: Failed to load config from..."
```

### Invalid YAML Syntax

```bash
# Validate YAML
python -c "import yaml; yaml.safe_load(open('devbox.yaml'))"
```

### Extensions Not Installing

- Verify extension IDs are correct
- Check Open VSX marketplace availability
- Review extension installation logs

## Next Steps

<div class="grid cards" markdown>

- **[devbox.yaml Reference →](devbox-yaml.md)**

    Complete configuration reference

- **[Extension Groups →](extension-groups.md)**

    Configure extension groups

- **[Packaged Assets →](packaged-assets.md)**

    Setup templates

</div>