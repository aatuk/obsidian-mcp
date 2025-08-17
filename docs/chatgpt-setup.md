# ChatGPT Custom GPT Setup Guide

This guide explains how to create a ChatGPT Custom GPT that can access your Obsidian vault through the MCP server.

## Prerequisites

1. The MCP server must be running in Obsidian
2. The SSH tunnel must be active (if using remote access)
3. You need a ChatGPT Plus, Team, or Enterprise account

## Setup Instructions

### 1. Create a New Custom GPT

1. Go to [ChatGPT](https://chat.openai.com)
2. Click on your profile → "My GPTs"
3. Click "Create a GPT"

### 2. Configure the GPT

In the **Configure** tab, set:

**Name**: Obsidian Vault Assistant (or your preference)

**Description**: 
```
An AI assistant that can access and manage your Obsidian vault, execute Dataview queries, search notes, and help organize your knowledge base.
```

**Instructions**:
```
You are an assistant with direct access to an Obsidian vault. You can:
- List and read files from the vault
- Search for content across all notes
- Append content to existing files or create new ones
- Execute Dataview queries to analyze vault data
- Patch specific sections of files (headings, blocks, frontmatter)
- Help organize and manage the knowledge base

When working with the vault:
1. Always check existing content before creating new files
2. Follow the vault's existing organizational structure
3. Use Dataview queries to find related content
4. Maintain consistent formatting and tagging conventions
```

### 3. Add the Action

1. In the Configure tab, scroll down to **Actions**
2. Click "Create new action"
3. Click "Import from URL" or paste the schema directly

**Schema URL** (if your OpenAPI spec is hosted):
```
https://acausalcompassion.org/obsidian-mcp/{your-api-key}/openapi.yaml
```

Or paste the contents of `openapi.yaml` directly.

### 4. Configure Authentication

Since we use path-based authentication, set:
- **Authentication**: None
- The API key is embedded in the server URL

### 5. Set the Server URL

In the action configuration, update the server URL with your actual API key:

```
https://acausalcompassion.org/obsidian-mcp/YOUR_ACTUAL_API_KEY_HERE
```

Replace `YOUR_ACTUAL_API_KEY_HERE` with your actual API key from `OBSIDIAN_API_KEY.key`.

### 6. Test the Connection

Use the "Test" button to verify the connection. Try a simple operation like:
- List files: Tests the `/api/files` endpoint
- Get a specific file: Tests the `/api/files/{filepath}` endpoint

### 7. Privacy Settings

Configure based on your needs:
- **Web Browsing**: Optional
- **DALL·E Image Generation**: Optional
- **Code Interpreter**: Recommended (for data analysis)

## Example Prompts to Test

Once configured, try these prompts:

1. "List all files in the llm-notes/tasks directory"
2. "Search for notes mentioning 'ChatGPT'"
3. "Show me today's tasks using a Dataview query"
4. "Get the contents of CLAUDE.md"
5. "Create a new task note for implementing a new feature"
6. "Update the status of task 2025-08-17-ssh-tunnel.md to completed"

## Troubleshooting

### "Unauthorized" Error
- Verify your API key is correct
- Check that the MCP server is running in Obsidian
- Ensure the SSH tunnel is active (if using remote access)

### "Not Found" Errors
- Check the file path is correct (case-sensitive)
- Verify the file exists in your vault
- Use the list files endpoint to see available files

### Connection Timeouts
- Check if the SSH tunnel is still active
- Verify the nginx proxy is configured correctly
- Test the health endpoint: `https://your-server/obsidian-mcp/{api-key}/health`

### Dataview Queries Not Working
- Ensure the Dataview plugin is installed and enabled in Obsidian
- Check query syntax is correct
- Use the validate endpoint first to test queries

## Security Notes

1. **API Key Protection**: Your API key is visible in the GPT configuration. Only share your GPT with trusted users.
2. **Vault Access**: The GPT has full read/write access to your vault. Be cautious with destructive operations.
3. **Rate Limiting**: The server includes rate limiting (60 requests/minute by default).

## Advanced Usage

### Custom Instructions for Your Vault

Add vault-specific instructions to your GPT based on your organizational structure:

```
This vault uses the following conventions:
- Tasks are stored in llm-notes/tasks/ with format YYYY-MM-DD-description.md
- All tasks have frontmatter with status, priority, owner fields
- Use tags like #task/project-name for organization
- Sessions are in llm-notes/sessions/YYYY-MM-DD-llmname/
```

### Useful Dataview Queries

Include these in your GPT instructions for quick access:

```
Common queries:
- Open tasks: TABLE status, priority FROM "llm-notes/tasks" WHERE status != "done"
- Today's items: LIST WHERE file.mtime >= date(today)
- Recent sessions: TABLE project FROM "llm-notes/sessions" SORT file.mtime DESC
```

## Support

For issues with:
- The MCP server: Check the Obsidian console (Ctrl+Shift+I)
- Remote access: Verify SSH tunnel and nginx configuration
- ChatGPT: Check OpenAI's Custom GPT documentation