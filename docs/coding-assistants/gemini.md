# Google Gemini

Google Gemini CLI provides conversational AI capabilities from Google's generative AI models.

## Overview

- **Conversational AI** via command line
- **Multiple models** supported
- **Automatic installation** via npm
- **Direct API access** (not routed through Databricks)

## Authentication

Gemini CLI requires authentication with Google's AI services. On initial startup, you'll need to configure authentication.

### Method 1: Personal Google Account (Recommended for Free Tier)

```bash
# Run gemini and follow the browser authentication flow
gemini
```

On first run, Gemini CLI will open a browser for authentication. Once authenticated, credentials are cached locally for subsequent runs.

**Free Access**: Login with a personal Google account to get a free Gemini Code Assist license with access to Gemini 2.5 Pro and its 1 million token context window.

### Method 2: API Key

```bash
# Set your Gemini API key
export GEMINI_API_KEY="..."

# Or set Google API key
export GOOGLE_API_KEY="..."

# Add to ~/.bashrc for persistence
echo 'export GEMINI_API_KEY="..."' >> ~/.bashrc

# Run gemini
gemini
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

### Method 3: Google Cloud / Vertex AI

For production use with Google Cloud:

```bash
# Ensure Vertex AI API is enabled in your project
# Unset API key environment variables
unset GOOGLE_API_KEY
unset GEMINI_API_KEY

# Use Application Default Credentials
gemini
```

### Method 4: Cloud Shell

When running in Google Cloud Shell, authentication is automatic using your logged-in credentials.

### Switching Authentication

To change authentication methods:

```
$ gemini

> /auth
[Select authentication method]
```

## Usage

### Interactive Chat

```bash
gemini chat
```

### Single Prompt

```bash
gemini ask "explain quantum computing"
```

## Configuration

Gemini requires a Google API key (not automatically configured):

```bash
export GOOGLE_API_KEY="..."
```

**Note**: In Databricks DevBox, Gemini is installed but **not pre-configured** for Databricks models. It's included for completeness but requires manual API key setup.

## When to Use

**Use Gemini for:**

- ✅ General AI conversations
- ✅ Non-coding questions
- ✅ Google-specific integrations

**Use Claude Code instead for:**

- ❌ Databricks-integrated workflows
- ❌ Pre-configured setup
- ❌ Code-specific tasks

## Next Steps

<div class="grid cards" markdown>

- **[Claude Code →](claude-code.md)**

    Recommended for Databricks

- **[Other Tools →](index.md)**

    Explore all assistants

</div>