# Obsidian HTTP MCP Plugin

An Obsidian plugin that implements an HTTP-based Model Context Protocol (MCP) server, allowing AI assistants like Claude to directly interact with your Obsidian vault.

## Features

- **HTTP MCP Server**: Runs on port 27125 (configurable)
- **API Key Authentication**: Secure access with X-API-Key header
- **Rate Limiting**: Configurable requests per minute limit
- **Full Vault Access**: Read, write, search, and manage files
- **Dataview Integration**: Execute Dataview queries via API

## Available MCP Tools

1. `list_files_in_vault` - List all files in the vault
2. `list_files_in_dir` - List files in a specific directory
3. `get_file_contents` - Read file contents
4. `append_content` - Append content to files
5. `simple_search` - Search for text across the vault
6. `patch_content` - Modify specific sections (headings, blocks, frontmatter)
7. `delete_file` - Delete files (with confirmation)
8. `dataview_query` - Execute Dataview DQL queries

## Installation

1. Build the plugin:
   ```bash
   npm install
   npm run build
   ```

2. Copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/obsidian-http-mcp/` directory

3. Enable the plugin in Obsidian settings

4. Configure the API key in plugin settings

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Deploy to Obsidian (update path in script)
./update-plugin

# Test the API
./test-api.sh
```

## MCP Client Configuration

### Claude Desktop/Code
```bash
claude mcp add --transport http obsidian-vault http://localhost:27125/rpc \
  --header "X-API-Key: your-api-key"
```

### Direct API Testing
```bash
curl -X POST http://localhost:27125/rpc \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

## Security

- API key required for all requests
- Rate limiting to prevent abuse
- Optional external access control
- Dataview queries can be disabled

## Protocol

The server implements JSON-RPC 2.0 protocol with MCP extensions:
- `initialize` - Protocol handshake
- `tools/list` - List available tools
- `tools/call` - Execute a tool

## License

MIT