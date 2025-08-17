# MCP Server Configuration for Claude Code

This document explains how to configure Claude Code to connect to the Obsidian HTTP MCP plugin.

## Configuration Files

Two configuration files are provided:

### 1. `claude-mcp-config.json` (Recommended)
This configuration uses environment variables for flexibility and security:

```json
{
  "mcpServers": {
    "obsidian-http-mcp": {
      "type": "sse",
      "url": "${OBSIDIAN_MCP_URL:-http://localhost:27125}/rpc",
      "headers": {
        "X-API-Key": "${OBSIDIAN_MCP_API_KEY:-test-key-123}",
        "Content-Type": "application/json"
      }
    }
  }
}
```

**Environment Variables:**
- `OBSIDIAN_MCP_URL`: The base URL of your Obsidian MCP server (defaults to `http://localhost:27125`)
- `OBSIDIAN_MCP_API_KEY`: Your API key for authentication (defaults to `test-key-123`)

### 2. `claude-desktop-config.json` (Simple)
This configuration has hardcoded values for quick testing:

```json
{
  "mcpServers": {
    "obsidian-http-mcp": {
      "type": "sse",
      "url": "http://localhost:27125/rpc",
      "headers": {
        "X-API-Key": "test-key-123",
        "Content-Type": "application/json"
      }
    }
  }
}
```

## How to Use

### Option 1: Environment Variables (Recommended)

1. Set the environment variables:
   ```bash
   export OBSIDIAN_MCP_URL="http://localhost:27125"
   export OBSIDIAN_MCP_API_KEY="your-actual-api-key"
   ```

2. Copy the content of `claude-mcp-config.json` to your Claude Code configuration file.

### Option 2: Direct Configuration

1. Update the API key in `claude-desktop-config.json` to match your Obsidian plugin settings.
2. Copy the content to your Claude Code configuration file.

## Claude Code Configuration Location

The configuration should be added to Claude Code's MCP configuration file. The exact location depends on your setup, but typically it's in a `.claude.json` or similar configuration file.

## Server Configuration

The Obsidian HTTP MCP plugin should be configured with:
- **Port**: 27125 (default)
- **API Key**: Set in the Obsidian plugin settings
- **External Access**: Enable if Claude Code runs on a different machine

## Available Methods

Once connected, Claude Code will have access to these Obsidian vault operations:

- `list_files_in_vault`: List all files in the vault
- `list_files_in_dir`: List files in a specific directory
- `get_file_contents`: Read file contents
- `append_content`: Append content to a file
- `patch_content`: Patch content at specific locations (headings, etc.)
- `simple_search`: Search for text across the vault
- `delete_file`: Delete files (with confirmation)
- `dataview_query`: Execute Dataview queries (if enabled)

## Security Considerations

1. **API Key**: Use a strong, unique API key in production
2. **External Access**: Only enable if necessary and use firewall rules
3. **Rate Limiting**: Configure appropriate rate limits in the plugin
4. **Environment Variables**: Use environment variables to avoid hardcoding secrets

## Troubleshooting

1. **Connection Failed**: Verify the Obsidian plugin is running and the port is correct
2. **Authentication Error**: Check that the API key matches between configurations
3. **CORS Issues**: The plugin includes CORS headers, but ensure your setup allows cross-origin requests
4. **Rate Limiting**: If requests fail, check if you're hitting the rate limit

## Example Usage

After configuration, Claude Code can interact with your Obsidian vault:

```
Can you list all files in my vault?
Can you search for "meeting notes" in my vault?
Can you read the contents of my daily note?
Can you append a new task to my todo.md file?
```