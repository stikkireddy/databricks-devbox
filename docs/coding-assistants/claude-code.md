# Claude Code

Claude Code is Anthropic's AI coding assistant, providing conversational code generation, explanation, and editing capabilities directly in your terminal.

## Overview

This guide covers using Claude Code with a **direct Anthropic API subscription**. For using Claude Code with Databricks-hosted models, see **[Claude Code Router (CCR) →](claude-code-router.md)**.

## Authentication

Claude Code offers multiple authentication options. Choose the method that best fits your needs.

### Method 1: Claude Pro or Max Plan (Recommended)

```bash
# Run claude and login with your Claude credentials
claude
```

When prompted during setup, log in with your Claude Pro (20 USD/month) or Claude Max (100 USD/month) account. This provides:
- Unified subscription for both Claude Code and web interface
- No additional API billing
- Automatic usage tracking

### Method 2: Claude Console (Pay-as-you-go)

```bash
# Run claude and complete OAuth process
claude
```

Connect through the Claude Console at [console.anthropic.com](https://console.anthropic.com/) with active billing. A "Claude Code" workspace is automatically created for usage tracking and cost management.

### Method 3: API Key

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Add to ~/.bashrc for persistence
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc

# Run claude (will use API key automatically)
claude
```

Get your API key from the [Anthropic Console](https://console.anthropic.com/).

**Note**: If `ANTHROPIC_API_KEY` is set, Claude Code will use it instead of your Claude subscription.

### Switching Authentication

To change authentication methods:

```bash
# Logout
claude logout

# Login with preferred method
claude login
```

## Usage

```bash
# Run Claude Code
claude
```

Note: The `cc` command is reserved for Claude Code when using CCR (Databricks-hosted). When using direct Anthropic API, use `claude`.

## Features with Anthropic API

When using direct Anthropic API, you get full access to:

- ✅ **Extended thinking modes** - Use `ultrathink`, `think`, and other thinking keywords for deeper reasoning
- ✅ **All Claude models** - Access to Sonnet, Opus, Haiku variants
- ✅ **Latest features** - Immediate access to new Anthropic features
- ✅ **Full API capabilities** - No limitations from proxy transformations
- ✅ **200K+ context window** - Large context for complex codebases

## Model Selection

```bash
# Use specific model
export CLAUDE_MODEL="claude-sonnet-4-20250514"

# Add to ~/.bashrc
echo 'export CLAUDE_MODEL="claude-sonnet-4-20250514"' >> ~/.bashrc
```

### Available Models

- `claude-sonnet-4-20250514` - Latest Sonnet 4 (balanced performance)
- `claude-opus-4-20250514` - Most capable (if available)
- `claude-haiku-4-20250305` - Fastest and most efficient

## Common Usage Examples

### Interactive Mode

```bash
$ claude
Claude Code v1.0
Type 'exit' to quit

> explain this code
[paste code]

> write a function to calculate fibonacci
[Claude generates code]

> edit the function to use memoization
[Claude modifies code]
```

### Command Line Mode

```bash
# One-off command
claude "write a function to reverse a string"

# With file context
claude "explain index.py" < index.py

# Save output to file
claude "write a REST API client" > api_client.py
```

### Multi-turn Conversations

Claude Code maintains context across multiple turns:

```bash
> write a class to manage users

[Claude generates User class]

> add a method to validate email addresses

[Claude adds method to existing class]

> write unit tests for the User class

[Claude generates test suite]
```

## Advanced Usage

### With File Context

```bash
# Provide file as input
claude "add docstrings" < my_script.py

# Or reference files in prompt
claude "explain the main function in app.py"
```

### Custom Instructions

```bash
# Set preferences
export CLAUDE_CODE_INSTRUCTIONS="Always include type hints and docstrings"

claude "write a function to sort a list"
```

### Using Extended Thinking

With Anthropic API, you can use extended thinking modes:

```bash
# Use ultra thinking for complex problems
claude "ultrathink: design a distributed caching system with consistency guarantees"

# Use standard thinking for moderate complexity
claude "think: optimize this database query for performance"
```

Note: Thinking modes are **not available** when using Databricks-hosted Claude via CCR.

## Best Practices

### 1. Be Specific

```bash
# Good
> write a Python function that reads a CSV file, filters rows where column 'status' is 'active', and returns a list of dictionaries

# Less optimal
> read csv file
```

### 2. Iterate Incrementally

```bash
> write a basic User class

[review output]

> add email validation to the User class

[review output]

> add password hashing
```

### 3. Provide Context

```bash
> I'm working on a Flask app. Write a route handler for user registration.

# Better than:
> write a function for user registration
```

### 4. Use Thinking Modes for Complex Tasks

```bash
# For architectural decisions
> ultrathink: should I use microservices or monolith for this e-commerce platform?

# For optimization problems
> think: how can I reduce the time complexity of this algorithm?
```

## Custom Commands

Claude Code supports custom commands that you can define in your project. Commands are stored in `./.claude/commands/` directory and allow you to create reusable prompts and workflows.

### Setting Up Commands

Create a commands directory in your project:

```bash
mkdir -p .claude/commands
```

### Creating a Command

Commands are simple text files with prompts. Create a file in `.claude/commands/`:

**Example: `.claude/commands/review.md`**

```markdown
Review this code for:
- Bugs and potential errors
- Performance issues
- Security vulnerabilities
- Code style and best practices
- Maintainability improvements

Provide specific, actionable feedback.
```

**Example: `.claude/commands/test.md`**

```markdown
Generate comprehensive pytest unit tests for this code.

Include:
- Happy path tests
- Edge cases
- Error handling
- Mock external dependencies
- Docstrings for each test
```

**Example: `.claude/commands/explain.md`**

```markdown
Explain this code in detail:
- What it does
- How it works
- Key algorithms or patterns used
- Any potential gotchas or limitations
```

### Using Commands

Once created, use commands in the Claude Code interactive interface with slash commands:

```
$ claude
Claude Code v1.0
Type 'exit' to quit

> /review
[paste your code here]

Claude will now review the code based on the review.md command template.

> /test
[paste your code here]

Claude will generate pytest tests based on the test.md command template.

> /explain
[paste your code here]

Claude will explain the code based on the explain.md command template.
```

### Command Best Practices

1. **Be specific**: Include clear instructions in your commands
2. **Use markdown**: Format commands with markdown for better readability
3. **Add context**: Include relevant details like coding standards or project conventions
4. **Organize by task**: Create separate commands for different workflows (review, test, refactor, etc.)

### Example Command Library

Create a library of commands for common tasks:

```bash
.claude/commands/
├── review.md          # Code review
├── test.md            # Generate tests
├── refactor.md        # Refactoring suggestions
├── optimize.md        # Performance optimization
├── document.md        # Add documentation
└── security.md        # Security audit
```

## Configuration

### API Key Management

Store your API key securely:

```bash
# In ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="sk-ant-..."

# Or use a secrets manager
export ANTHROPIC_API_KEY=$(cat ~/.secrets/anthropic_key)
```

### Custom Settings

```bash
# Set default model
export CLAUDE_MODEL="claude-sonnet-4-20250514"

# Set custom instructions
export CLAUDE_CODE_INSTRUCTIONS="Use type hints, write docstrings, follow PEP 8"

# Set timeout (in seconds)
export CLAUDE_TIMEOUT=120
```

## Troubleshooting

### API Key Issues

```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY

# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```

### Connection Issues

```bash
# Check network connectivity
ping api.anthropic.com

# Check for proxy issues
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

### Rate Limits

If you hit rate limits:

- Wait before retrying
- Use a higher tier API plan
- Optimize your prompts to use fewer tokens

## Comparison: Anthropic API vs Databricks CCR

| Feature | Anthropic API | Databricks CCR |
|---------|---------------|----------------|
| **Extended Thinking** | ✅ Yes | ❌ No |
| **All Models** | ✅ Yes | ❌ Only Sonnet 4 |
| **Latest Features** | ✅ Immediate | ⚠️ Delayed |
| **Cost** | 💰 Per-token pricing | ✅ Included in Databricks |
| **Setup** | API key required | Auto-configured |
| **Use Case** | Production, personal | Databricks workshops |

## Next Steps

<div class="grid cards" markdown>

- **[CCR Configuration →](claude-code-router.md)**

    Use Claude Code with Databricks models

- **[Other Coding Assistants →](index.md)**

    Explore more tools

- **[Anthropic Documentation →](https://docs.anthropic.com/)**

    Official Claude API docs

</div>
