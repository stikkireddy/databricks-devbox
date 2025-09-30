# Differences from VS Code

Understanding the key differences between code-server and VS Code Desktop.

## Platform Differences

### VS Code Desktop

- **Native application** (Electron-based)
- **Runs locally** on your machine
- **Direct filesystem access**
- **Native OS integration**

### code-server

- **Web application** (runs in browser)
- **Runs remotely** on a server
- **HTTP-based filesystem access**
- **Browser sandbox** limitations

## Extension Marketplace

The most significant difference:

| | VS Code Desktop | code-server |
|-|-----------------|-------------|
| **Marketplace** | Microsoft Store | Open VSX |
| **Extensions** | ~50,000+ | ~30,000+ |
| **Microsoft Extensions** | ✅ Available | ❌ Not available |
| **Open Source Extensions** | ✅ Available | ✅ Available |

**Missing extensions:**

- ms-python.python (Microsoft Python)
- ms-vscode.cpptools (C/C++)
- ms-vscode-remote.* (Remote development)

**Workarounds:**

- Use open-source alternatives (pyright instead of python)
- Manually install `.vsix` files
- Use community forks

[Extension marketplace details →](extension-marketplace.md)

## Performance

### Local Execution (VS Code Desktop)

- ✅ **Fast**: Direct CPU/memory access
- ✅ **Responsive**: No network latency
- ❌ **Resource limited**: By local machine

### Remote Execution (code-server)

- ⚠️ **Latency**: Network round-trip
- ✅ **Scalable**: Use powerful servers
- ✅ **Resource flexible**: Upgrade server resources

## Feature Availability

### Available in Both

- ✅ IntelliSense and code completion
- ✅ Integrated terminal
- ✅ Git integration
- ✅ Debugging (most languages)
- ✅ Extensions (Open VSX)
- ✅ Settings sync
- ✅ Themes and keybindings

### VS Code Desktop Only

- ❌ Microsoft Store extensions
- ❌ Native file system performance
- ❌ Direct hardware access
- ❌ Offline usage

### code-server Only

- ✅ Browser-based access
- ✅ Multiple simultaneous users (different instances)
- ✅ Server-side execution
- ✅ No local installation needed

## Keyboard Shortcuts

Some shortcuts differ due to browser limitations:

| Action | VS Code Desktop | code-server (Browser) |
|--------|-----------------|----------------------|
| **Command Palette** | `Ctrl+Shift+P` | `Ctrl+Shift+P` ✅ |
| **Quick Open** | `Ctrl+P` | `Ctrl+P` ✅ |
| **Toggle Terminal** | `Ctrl+\`` | `Ctrl+\`` ✅ |
| **New Tab** | `Ctrl+N` | Browser intercepts ⚠️ |
| **Close Tab** | `Ctrl+W` | Browser intercepts ⚠️ |
| **Reload Window** | `Ctrl+R` | Browser intercepts ⚠️ |

**Workarounds:**

- Use Command Palette for conflicting shortcuts
- Configure custom keybindings
- Use browser-specific modes

## File System

### VS Code Desktop

```
Direct access to:
/home/user/projects/
└── my-project/
    └── file.py
```

### code-server

```
HTTP-based access to:
/workspace/<server-id>/
└── my-project/
    └── file.py
```

**Implications:**

- **Slower file operations** (network overhead)
- **No direct OS file picker**
- **Browser upload/download** for files

## Debugging

### Similar Experience

- ✅ Breakpoints work
- ✅ Variable inspection works
- ✅ Debug console available
- ✅ Most debuggers supported

### Limitations

- ⚠️ Some native debuggers unavailable
- ⚠️ Performance overhead from network
- ⚠️ Browser memory limits apply

## Terminal

### VS Code Desktop

- Direct shell access
- Native OS integration
- Full terminal capabilities

### code-server

- **Server-side shell** (not local)
- Commands run on server
- Network latency affects responsiveness

**Example:**

```bash
# In code-server terminal, this runs on server:
ls /
# Shows server filesystem, not local filesystem
```

## Settings Sync

Both support settings sync, but differently:

### VS Code Desktop

- Syncs via Microsoft account
- Includes extensions from Microsoft Store

### code-server

- Syncs via Settings Sync extension
- Only includes Open VSX extensions

## Updates

### VS Code Desktop

- Auto-updates via Microsoft
- Monthly release cycle
- Automatic download and install

### code-server

- Manual updates
- Independent release cycle
- Server admin must update

## Recommendations

### Use VS Code Desktop When:

- ✅ **Offline work** required
- ✅ **Microsoft extensions** needed
- ✅ **Maximum performance** required
- ✅ **Native OS integration** important

### Use code-server When:

- ✅ **Remote access** needed
- ✅ **Consistent environments** required
- ✅ **Multiple machines** used
- ✅ **Team collaboration** desired
- ✅ **Databricks integration** needed (via DevBox)

## Next Steps

<div class="grid cards" markdown>

- **[Extension Marketplace →](extension-marketplace.md)**

    Open VSX details

- **[What is code-server? →](index.md)**

    Overview

</div>