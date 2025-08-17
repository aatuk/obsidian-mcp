import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import * as http from "http";

interface HTTPMCPSettings {
  port: number;
  apiKey: string;
  enableExternalAccess: boolean;
  enableDataviewQueries: boolean;
  rateLimitPerMinute: number;
}

const DEFAULT_SETTINGS: HTTPMCPSettings = {
  port: 27125,
  apiKey: "",
  enableExternalAccess: false,
  enableDataviewQueries: true,
  rateLimitPerMinute: 60,
};

export default class HTTPMCPPlugin extends Plugin {
  settings: HTTPMCPSettings;
  server: http.Server | null = null;
  private requestCounts: Map<string, { count: number; resetTime: number }> =
    new Map();

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "start-mcp-server",
      name: "Start MCP Server",
      callback: () => this.startServer(),
    });

    this.addCommand({
      id: "stop-mcp-server",
      name: "Stop MCP Server",
      callback: () => this.stopServer(),
    });

    this.addCommand({
      id: "restart-mcp-server",
      name: "Restart MCP Server",
      callback: async () => {
        this.stopServer();
        await this.startServer();
      },
    });

    this.addSettingTab(new HTTPMCPSettingTab(this.app, this));

    if (this.settings.apiKey) {
      await this.startServer();
    }
  }

  onunload() {
    this.stopServer();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async startServer() {
    if (this.server) {
      new Notice("MCP Server is already running");
      return;
    }

    if (!this.settings.apiKey) {
      new Notice(
        "Please set an API key in settings before starting the server",
      );
      return;
    }

    try {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      const host = this.settings.enableExternalAccess ? "0.0.0.0" : "127.0.0.1";

      this.server.listen(this.settings.port, host, () => {
        console.log(`MCP Server running on ${host}:${this.settings.port}`);
        new Notice(`MCP Server started on port ${this.settings.port}`);
      });

      this.server.on("error", (error: any) => {
        console.error("MCP Server error:", error);
        if (error.code === "EADDRINUSE") {
          new Notice(`Port ${this.settings.port} is already in use`);
        } else {
          new Notice(`Server error: ${error.message}`);
        }
        this.server = null;
      });
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      new Notice("Failed to start MCP server");
      this.server = null;
    }
  }

  stopServer() {
    if (this.server) {
      this.server.close(() => {
        console.log("MCP Server stopped");
        new Notice("MCP Server stopped");
      });
      this.server = null;
    }
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey !== this.settings.apiKey) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const clientIp = req.socket.remoteAddress || "unknown";
    if (!this.checkRateLimit(clientIp)) {
      res.writeHead(429);
      res.end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          server: "obsidian-http-mcp-plugin",
          version: this.manifest.version,
          vault: this.app.vault.getName(),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (req.method !== "POST" || req.url !== "/rpc") {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const body = await this.readBody(req);
      const request = JSON.parse(body);

      if (!request.method) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Invalid request - missing method",
            },
            id: request.id || null,
          }),
        );
        return;
      }

      console.log(
        "MCP Request:",
        request.method,
        request.params,
        "ID:",
        request.id,
      );

      try {
        const result = await this.executeMethod(
          request.method,
          request.params || {},
        );

        // If there's no ID, this is a notification and we shouldn't respond
        if (request.id === undefined) {
          res.writeHead(200);
          res.end();
          return;
        }

        res.writeHead(200);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            result,
            id: request.id,
          }),
        );
      } catch (error: any) {
        console.error("Method execution error:", error);

        // Only send error response if there's an ID
        if (request.id !== undefined) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: error.message || "Internal error",
              },
              id: request.id,
            }),
          );
        } else {
          res.writeHead(200);
          res.end();
        }
      }
    } catch (error: any) {
      console.error("Request handling error:", error);
      res.writeHead(400);
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        }),
      );
    }
  }

  private checkRateLimit(clientIp: string): boolean {
    const now = Date.now();
    const limit = this.requestCounts.get(clientIp);

    if (!limit || now > limit.resetTime) {
      this.requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + 60000,
      });
      return true;
    }

    if (limit.count >= this.settings.rateLimitPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  private async executeMethod(method: string, params: any): Promise<any> {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: "obsidian-http-mcp",
            version: this.manifest.version,
          },
        };

      case "tools/list":
        return {
          tools: [
            {
              name: "list_files_in_vault",
              description: "List all files in the Obsidian vault",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
            {
              name: "list_files_in_dir",
              description: "List files in a specific directory",
              inputSchema: {
                type: "object",
                properties: {
                  dirpath: { type: "string", description: "Directory path" },
                },
                required: ["dirpath"],
              },
            },
            {
              name: "get_file_contents",
              description: "Get the contents of a file",
              inputSchema: {
                type: "object",
                properties: {
                  filepath: { type: "string", description: "File path" },
                },
                required: ["filepath"],
              },
            },
            {
              name: "append_content",
              description: "Append content to a file",
              inputSchema: {
                type: "object",
                properties: {
                  filepath: { type: "string", description: "File path" },
                  content: { type: "string", description: "Content to append" },
                },
                required: ["filepath", "content"],
              },
            },
            {
              name: "simple_search",
              description: "Search for text in the vault",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                  context_length: {
                    type: "number",
                    description: "Context length",
                    default: 100,
                  },
                },
                required: ["query"],
              },
            },
            {
              name: "patch_content",
              description:
                "Patch content at specific locations (headings, blocks, frontmatter)",
              inputSchema: {
                type: "object",
                properties: {
                  filepath: { type: "string", description: "File path" },
                  operation: {
                    type: "string",
                    enum: ["append", "prepend", "replace"],
                    description: "Operation type",
                  },
                  target_type: {
                    type: "string",
                    enum: ["heading", "block", "frontmatter"],
                    description: "Target type",
                  },
                  target: { type: "string", description: "Target identifier" },
                  content: { type: "string", description: "Content to patch" },
                },
                required: [
                  "filepath",
                  "operation",
                  "target_type",
                  "target",
                  "content",
                ],
              },
            },
            {
              name: "delete_file",
              description:
                "Delete a file from the vault (requires confirmation)",
              inputSchema: {
                type: "object",
                properties: {
                  filepath: {
                    type: "string",
                    description: "File path to delete",
                  },
                  confirm: {
                    type: "boolean",
                    description: "Confirmation flag",
                  },
                },
                required: ["filepath", "confirm"],
              },
            },
            {
              name: "dataview_query",
              description:
                "Execute a Dataview DQL query (requires Dataview plugin)",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Dataview DQL query" },
                },
                required: ["query"],
              },
            },
            {
              name: "validate_dataview_query",
              description:
                "Validate a Dataview query and return results or errors",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Dataview query to validate",
                  },
                  type: {
                    type: "string",
                    enum: ["DQL", "JS"],
                    description: "Query type (default: DQL)",
                    default: "DQL",
                  },
                },
                required: ["query"],
              },
            },
            {
              name: "get_rendered_content",
              description:
                "Get the rendered HTML content of a note including Dataview query results",
              inputSchema: {
                type: "object",
                properties: {
                  filepath: {
                    type: "string",
                    description: "File path to render",
                  },
                },
                required: ["filepath"],
              },
            },
          ],
        };

      case "tools/call":
        return await this.callTool(params.name, params.arguments || {});

      case "list_files_in_vault":
        return await this.listFilesInVault();

      case "list_files_in_dir":
        return await this.listFilesInDir(params.dirpath);

      case "get_file_contents":
        return await this.getFileContents(params.filepath);

      case "append_content":
        return await this.appendContent(params.filepath, params.content);

      case "patch_content":
        return await this.patchContent(params);

      case "simple_search":
        return await this.simpleSearch(params.query, params.context_length);

      case "delete_file":
        return await this.deleteFile(params.filepath, params.confirm);

      case "dataview_query":
        if (!this.settings.enableDataviewQueries) {
          throw new Error("Dataview queries are disabled");
        }
        return await this.dataviewQuery(params.query);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "list_files_in_vault":
        const files = await this.listFilesInVault();
        return { content: [{ type: "text", text: JSON.stringify(files) }] };
      case "list_files_in_dir":
        const dirFiles = await this.listFilesInDir(args.dirpath);
        return { content: [{ type: "text", text: JSON.stringify(dirFiles) }] };
      case "get_file_contents":
        const fileContent = await this.getFileContents(args.filepath);
        return { content: [{ type: "text", text: fileContent }] };
      case "append_content":
        await this.appendContent(args.filepath, args.content);
        return {
          content: [{ type: "text", text: "Content appended successfully" }],
        };
      case "patch_content":
        await this.patchContent(args);
        return {
          content: [{ type: "text", text: "Content patched successfully" }],
        };
      case "simple_search":
        const searchResults = await this.simpleSearch(
          args.query,
          args.context_length,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(searchResults) }],
        };
      case "delete_file":
        await this.deleteFile(args.filepath, args.confirm);
        return {
          content: [{ type: "text", text: "File deleted successfully" }],
        };
      case "dataview_query":
        if (!this.settings.enableDataviewQueries) {
          throw new Error("Dataview queries are disabled");
        }
        const queryResult = await this.dataviewQuery(args.query);
        return {
          content: [{ type: "text", text: JSON.stringify(queryResult) }],
        };
      case "validate_dataview_query":
        if (!this.settings.enableDataviewQueries) {
          throw new Error("Dataview queries are disabled");
        }
        const validationResult = await this.validateDataviewQuery(
          args.query,
          args.type,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(validationResult) }],
        };
      case "get_rendered_content":
        const renderedContent = await this.getRenderedContent(args.filepath);
        return {
          content: [{ type: "text", text: JSON.stringify(renderedContent) }],
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async listFilesInVault(): Promise<string[]> {
    const files = this.app.vault.getFiles();
    return files.map((f) => f.path).sort();
  }

  private async listFilesInDir(dirpath: string): Promise<string[]> {
    const files = this.app.vault.getFiles();
    const prefix = dirpath.endsWith("/") ? dirpath : dirpath + "/";
    return files
      .map((f) => f.path)
      .filter((path) => path.startsWith(prefix))
      .sort();
  }

  private async getFileContents(filepath: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (!file || file.hasOwnProperty("children")) {
      throw new Error(`File not found: ${filepath}`);
    }
    return await this.app.vault.read(file as any);
  }

  private async appendContent(
    filepath: string,
    content: string,
  ): Promise<void> {
    let file = this.app.vault.getAbstractFileByPath(filepath);

    if (!file) {
      const dir = filepath.substring(0, filepath.lastIndexOf("/"));
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        await this.app.vault.createFolder(dir);
      }
      await this.app.vault.create(filepath, content);
    } else if (file.hasOwnProperty("children")) {
      throw new Error(`Path is a directory: ${filepath}`);
    } else {
      const existingContent = await this.app.vault.read(file as any);
      await this.app.vault.modify(file as any, existingContent + content);
    }
  }

  private async patchContent(params: any): Promise<void> {
    const { filepath, operation, target_type, target, content } = params;

    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (!file || file.hasOwnProperty("children")) {
      throw new Error(`File not found: ${filepath}`);
    }

    let fileContent = await this.app.vault.read(file as any);

    if (target_type === "heading") {
      const headingRegex = new RegExp(`^#{1,6}\\s+${target}\\s*$`, "m");
      const match = fileContent.match(headingRegex);

      if (!match) {
        throw new Error(`Heading not found: ${target}`);
      }

      const headingIndex = match.index!;
      const nextHeadingRegex = new RegExp(`^#{1,6}\\s+`, "m");
      const restOfContent = fileContent.substring(
        headingIndex + match[0].length,
      );
      const nextHeadingMatch = restOfContent.match(nextHeadingRegex);

      const sectionEnd = nextHeadingMatch
        ? headingIndex + match[0].length + nextHeadingMatch.index!
        : fileContent.length;

      const sectionContent = fileContent.substring(
        headingIndex + match[0].length,
        sectionEnd,
      );

      let newSectionContent: string;
      switch (operation) {
        case "append":
          newSectionContent = sectionContent + content;
          break;
        case "prepend":
          newSectionContent = content + sectionContent;
          break;
        case "replace":
          newSectionContent = content;
          break;
        default:
          throw new Error(`Invalid operation: ${operation}`);
      }

      fileContent =
        fileContent.substring(0, headingIndex + match[0].length) +
        newSectionContent +
        fileContent.substring(sectionEnd);
    } else if (target_type === "block") {
      // Find block with reference ID
      const blockRegex = new RegExp(`([^\n]*?)\\s*\\^${target}\\s*$`, "m");
      const match = fileContent.match(blockRegex);

      if (!match) {
        throw new Error(`Block reference not found: ^${target}`);
      }

      const blockStart = match.index!;
      const blockEnd = blockStart + match[0].length;
      const blockContent = match[1]; // Content without the ^id

      let newBlockContent: string;
      switch (operation) {
        case "append":
          newBlockContent = blockContent + content + ` ^${target}`;
          break;
        case "prepend":
          newBlockContent = content + blockContent + ` ^${target}`;
          break;
        case "replace":
          newBlockContent = content + ` ^${target}`;
          break;
        default:
          throw new Error(`Invalid operation: ${operation}`);
      }

      fileContent =
        fileContent.substring(0, blockStart) +
        newBlockContent +
        fileContent.substring(blockEnd);
    } else if (target_type === "frontmatter") {
      // Use Obsidian's processFrontMatter API for safe YAML handling
      await this.app.fileManager.processFrontMatter(
        file as any,
        (frontmatter) => {
          const keys = target.split("."); // Support nested keys like "meta.author"

          switch (operation) {
            case "replace":
              this.setNestedValue(frontmatter, keys, content);
              break;
            case "append":
              this.appendNestedValue(frontmatter, keys, content);
              break;
            case "prepend":
              this.prependNestedValue(frontmatter, keys, content);
              break;
            default:
              throw new Error(`Invalid operation: ${operation}`);
          }
        },
      );
      return; // processFrontMatter handles the file write
    } else {
      throw new Error(`Invalid target type: ${target_type}`);
    }

    await this.app.vault.modify(file as any, fileContent);
  }

  private async simpleSearch(
    query: string,
    contextLength: number = 100,
  ): Promise<any[]> {
    const files = this.app.vault.getMarkdownFiles();
    const results: any[] = [];

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase();

      let index = lowerContent.indexOf(lowerQuery);
      while (index !== -1) {
        const start = Math.max(0, index - contextLength);
        const end = Math.min(
          content.length,
          index + query.length + contextLength,
        );
        const context = content.substring(start, end);

        results.push({
          file: file.path,
          match: context,
          position: index,
        });

        index = lowerContent.indexOf(lowerQuery, index + 1);
      }
    }

    return results;
  }

  private async deleteFile(filepath: string, confirm: boolean): Promise<void> {
    if (!confirm) {
      throw new Error("Deletion requires confirmation");
    }

    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (!file) {
      throw new Error(`File not found: ${filepath}`);
    }

    await this.app.vault.delete(file);
  }

  private async dataviewQuery(query: string): Promise<any> {
    const dataview = (this.app as any).plugins?.plugins?.dataview?.api;

    if (!dataview) {
      throw new Error("Dataview plugin is not installed or enabled");
    }

    try {
      const result = await dataview.query(query);
      if (result.successful) {
        return result.value;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      throw new Error(`Dataview query failed: ${error.message}`);
    }
  }

  private async validateDataviewQuery(
    query: string,
    type: string = "DQL",
  ): Promise<any> {
    const dataview = (this.app as any).plugins?.plugins?.dataview?.api;

    if (!dataview) {
      return {
        valid: false,
        syntaxValid: false,
        error: "Dataview plugin is not installed or enabled",
      };
    }

    try {
      if (type === "JS") {
        // For JS queries, we need to evaluate them in a limited context
        const dv = dataview;
        const result = eval(`(function() { return ${query}; })()`);
        return {
          valid: true,
          syntaxValid: true,
          type: "JS",
          result: result,
          resultType: typeof result,
        };
      } else {
        // For DQL queries, use the standard query method
        const result = await dataview.query(query);

        // Check if query has results
        let hasResults = false;
        let resultCount = 0;

        if (result.successful && result.value) {
          // Use the type from the result value itself or from the result
          const queryType = result.value.type || result.type;

          if (queryType === "table" || result.value.headers) {
            // For tables, check the values array
            if (
              result.value &&
              result.value.values &&
              Array.isArray(result.value.values)
            ) {
              hasResults = result.value.values.length > 0;
              resultCount = result.value.values.length;
            } else if (result.value && Array.isArray(result.value)) {
              // Sometimes the value itself is the array for tables
              hasResults = result.value.length > 0;
              resultCount = result.value.length;
            }
          } else if (
            queryType === "list" ||
            (result.value.values && !result.value.headers)
          ) {
            // For lists, check the values array
            if (result.value.values && Array.isArray(result.value.values)) {
              hasResults = result.value.values.length > 0;
              resultCount = result.value.values.length;
            }
          } else if (queryType === "task" || result.value.tasks) {
            // For tasks, check the tasks array
            if (result.value.tasks && Array.isArray(result.value.tasks)) {
              hasResults = result.value.tasks.length > 0;
              resultCount = result.value.tasks.length;
            }
          } else if (Array.isArray(result.value)) {
            // Direct array result
            hasResults = result.value.length > 0;
            resultCount = result.value.length;
          } else {
            // For other types, be conservative - only count as having results if we're sure
            hasResults = false;
            resultCount = 0;
          }
        }

        // Detect potential issues with field names
        let warning = null;
        if (result.successful && !hasResults) {
          // Check for common patterns that suggest invalid field names
          const fieldPattern =
            /\b(INVALID_FIELD|nonexistent_field|undefined)\b/i;
          const wherePattern = /WHERE\s+(\w+)\s*[=!<>]/;

          if (fieldPattern.test(query)) {
            warning = "Query contains potentially invalid field names";
          } else if (wherePattern.test(query)) {
            const match = query.match(wherePattern);
            if (match && match[1]) {
              warning = `Query returned no results. Field '${match[1]}' might not exist or have no matching values`;
            } else {
              warning =
                "Query returned no results. Check field names and filter conditions";
            }
          } else {
            warning = "Query returned no results";
          }
        }

        return {
          valid: result.successful && (!warning || hasResults),
          syntaxValid: result.successful,
          type: "DQL",
          successful: result.successful,
          hasResults: hasResults,
          resultCount: resultCount,
          result: result.successful ? result.value : null,
          resultType: result.type,
          error: result.successful ? null : result.error,
          warning: warning,
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        syntaxValid: false,
        type: type,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  // Helper functions for nested frontmatter value handling
  private tryParseValue(value: string): any {
    // Try to parse the value as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Not JSON, try other types
      if (value === "true") return true;
      if (value === "false") return false;
      if (value === "null") return null;
      if (value === "undefined") return undefined;

      // Try to parse as number
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== "") return num;

      // Return as string
      return value;
    }
  }

  private setNestedValue(obj: any, keys: string[], value: string): void {
    const parsedValue = this.tryParseValue(value);

    if (keys.length === 1) {
      obj[keys[0]] = parsedValue;
    } else {
      const key = keys[0];
      if (!obj[key] || typeof obj[key] !== "object") {
        obj[key] = {};
      }
      this.setNestedValue(obj[key], keys.slice(1), value);
    }
  }

  private appendNestedValue(obj: any, keys: string[], value: string): void {
    const parsedValue = this.tryParseValue(value);

    if (keys.length === 1) {
      const key = keys[0];
      const existing = obj[key];

      if (Array.isArray(existing)) {
        // If it's an array, add the new value
        existing.push(parsedValue);
      } else if (typeof existing === "string") {
        // If it's a string, concatenate
        obj[key] = existing + parsedValue;
      } else {
        // Otherwise, create an array with both values
        obj[key] =
          existing !== undefined ? [existing, parsedValue] : parsedValue;
      }
    } else {
      const key = keys[0];
      if (!obj[key] || typeof obj[key] !== "object") {
        obj[key] = {};
      }
      this.appendNestedValue(obj[key], keys.slice(1), value);
    }
  }

  private prependNestedValue(obj: any, keys: string[], value: string): void {
    const parsedValue = this.tryParseValue(value);

    if (keys.length === 1) {
      const key = keys[0];
      const existing = obj[key];

      if (Array.isArray(existing)) {
        // If it's an array, add the new value at the beginning
        existing.unshift(parsedValue);
      } else if (typeof existing === "string") {
        // If it's a string, prepend
        obj[key] = parsedValue + existing;
      } else {
        // Otherwise, create an array with both values
        obj[key] =
          existing !== undefined ? [parsedValue, existing] : parsedValue;
      }
    } else {
      const key = keys[0];
      if (!obj[key] || typeof obj[key] !== "object") {
        obj[key] = {};
      }
      this.prependNestedValue(obj[key], keys.slice(1), value);
    }
  }

  private async getRenderedContent(filepath: string): Promise<any> {
    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (!file || file.hasOwnProperty("children")) {
      throw new Error(`File not found: ${filepath}`);
    }

    const content = await this.app.vault.read(file as any);
    const dataview = (this.app as any).plugins?.plugins?.dataview?.api;

    // Track query statuses and results
    const queryStatuses: any = {};
    let renderedMarkdown = content;
    let hasErrors = false;

    if (dataview) {
      // Process DQL code blocks
      const dqlRegex = /```dataview\n([\s\S]*?)```/g;
      const dqlMatches: Array<{ match: string; query: string; index: number }> =
        [];

      let match;
      while ((match = dqlRegex.exec(content)) !== null) {
        dqlMatches.push({
          match: match[0],
          query: match[1].trim(),
          index: match.index,
        });
      }

      // Replace queries with their markdown results (in reverse order to preserve indices)
      for (let i = dqlMatches.length - 1; i >= 0; i--) {
        const { match: fullMatch, query } = dqlMatches[i];
        try {
          // Use queryMarkdown to get formatted markdown results
          const result = await dataview.queryMarkdown(query);

          if (result.successful) {
            // Replace the dataview code block with the rendered markdown
            const replacement = result.value || "*(No results)*";
            renderedMarkdown = renderedMarkdown.replace(fullMatch, replacement);

            // Count results
            let resultCount = 0;
            if (result.value) {
              const lines = result.value
                .split("\n")
                .filter((line: string) => line.trim());
              resultCount = lines.length;
            }

            queryStatuses[query] = {
              success: true,
              resultCount: resultCount,
              type: "DQL",
            };
          } else {
            // Keep the code block but add error message
            const errorMsg = `\n> ⚠️ **Query Error**: ${result.error}\n`;
            renderedMarkdown = renderedMarkdown.replace(
              fullMatch,
              fullMatch + errorMsg,
            );
            queryStatuses[query] = {
              success: false,
              error: result.error,
              type: "DQL",
            };
            hasErrors = true;
          }
        } catch (error: any) {
          // Keep the code block but add error message
          const errorMsg = `\n> ⚠️ **Query Error**: ${error.message}\n`;
          renderedMarkdown = renderedMarkdown.replace(
            fullMatch,
            fullMatch + errorMsg,
          );
          queryStatuses[query] = {
            success: false,
            error: error.message,
            type: "DQL",
          };
          hasErrors = true;
        }
      }

      // Process inline queries
      const inlineDqlRegex = /`\$=\s*(.*?)`/g;
      const inlineMatches: Array<{ match: string; query: string }> = [];

      while ((match = inlineDqlRegex.exec(content)) !== null) {
        inlineMatches.push({
          match: match[0],
          query: match[1].trim(),
        });
      }

      for (const { match: fullMatch, query } of inlineMatches) {
        try {
          // Inline queries are JavaScript expressions
          const dv = dataview;
          const result = eval(`(function() { return ${query}; })()`);

          // Replace inline query with its result
          renderedMarkdown = renderedMarkdown.replace(
            fullMatch,
            String(result),
          );
          queryStatuses[`inline: ${query}`] = {
            success: true,
            value: result,
            type: "inline",
          };
        } catch (error: any) {
          // Keep the inline query but add error indicator
          renderedMarkdown = renderedMarkdown.replace(
            fullMatch,
            `${fullMatch} ⚠️`,
          );
          queryStatuses[`inline: ${query}`] = {
            success: false,
            error: error.message,
            type: "inline",
          };
          hasErrors = true;
        }
      }
    }

    return {
      filepath: filepath,
      rawContent: content,
      renderedMarkdown: renderedMarkdown,
      queryStatuses: queryStatuses,
      hasErrors: hasErrors,
      hasDataview: Object.keys(queryStatuses).length > 0,
    };
  }
}

class HTTPMCPSettingTab extends PluginSettingTab {
  plugin: HTTPMCPPlugin;

  constructor(app: App, plugin: HTTPMCPPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "HTTP MCP Server Settings" });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Secret key for authenticating requests")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Port")
      .setDesc("Port number for the HTTP server (default: 27125)")
      .addText((text) =>
        text
          .setPlaceholder("27125")
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Enable External Access")
      .setDesc("Allow connections from external IPs (use with caution)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableExternalAccess)
          .onChange(async (value) => {
            this.plugin.settings.enableExternalAccess = value;
            await this.plugin.saveSettings();
            if (this.plugin.server) {
              new Notice("Restart the server for this change to take effect");
            }
          }),
      );

    new Setting(containerEl)
      .setName("Enable Dataview Queries")
      .setDesc("Allow executing Dataview queries through the API")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDataviewQueries)
          .onChange(async (value) => {
            this.plugin.settings.enableDataviewQueries = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Rate Limit")
      .setDesc("Maximum requests per minute per IP")
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.rateLimitPerMinute))
          .onChange(async (value) => {
            const limit = parseInt(value);
            if (!isNaN(limit) && limit > 0) {
              this.plugin.settings.rateLimitPerMinute = limit;
              await this.plugin.saveSettings();
            }
          }),
      );

    containerEl.createEl("h3", { text: "Server Status" });

    const statusDiv = containerEl.createDiv();
    const updateStatus = () => {
      statusDiv.empty();
      if (this.plugin.server) {
        statusDiv.createEl("p", { text: "🟢 Server is running" });
      } else {
        statusDiv.createEl("p", { text: "🔴 Server is stopped" });
      }
    };
    updateStatus();

    new Setting(containerEl)
      .addButton((button) =>
        button.setButtonText("Start Server").onClick(async () => {
          await this.plugin.startServer();
          updateStatus();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Stop Server").onClick(() => {
          this.plugin.stopServer();
          updateStatus();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Restart Server").onClick(async () => {
          this.plugin.stopServer();
          await this.plugin.startServer();
          updateStatus();
        }),
      );
  }
}
