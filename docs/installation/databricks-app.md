# Deploy as Databricks App

This guide walks you through deploying Databricks DevBox as a Lakehouse App in your Databricks workspace.

## Prerequisites

- **Databricks Workspace** (AWS, Azure, or GCP)
- **Unity Catalog** enabled (recommended for token management)
- **Workspace Admin** permissions (or permission to create apps)
- **Databricks Runtime** 13.3 LTS or higher

## Step 1: Copy App Folder to Workspace

### Option A: Using Databricks CLI

```bash
# Install Databricks CLI if needed
pip install databricks-cli

# Configure authentication
databricks configure --token

# Upload the app folder to your workspace
databricks workspace import_dir \
  ./app \
  /Workspace/Users/<your-email>/databricks-devbox-app \
  --overwrite
```

### Option B: Using Databricks UI

1. Navigate to your Databricks workspace
2. Click **Workspace** → **Users** → **<your-email>**
3. Right-click → **Create** → **Folder** → Name it `databricks-devbox-app`
4. Click the **Import** button (or drag and drop) to upload the following files from the `app/` folder:
   - `app.py`
   - `vibe_code.py`
   - `version.py`
   - `requirements.txt`
   - `app.yaml`
   - `devbox.yaml`

## Step 2: Create Lakehouse App

### Using Databricks UI

1. Navigate to **Apps** in the left sidebar
2. Click **Create App**
3. Fill in the app details:

   **Basic Information:**

   - **Name**: `databricks-devbox`
   - **Description**: `Web-based development environments with code-server`

   **Source Code:**

   - **Source Type**: `Workspace`
   - **Source Path**: `/Workspace/Users/<your-email>/databricks-devbox-app`
   - **Entry Point**: `app.py`

   **Configuration:**

   - **Python Version**: `3.11`
   - **Command**: `['python', 'app.py']` (from `app.yaml`)

4. Click **Create**

### Using Databricks CLI (Advanced)

```bash
# Create app using Databricks CLI
databricks apps create \
  --source-path /Workspace/Users/<your-email>/databricks-devbox-app \
  --name databricks-devbox \
  --description "Web-based development environments"
```

## Step 3: Configure Environment Variables (Optional)

You can customize the behavior by setting environment variables in `app.yaml`:

```yaml
command: ['python', 'app.py']
env:
  - name: 'HOME'
    value: '/app/python/source_code'
  - name: 'SHELL'
    value: '/usr/bin/bash'
  - name: 'DATABRICKS_APP_DEPLOYMENT'
    value: 'true'
  - name: 'UV_PYTHON'
    value: '/usr/bin/python3.11'
```

## Step 4: Launch the App

1. Navigate to **Apps** in your Databricks workspace
2. Find **databricks-devbox** in the list
3. Click **Start** or **Launch**
4. Wait for the app to initialize (first launch takes 2-3 minutes)

### What Happens on First Launch?

The app automatically:

1. ✅ Downloads the platform-specific Go binary from GitHub releases
2. ✅ Installs code-server (version specified in `CODE_SERVER_VERSION`)
3. ✅ Installs Databricks CLI
4. ✅ Sets up vibe coding tools (Claude Code, CCR, Codex, Gemini)
5. ✅ Generates Databricks authentication token
6. ✅ Starts the DevBox manager server

## Step 5: Access the App

Once launched, you'll see the app URL:

```
https://<workspace-url>/apps/<app-id>/
```

Click the URL to access the Databricks DevBox web interface.

## Understanding the Deployment

### File Structure in Workspace

```
/Workspace/Users/<your-email>/databricks-devbox-app/
├── app.py              # Main Python entry point
├── app.yaml            # Databricks App configuration
├── devbox.yaml         # DevBox configuration (extensions, templates)
├── vibe_code.py        # Vibe coding tools setup
├── version.py          # Version management
└── requirements.txt    # Python dependencies
```

### Binary Downloads

The app downloads binaries to:

```
/app/python/source_code/
├── build/
│   └── databricks-devbox-<os>-<arch>  # Go server binary
├── .local/
│   ├── lib/
│   │   └── code-server-v4.104.1/      # code-server
│   └── bin/
│       ├── code-server -> ../lib/code-server-v4.104.1/bin/code-server
│       └── databricks                  # Databricks CLI
└── .npm-global/
    └── bin/
        ├── claude-code                 # Claude Code CLI
        ├── ccr                         # Claude Code Router
        ├── codex                       # OpenAI Codex CLI
        └── gemini                      # Google Gemini CLI
```

### Data Persistence

Server data is stored in:

```
/app/python/source_code/
├── data/
│   ├── servers.json                    # Server configurations
│   └── <server-id>/                    # Per-server data
│       └── code-server/                # code-server configs
├── logs/
│   └── <server-id>/                    # Per-server logs
└── workspace/
    └── <server-id>/                    # Workspaces
```

## Configuration

### Customize Extension Groups

Edit `devbox.yaml` to add or modify extension groups:

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

[Learn more about configuration →](../configuration/devbox-yaml.md)

### Add Workspace Templates

Add templates in `devbox.yaml`:

```yaml
packaged_assets:
  tabs:
  - name: "My Templates"
    items:
    - name: "ML Project"
      description: "Machine Learning starter"
      extensions_groups:
        - "python"
        - "jupyter"
      github_url: "https://github.com/org/ml-starter.git"
```

[Learn more about templates →](../configuration/packaged-assets.md)

## Troubleshooting

### App Fails to Start

**Check logs:**

```bash
# Using Databricks CLI
databricks apps logs <app-id>
```

**Common issues:**

- ❌ Binary download failed → Check internet connectivity from workspace
- ❌ Permission denied → Ensure Unity Catalog is enabled for token generation
- ❌ Python version mismatch → Verify `UV_PYTHON` environment variable

### Code-Server Not Installing

**Solution:** Manually set `CODE_SERVER_VERSION`:

```yaml
env:
  - name: 'CODE_SERVER_VERSION'
    value: '4.104.1'
```

### Vibe Coding Tools Not Working

**Check:**

1. Token generation is working (requires Unity Catalog)
2. CCR is started: `source ~/.bashrc && ccr status`
3. Configuration files exist in `.claude-code-router/`

[See token troubleshooting →](../authentication/tokens.md#troubleshooting)

## Updating the App

### Update to Latest Version

1. Stop the app in Databricks UI
2. Replace files in workspace with new versions
3. Update `LHA_SERVER_VERSION` in `app.yaml` if needed
4. Restart the app

### Update Vibe Coding Tools

```bash
# SSH into workspace or use notebook
npm install -g @anthropic-ai/claude-code@latest
npm install -g @musistudio/claude-code-router@latest
```

## Security Considerations

### Token Management

- Tokens are auto-generated with configurable expiry

### Workspace Isolation

- Each code-server instance runs in isolated workspace
- No cross-instance file access
- Separate configuration per instance

### Network Security

- All traffic routed through Databricks App proxy
- Authentication handled by Databricks SSO
- No direct internet access from code-server instances

## Next Steps

<div class="grid cards" markdown>

- **[Architecture Overview →](../architecture/index.md)**

    Understand how DevBox works

- **[Configuration Guide →](../configuration/devbox-yaml.md)**

    Customize your deployment

- **[Setup Coding Assistants →](../coding-assistants/index.md)**

    Configure AI tools

</div>