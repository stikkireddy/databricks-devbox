# Extension Marketplace

code-server uses Open VSX instead of the Microsoft Extension Marketplace.

## Open VSX Registry

[Open VSX](https://open-vsx.org/) is an open-source alternative to the Microsoft Extension Marketplace.

### Why Not Microsoft Marketplace?

Microsoft's extension marketplace is **proprietary** and **licensed exclusively** to Microsoft VS Code. Open-source forks like code-server cannot use it due to licensing restrictions.

### What's Available

**Most popular extensions ARE available:**

- ✅ Python support (pyright, pylance alternatives)
- ✅ Jupyter notebooks
- ✅ Databricks
- ✅ Git tools
- ✅ Themes and icons
- ✅ Language servers (TypeScript, Go, Rust, etc.)
- ✅ Code formatters (Prettier, Black, etc.)
- ✅ Linters (ESLint, Pylint, etc.)

**Some Microsoft-proprietary extensions are NOT available:**

- ❌ ms-python.python (use alternatives)
- ❌ C/C++ IntelliSense
- ❌ Live Share
- ❌ Remote Development extensions

### Finding Extensions

**Search Open VSX:**

1. Visit [https://open-vsx.org/](https://open-vsx.org/)
2. Search for extension
3. Note the extension ID (e.g., `ms-pyright.pyright`)

**In code-server:**

1. Click Extensions icon (Ctrl+Shift+X)
2. Search for extension
3. Click Install

## Pre-configured Extensions

Databricks DevBox includes pre-configured extension groups:

### Python Group

```yaml
python:
  extensions:
    - "ms-python.python"       # Python language support
    - "ms-pyright.pyright"     # Type checking
  user_settings:
    "python.languageServer": "None"
```

### Jupyter Group

```yaml
jupyter:
  extensions:
    - "ms-toolsai.jupyter"
    - "ms-toolsai.jupyter-renderers"
    - "ms-toolsai.jupyter-keymap"
```

### Databricks Group

```yaml
databricks:
  extensions:
    - "databricks.databricks"
    - "databricks.sqltools-databricks-driver"
```

[View full configuration →](../configuration/extension-groups.md)

## Manual Installation

### From Open VSX

```bash
# In code-server terminal
code-server --install-extension <publisher>.<extension>

# Example:
code-server --install-extension ms-pyright.pyright
```

### From .vsix File

```bash
# Download .vsix file
# Install via command line
code-server --install-extension /path/to/extension.vsix
```

## Common Extensions

### Python Development

| Extension | ID | Description |
|-----------|-----|-------------|
| Pyright | `ms-pyright.pyright` | Type checking |
| Python | `ms-python.python` | Language support |
| Pylance | `ms-python.vscode-pylance` | Advanced IntelliSense |

### Data Science

| Extension | ID | Description |
|-----------|-----|-------------|
| Jupyter | `ms-toolsai.jupyter` | Notebook support |
| Jupyter Renderers | `ms-toolsai.jupyter-renderers` | Output rendering |

### Databricks

| Extension | ID | Description |
|-----------|-----|-------------|
| Databricks | `databricks.databricks` | Databricks integration |
| SQL Tools | `databricks.sqltools-databricks-driver` | SQL support |

### General Development

| Extension | ID | Description |
|-----------|-----|-------------|
| GitLens | `eamodio.gitlens` | Git superpowers |
| Prettier | `esbenp.prettier-vscode` | Code formatter |
| ESLint | `dbaeumer.vscode-eslint` | JavaScript linting |

## Troubleshooting

### Extension Not Found

**Solution:**

1. Check [Open VSX](https://open-vsx.org/)
2. Try alternative extensions
3. Manually install .vsix file

### Extension Won't Install

**Check logs:**

```bash
# View code-server logs
tail -f ~/.local/share/code-server/logs/<date>/vscode.log
```

**Common issues:**

- Network connectivity
- Incompatible version
- Missing dependencies

### Extension Not Working

**Possible causes:**

- Platform incompatibility (some extensions Windows/Mac only)
- Missing native dependencies
- Configuration issues

**Solutions:**

- Check extension requirements
- Review extension logs
- Try alternative extension

## Best Practices

### 1. Use Extension Groups

Pre-configured groups ensure consistency:

```yaml
# In devbox.yaml
extension_groups:
  my-stack:
    name: "My Stack"
    extensions:
      - "ms-python.python"
      - "ms-toolsai.jupyter"
      - "databricks.databricks"
```

### 2. Pin Extension Versions

For production environments:

```bash
# Install specific version
code-server --install-extension publisher.extension@1.2.3
```

### 3. Test Extensions

Test in development before deploying to production.

## Next Steps

<div class="grid cards" markdown>

- **[What is code-server? →](index.md)**

    Overview

- **[VS Code Differences →](vs-code-differences.md)**

    Detailed comparison

</div>