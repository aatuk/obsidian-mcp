#!/bin/sh

# Script to reconfigure Claude MCP with the current API key from file

# Read API key from file
if [ ! -f "OBSIDIAN_API_KEY.key" ]; then
    echo "Error: OBSIDIAN_API_KEY.key file not found"
    exit 1
fi

API_KEY=$(cat OBSIDIAN_API_KEY.key)

echo "Removing existing obsidian-vault MCP server..."
claude mcp remove obsidian-vault

echo "Adding obsidian-vault MCP server with new API key..."
claude mcp add --transport http obsidian-vault http://localhost:27125/rpc --header "X-API-Key: $API_KEY"

echo "MCP server reconfigured successfully!"
echo "Please restart your Claude session to use the new configuration."