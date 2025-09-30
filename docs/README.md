# Databricks DevBox Documentation

This directory contains the complete documentation for Databricks DevBox built with MkDocs Material.

## Building the Documentation

### Install Dependencies

```bash
# Install with docs extras
uv sync --extra docs
```

### Serve Locally

```bash
# Start development server with live reload
uv run mkdocs serve

# Access at: http://127.0.0.1:8000
```

### Build Static Site

```bash
# Build HTML site
uv run mkdocs build

# Output: site/
```

## Documentation Structure

```
docs/
├── index.md                    # Home page
├── installation/               # Installation guides
│   ├── databricks-app.md      # Deploy as Databricks App
│   └── local-setup.md         # Local development
├── architecture/               # System architecture
│   ├── go-binary.md           # Go components
│   ├── process-management.md  # Process lifecycle
│   └── web-ui.md              # React frontend
├── configuration/              # Configuration reference
│   ├── devbox-yaml.md         # Complete YAML reference
│   ├── extension-groups.md    # Extension groups
│   └── packaged-assets.md     # Templates
├── authentication/             # Authentication & tokens
│   ├── tokens.md              # Token management
│   └── databricks-integration.md
├── coding-assistants/          # Vibe coding tools
│   ├── claude-code.md         # Claude Code
│   ├── claude-code-router.md  # CCR proxy
│   ├── codex.md               # OpenAI Codex
│   └── gemini.md              # Google Gemini
├── code-server/                # code-server details
│   ├── index.md               # What is code-server
│   ├── vs-code-differences.md # VS Code comparison
│   └── extension-marketplace.md
└── api-reference.md            # REST API documentation
```

## Contributing

To add or update documentation:

1. Edit markdown files in `docs/`
2. Test locally with `uv run mkdocs serve`
3. Build with `uv run mkdocs build`
4. Commit changes

## Configuration

Documentation is configured via `mkdocs.yml` in the project root.

Key features:

- **Material Theme** with Databricks colors
- **Code Highlighting** for 50+ languages
- **Mermaid Diagrams** for architecture
- **Search** with instant results
- **Git Revision Dates** for each page
- **Dark Mode** support
