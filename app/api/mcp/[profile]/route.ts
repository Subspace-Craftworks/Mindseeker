import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { executeTool } from "@/lib/mcp/handlers";
import { MCP_PROFILES } from "@/lib/mcp/profiles";
import { recordAppLog } from "@/lib/db/app-logs";

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
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey, x-api-key",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers });
}

function result(id: JsonRpcRequest["id"], value: unknown): NextResponse {
  return json({ jsonrpc: "2.0", id: id ?? null, result: value });
}

function error(id: JsonRpcRequest["id"], code: number, message: string): NextResponse {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ profile: string }> }) {
  // 1. Authenticate Request — supports both API Key (Dify) and OAuth JWT (ChatGPT)
  let userId: string;

  const apiKey = req.headers.get("x-api-key");
  const mcpApiKey = process.env.MCP_API_KEY;

  if (apiKey && mcpApiKey && apiKey === mcpApiKey) {
    // API Key auth (Dify): user_id will be resolved from session_id in executeTool
    userId = "__api_key__";
  } else {
    // OAuth JWT auth (ChatGPT, etc.)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.OAUTH_JWT_SECRET;
    if (!secret) {
      return json({ error: "Server misconfiguration" }, 500);
    }

    try {
      const secretBytes = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, secretBytes);
      if (payload.type !== "access" || !payload.user_id) {
        throw new Error("Invalid token payload");
      }
      userId = payload.user_id as string;
    } catch (e) {
      return json({ error: "Invalid or expired token" }, 401);
    }
  }

  // 1.5 Parse Profile
  const { profile } = await params;
  const allowedToolsConfig = MCP_PROFILES[profile] || [];
  
  const isAllowed = (toolName: string) => {
    if (toolName === "mindseeker_ping") return true;
    if (allowedToolsConfig === "*") return true;
    return allowedToolsConfig.includes(toolName);
  };

  const activeTools = MCP_TOOLS.filter(t => isAllowed(t.name));

  // 2. Parse JSON-RPC
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return error(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return error(body.id, -32600, "Invalid JSON-RPC request");
  }

  // 3. Handle MCP Methods
  switch (body.method) {
    case "initialize":
      return result(body.id, {
        protocolVersion: "2025-03-26",
        serverInfo: { name: `mindseeker-mcp-vercel (${profile})`, version: "0.1.0" },
        capabilities: { tools: {} },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202, headers });

    case "tools/list":
      return result(body.id, {
        tools: [
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
          ...activeTools
        ]
      });

    case "tools/call": {
      const callParams = body.params ?? {};
      const name = typeof callParams.name === "string" ? callParams.name : "";
      const args = callParams.arguments && typeof callParams.arguments === "object" && !Array.isArray(callParams.arguments)
        ? callParams.arguments as JsonObject
        : {};

      if (!isAllowed(name)) {
        return error(body.id, -32601, `Method not allowed in profile '${profile}': ${name}`);
      }

      if (name === "mindseeker_ping") {
        return result(body.id, textContent({
          ok: true,
          server: `mindseeker-mcp-vercel (${profile})`,
          user_id: userId,
          message: typeof args.message === "string" ? args.message : "pong",
          timestamp: new Date().toISOString(),
        }));
      }

      // Log tool call arguments for debugging
      void recordAppLog({
        level: "info",
        source: "mcp",
        component: "app/api/mcp/[profile]/route",
        operation: "tools/call",
        route: `/api/mcp/${profile}`,
        message: `Tool called: ${name}`,
        details: { tool: name, arguments: args, has_session_id: !!args.session_id },
        userId,
      });

      // Handle send_payload specially (batch operations)
      if (name === "send_payload") {
        try {
          const { sendPayload } = await import("@/lib/mcp/handlers");
          const payload = await sendPayload(args, userId);
          return result(body.id, textContent(payload));
        } catch (err: any) {
          return error(body.id, -32603, err.message || "Internal Tool Error");
        }
      }

      try {
        const payload = await executeTool(name, args, userId);
        return result(body.id, textContent(payload));
      } catch (err: any) {
        return error(body.id, -32603, err.message || "Internal Tool Error");
      }
    }

    default:
      return error(body.id, -32601, `Method not found: ${body.method}`);
  }
}
