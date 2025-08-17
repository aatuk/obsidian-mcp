#!/bin/sh

API_KEY="${API_KEY:-test-key-123}"
BASE_URL="${BASE_URL:-http://localhost:27125}"

echo "Testing HTTP MCP Server at $BASE_URL"
echo "Using API Key: $API_KEY"
echo ""

echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" -H "X-API-Key: $API_KEY" | jq .
echo ""

echo "2. Testing list_files_in_vault..."
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"list_files_in_vault","params":{},"id":1}' | jq .
echo ""

echo "3. Testing get_file_contents (CLAUDE.md)..."
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_file_contents","params":{"filepath":"CLAUDE.md"},"id":2}' | jq .
echo ""

echo "4. Testing simple_search..."
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"simple_search","params":{"query":"MCP","context_length":50},"id":3}' | jq .
echo ""

echo "5. Testing append_content to test file..."
TEST_FILE="test-mcp-$(date +%s).md"
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"append_content\",\"params\":{\"filepath\":\"$TEST_FILE\",\"content\":\"# Test file\\n\\nCreated by MCP API test\\n\"},\"id\":4}" | jq .
echo "Created test file: $TEST_FILE"
echo ""

echo "6. Testing dataview_query (if enabled)..."
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"dataview_query","params":{"query":"LIST FROM \"\""},"id":5}' | jq .
echo ""

echo "7. Testing unauthorized request (should fail)..."
curl -s -X POST "$BASE_URL/rpc" \
  -H "X-API-Key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"list_files_in_vault","params":{},"id":6}'
echo ""

echo "Test complete!"
