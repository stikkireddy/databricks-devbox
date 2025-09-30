import os
import json
from pathlib import Path
import time
import subprocess
from databricks.sdk import WorkspaceClient

DEFAULT_ROOT_DIR = "/app/python/source_code"
DEFAULT_ROOT_DIR_PATH = Path(DEFAULT_ROOT_DIR)

def generate_spn_token(duration_seconds = 3600):
    w = WorkspaceClient()
    token_expiry = int(os.environ.get("CLAUDE_CODE_TOKEN_EXPIRY_SECONDS", duration_seconds))
    token = w.tokens.create(comment=f"sdk-{time.time_ns()}", lifetime_seconds=token_expiry).token_value
    return token

def ensure_https_url(url: str):
    if not url.startswith("https://"):
        return f"https://{url}"
    return url

def setup_databricks_cfg():
    cfg_content = f"""
[DEFAULT]
host = {ensure_https_url(os.environ['DATABRICKS_HOST'])}
client_id = {os.environ['DATABRICKS_CLIENT_ID']}
client_secret = {os.environ['DATABRICKS_CLIENT_SECRET']}
"""
    with open(DEFAULT_ROOT_DIR_PATH / ".databrickscfg", "w") as f:
        f.write(cfg_content)

def make_config(databricks_token: str, root_dir: Path = DEFAULT_ROOT_DIR_PATH):
    transformers = DEFAULT_ROOT_DIR_PATH / ".claude-code-router/plugins/databricks-claude-transformers.js"
    transformers_path = str(transformers)
    databricks_host = os.environ["DATABRICKS_HOST"]

    return {
      "LOG": False,
      "LOG_LEVEL": "debug",
      "CLAUDE_PATH": "",
      "HOST": "127.0.0.1",
      "PORT": 3456,
      "APIKEY": "",
      "API_TIMEOUT_MS": "600000",
      "PROXY_URL": "",
      "transformers": [
          {
            "path": transformers_path,
            "options": {
              "debug": False
            }
          }
      ],
      "Providers": [
        {
          "name": "databricks",
          "api_base_url": f"https://{databricks_host}/serving-endpoints/databricks-claude-sonnet-4/invocations",
          "api_key": databricks_token,
          "models": [
            "databricks-claude-sonnet-4"
          ],
          "transformer": {
            "use": [
              "OpenAI",
              "databricks-custom"
            ],
            "databricks-claude-sonnet-4": {
              "use": [
                "OpenAI",
                "databricks-custom"
              ]
            }
          }
        }
      ],
      "StatusLine": {
        "enabled": False,
        "currentStyle": "default",
        "default": {
          "modules": []
        },
        "powerline": {
          "modules": []
        }
      },
      "Router": {
        "default": "databricks,databricks-claude-sonnet-4"
      }
    }

def get_databricks_transformers_js():
    return """const fs = require('fs');
const path = require('path');
const os = require('os');

class DatabricksTransformer {
    constructor(options = {}) {
      this.name = 'databricks-custom';
      this.options = {
        debug: false,
        ...options
      };
      this.logFile = path.join(os.homedir(), '.claude-code-router/plugin.log');
  
  
      this.log('Initialized Databricks Custom Transformer');
    }
  
    log(...args) {
      if (this.options.debug) {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] [DatabricksTransformer] ${args.join(' ')}\n`;
        
        try {
          fs.appendFileSync(this.logFile, message);
        } catch (error) {
          console.error('Failed to write to log file:', error);
        }
        
        console.log('[DatabricksTransformer]', ...args);
      }
    }

     /**
   * Transform Claude/OpenAI request to Databricks format
   * CCR calls this method: transformRequestIn
   */
  async transformRequestIn(request, provider) {
    this.log('transformRequestIn called - Transforming request:', JSON.stringify(request, null, 2));
    this.log('Provider object:', JSON.stringify(provider, null, 2));

    try {
      
      // FIXED: Construct proper Databricks URL with fallback
      const url = provider.api_base_url;
      this.log('Target URL:', url);



      // remove messages which have empty text block
      // Remove messages with empty content and strip cache_control from all messages
      request.messages = request.messages
        .map(message => {
    
          // FIXED: Handle empty content for tool calls the message content should be null and not empty string
          if (message.content === "")  {
            message.content = null;
          }
          if (Array.isArray(message.content)) {
            // Handle content arrays - remove cache_control from each content item
            message.content = message.content.map(contentItem => {
                if (contentItem.type === "image_url" && !contentItem.image_url.url.includes("base64")) {
                    const url = contentItem.image_url.url
                    const urlParts = url.split(",")
                    const urlFixed = urlParts[0] + ";" + "base64";
                    const finalUrl = urlFixed + "," + urlParts[1];
                    contentItem.image_url.url = finalUrl;
                }
            
              const { cache_control, ...cleanContentItem } = contentItem;
              return cleanContentItem;
            });
          }
          // Also remove cache_control from the message level if it exists
          const { cache_control, ...cleanMessage } = message;
          return cleanMessage;
        });

      const { parallel_tool_calls, ...cleanRequest } = request;

      this.log('Databricks request body:', JSON.stringify(request, null, 2));

      return {
        ...request,
      };

    } catch (error) {
      this.log('Error in transformRequestIn - Databricks:', error);
      throw error;
    }
  }
}

module.exports = DatabricksTransformer;
"""

def materialize_configs(databricks_token: str):
    target_dir = DEFAULT_ROOT_DIR_PATH / ".claude-code-router"
    plugins_dir = target_dir / "plugins"

    target_dir.mkdir(parents=True, exist_ok=True)
    plugins_dir.mkdir(parents=True, exist_ok=True)

    # Write config.json
    config = make_config(databricks_token)
    with open(target_dir / "config.json", "w") as f:
        json.dump(config, f, indent=2)

    # Write databricks transformer plugin
    transformers_js = get_databricks_transformers_js()
    with open(plugins_dir / "databricks-claude-transformers.js", "w") as f:
        f.write(transformers_js)

def _run(cmd, env=None):
    return subprocess.run(cmd, check=True, text=True, env=env or os.environ)

def setup_node_and_vibe_coding_tools():
    from pathlib import Path
    print("Setting up npm global user dir")
    HOME = os.environ['HOME']
    PATH = os.environ['PATH']
    Path(f"{HOME}/.npm-global/bin").mkdir(parents=True, exist_ok=True)
    os.environ["NPM_CONFIG_PREFIX"] = f"{HOME}/.npm-global"
    os.environ["PATH"] = f"{HOME}/.npm-global/bin:{PATH}"
    print("Finished setting up npm global user dir")
    databricks_token = generate_spn_token()
    materialize_configs(databricks_token)

    # install 
    # npm install -g @anthropic-ai/claude-code
    _run(["npm", "install", "-g", "@anthropic-ai/claude-code"], env=os.environ)

    # npm install -g @musistudio/claude-code-router
    _run(["npm", "install", "-g", "@musistudio/claude-code-router"], env=os.environ)

    # npm install -g @openai/codex
    _run(["npm", "install", "-g", "@openai/codex"], env=os.environ)

    # npm install -g @google/gemini-cli
    _run(["npm", "install", "-g", "@google/gemini-cli"], env=os.environ)

    # restart ccr proxy
    _run(["ccr", "restart"], env=os.environ)

    # echo 'alias cc="ccr restart && ccr code"' >> ~/.bashrc
    # Ensure alias is in ~/.bashrc
    bashrc = Path(HOME) / ".bashrc"
    ccr_code_alias = 'alias cc="ccr code"'
    codex_alias = "alias codex='mkdir -p $CODEX_HOME && \codex'"

    if bashrc.exists():
        with open(bashrc, "r") as f:
            lines = f.read().splitlines()
    else:
        lines = []

    if not any(l.strip() == ccr_code_alias for l in lines):
        with open(bashrc, "a") as f:
            f.write("\n")
            f.write(f"{ccr_code_alias}\n")
            f.write(f"{codex_alias}\n")
        print(f"Added alias to {bashrc}")
    else:
        print("Alias already present in .bashrc")

    print("Run `source ~/.bashrc` or restart your shell to activate alias.")

