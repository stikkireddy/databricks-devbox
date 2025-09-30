# Packaged Assets & Templates

Packaged assets provide quick-start templates for common development scenarios.

## Overview

Templates allow users to:

- **Quick start** with pre-configured environments
- **Clone GitHub repositories** automatically
- **Pre-install extensions** for specific workflows
- **Organize templates** into tabs/categories

## Configuration Example

```yaml
packaged_assets:
  tabs:
  - name: "Workshops"
    items:
    - name: "Databricks Workshop"
      description: "Complete workshop environment"
      extensions_groups:
        - "python"
        - "databricks"
      thumbnail_url: "https://example.com/thumbnail.jpg"
      github_url: "https://github.com/stikkireddy/chicago-vibe-coding.git"
      icon_links:
        - lucide_icon: "book"
          url: "https://docs.databricks.com"
```

See `app/devbox.yaml` for complete configuration examples.