# ChatGPT Custom GPT - Quick Setup Guide

## 1. Create Custom GPT
Go to [ChatGPT](https://chat.openai.com) → My GPTs → Create a GPT

## 2. Add Action
In Configure tab → Actions → Create new action

## 3. Import OpenAPI Schema
Either:
- Click "Import from URL" (if you host the openapi.yaml file)
- Or paste the contents of `openapi.yaml` directly

## 4. Configure Authentication

**Authentication Type**: API Key

**Auth Type**: Custom

**Custom Header Name**: `X-API-Key`

**API Key Value**: Your actual API key (from OBSIDIAN_API_KEY.key)

## 5. Verify Server URL

The OpenAPI spec should automatically set:
- **Server URL**: `https://acausalcompassion.org/obsidian-mcp`

## 6. Test
Click "Test" and try:
- List files: Should return your vault files
- Get file: Try getting "CLAUDE.md"

## 7. Save and Use

Name your GPT something like "Obsidian Vault Assistant" and start using it!

## Example Prompts

- "List all files in the llm-notes/tasks folder"
- "Search for mentions of 'nginx' in the vault"
- "Get the contents of the main project file"
- "Run a Dataview query to show all high priority tasks"
- "Append a new section to my daily note"

## Troubleshooting

**"Unauthorized" error**: 
- Check that X-API-Key is exactly as shown (case matters)
- Verify your API key is correct
- Make sure the MCP server is running in Obsidian

**Connection errors**:
- Ensure SSH tunnel is active
- Check that Obsidian plugin is running
- Try the health endpoint first

## Security Note

Your API key gives full access to your vault. Only share your Custom GPT with trusted users.