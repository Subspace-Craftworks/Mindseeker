import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type JsonObject = Record<string, unknown>;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: JsonObject;
};

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function result(id: JsonRpcRequest["id"], value: unknown): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, result: value });
}

function error(id: JsonRpcRequest["id"], code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

const tools = [
  {
    name: "mindseeker_ping",
    description: "Check whether the Mindseeker MCP server is reachable.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Optional message to echo" },
      },
    },
  },
];

function textContent(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return error(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return error(body.id, -32600, "Invalid JSON-RPC request");
  }

  switch (body.method) {
    case "initialize":
      return result(body.id, {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "mindseeker-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      });

    case "notifications/initialized":
      return json(null, 202);

    case "tools/list":
      return result(body.id, { tools });

    case "tools/call": {
      const params = body.params ?? {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? params.arguments as JsonObject
        : {};

      if (name !== "mindseeker_ping") {
        return error(body.id, -32602, `Unknown tool: ${name}`);
      }

      return result(body.id, textContent({
        ok: true,
        server: "mindseeker-mcp",
        message: typeof args.message === "string" ? args.message : "pong",
        timestamp: new Date().toISOString(),
      }));
    }

    default:
      return error(body.id, -32601, `Method not found: ${body.method}`);
  }
});
