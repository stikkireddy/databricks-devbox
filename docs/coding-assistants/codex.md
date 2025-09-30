# OpenAI Codex

OpenAI Codex CLI provides quick code generation capabilities from the command line.

## Overview

- **Quick code snippets** via command line
- **No conversation history** (single-turn only)
- **Automatic installation** via npm
- **Direct API access** (not routed through Databricks)

## Authentication

OpenAI Codex CLI requires authentication before use. On first run, you'll be prompted to authenticate.

### Method 1: ChatGPT Account (Recommended)

```bash
# Run codex and select "Sign in with ChatGPT"
codex
```

This method works with:
- ChatGPT Plus
- ChatGPT Pro
- ChatGPT Team
- ChatGPT Enterprise

Authentication uses OAuth 2.0 and credentials are stored in `~/.codex/auth.json`.

!!! warning "Remote Server Authentication"
    When running on a remote server (such as a Databricks workspace), you cannot access the OAuth browser flow directly. To authenticate:

    1. **On your local laptop**, run the `codex` CLI and complete the authentication flow
    2. After authentication, **copy** the `~/.codex/auth.json` file from your laptop
    3. **Transfer** the `auth.json` file to the remote server's `~/.codex/` folder

    This allows you to use your authenticated session on the remote server without needing browser access.

### Method 2: API Key

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Add to ~/.bashrc for persistence
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc

# Run codex
codex
```

Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

**Note**: Enterprise sign-in support is coming later. Use API key authentication for now.

## Usage

### Basic Command

```bash
codex --prompt "write a function to reverse a string"
```

### With Language Hint

```bash
codex --lang python --prompt "read a CSV file"
codex --lang javascript --prompt "fetch data from API"
```

## Configuration

Codex requires an OpenAI API key (not automatically configured):

```bash
export OPENAI_API_KEY="sk-..."
```

**Note**: In Databricks DevBox, Codex is installed but **not pre-configured** for Databricks models. It's included for completeness but requires manual API key setup.

## When to Use

**Use Codex for:**

- ✅ Quick single-turn code generation
- ✅ Simple snippets and functions
- ✅ Language-specific code patterns

**Use Claude Code instead for:**

- ❌ Multi-turn conversations
- ❌ Code explanation and editing
- ❌ Complex multi-file projects
- ❌ Databricks-integrated workflows

## Next Steps

<div class="grid cards" markdown>

- **[Claude Code →](claude-code.md)**

    More powerful alternative

- **[Gemini →](gemini.md)**

    Another option

</div>