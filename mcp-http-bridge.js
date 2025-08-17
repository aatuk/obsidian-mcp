#!/usr/bin/env node

const readline = require("readline");
const http = require("http");

const MCP_URL = process.env.OBSIDIAN_MCP_URL || "http://localhost:27125";
const API_KEY = process.env.OBSIDIAN_MCP_API_KEY || "test-key-123";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Log function for debugging (outputs to stderr)
function log(message) {
  process.stderr.write(`[Bridge] ${message}\n`);
}

// Handle incoming JSON-RPC requests from stdio
rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);

    // Forward the request to the HTTP server
    const response = await forwardToHTTP(request);

    // Send response back via stdout
    process.stdout.write(JSON.stringify(response) + "\n");
  } catch (error) {
    log(`Error processing request: ${error.message}`);
    const errorResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error.message,
      },
      id: null,
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

async function forwardToHTTP(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${MCP_URL}/rpc`);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(JSON.stringify(request));
    req.end();
  });
}

// Handle initialization
process.stdout.write(
  JSON.stringify({
    jsonrpc: "2.0",
    result: {
      capabilities: {
        tools: {
          list_files_in_vault: {},
          list_files_in_dir: { dirpath: "string" },
          get_file_contents: { filepath: "string" },
          append_content: { filepath: "string", content: "string" },
          patch_content: {
            filepath: "string",
            operation: "string",
            target_type: "string",
            target: "string",
            content: "string",
          },
          simple_search: { query: "string", context_length: "number" },
          delete_file: { filepath: "string", confirm: "boolean" },
          dataview_query: { query: "string" },
        },
      },
    },
    id: "init",
  }) + "\n",
);

log("MCP HTTP Bridge started");
log(`Forwarding to: ${MCP_URL}`);
log(`Using API Key: ${API_KEY.substring(0, 4)}...`);
