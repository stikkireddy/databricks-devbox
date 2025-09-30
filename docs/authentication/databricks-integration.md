# Databricks Integration

Databricks DevBox integrates with Databricks using the Databricks SDK for Python to handle authentication and token management.

## Databricks SDK

The app uses `databricks.sdk.WorkspaceClient` for all Databricks interactions.

### Authentication

When deployed as a Databricks App, the SDK automatically authenticates using:

- **Service Principal** credentials injected by Databricks
- **Unity Catalog** integration for token management
- **Workspace context** from `DATABRICKS_HOST` environment variable

!!! warning "Credential Storage"
    Authentication credentials are stored in the following locations:

    - **PAT Token**: Stored in `~/.claude-code-router/config.json`
    - **Service Principal Credentials**: `client_id` and `client_secret` stored in `~/.databrickscfg`

    **Security Note**: All users with access to the app share the same service principal. This is expected behavior since these credentials are already available in the app's environment variables. The shared service principal model is appropriate for multi-user Databricks App deployments.

### Code Reference

```python
# app/vibe_code.py:12
from databricks.sdk import WorkspaceClient

def generate_spn_token(duration_seconds = 3600):
    w = WorkspaceClient()  # Auto-authenticates in Databricks App context
    token = w.tokens.create(
        comment=f"sdk-{time.time_ns()}",
        lifetime_seconds=duration_seconds
    ).token_value
    return token
```

## Environment Variables

The app relies on Databricks-provided environment variables:

```yaml
# Automatically set by Databricks App runtime
DATABRICKS_HOST=<workspace-url>
DATABRICKS_CLIENT_ID=<client-id>
DATABRICKS_CLIENT_SECRET=<client-secret>
```

## Token Management

See [Token Management](tokens.md) for details on token generation and lifecycle.

## Next Steps

<div class="grid cards" markdown>

- **[Token Management →](tokens.md)**

    Token generation and usage

- **[Installation →](../installation/databricks-app.md)**

    Deploy as Databricks App

</div>