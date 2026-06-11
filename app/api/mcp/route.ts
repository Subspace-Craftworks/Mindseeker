import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

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

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers });
}

function result(id: JsonRpcRequest["id"], value: unknown): NextResponse {
  return json({ jsonrpc: "2.0", id: id ?? null, result: value });
}

function error(id: JsonRpcRequest["id"], code: number, message: string): NextResponse {
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  // 1. Authenticate Request
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.OAUTH_JWT_SECRET;
  if (!secret) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  let userId: string;
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
        serverInfo: { name: "mindseeker-mcp-vercel", version: "0.1.0" },
        capabilities: { tools: {} },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202, headers });

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
        server: "mindseeker-mcp-vercel",
        user_id: userId,
        message: typeof args.message === "string" ? args.message : "pong",
        timestamp: new Date().toISOString(),
      }));
    }

    default:
      return error(body.id, -32601, `Method not found: ${body.method}`);
  }
}
