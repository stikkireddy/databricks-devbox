# Installation Overview

Databricks DevBox can be deployed in two main ways:

1. **[As a Databricks Lakehouse App](#databricks-app)** (Recommended for production)
2. **[Local Development Setup](#local-setup)** (For testing and development)

## Databricks App

Deploy Databricks DevBox as a serverless Lakehouse App within your Databricks workspace.

**Best for:**

- Production deployments
- Team collaboration
- Training and workshops
- Enterprise environments

[View Databricks App Installation →](databricks-app.md)

## Local Setup

Run Databricks DevBox locally for development and testing.

**Best for:**

- Development and testing
- Feature development
- Learning and experimentation
- Offline usage

[View Local Setup Guide →](local-setup.md)

## System Requirements

### For Databricks App

- Databricks Workspace (AWS, Azure, or GCP)
- Unity Catalog enabled (recommended)
- Databricks Runtime 13.3 LTS or higher

### For Local Development

- Python 3.11+
- Go 1.21+ (for building from source)
- Node.js 18+ (for web UI development)
- Docker (optional, for containerized deployment)

## Next Steps

Choose your deployment method:

<div class="grid cards" markdown>

- **[Deploy to Databricks →](databricks-app.md)**

    Full production deployment guide

- **[Local Development →](local-setup.md)**

    Set up for local testing

</div>