# Obsidian MCP Plugin Project

## Quick Start
You have access to an Obsidian vault via the MCP server `obsidian-vault`. 
**Start by reading**: `CLAUDE.md` in the vault root using the MCP server.

## Project Overview
This is an Obsidian plugin that provides an HTTP-based MCP (Model Context Protocol) server, 
enabling AI assistants to interact with Obsidian vaults.

## Key Commands
```bash
# Build and deploy plugin
./update-plugin LLMVault

# Test the API
./test-api.sh

# Reconfigure MCP server with new API key
./reconfigure-mcp.sh

# Reload plugin in Obsidian
# Manual action: Cmd+P → "Reload app without saving" in Obsidian
```

## MCP Tools Available
- `list_files_in_vault` - List all vault files
- `get_file_contents` - Read note content
- `append_content` - Add to notes
- `patch_content` - Modify specific sections
- `simple_search` - Search vault content
- `dataview_query` - Execute Dataview queries
- `validate_dataview_query` - Test queries
- `get_rendered_content` - Get rendered HTML with Dataview results

## Vault Philosophy
The LLMVault uses a graph database approach where:
- Every entity is an atomic note with metadata
- Relationships are defined via frontmatter fields
- All lists are Dataview queries, never hardcoded
- See `llm-notes/meta/vault-conventions` for details
