import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer, createWebSocketStream, type RawData } from "ws";
import { ReplayGuard, authorizeRequest } from "./auth.js";
import { type BridgeConfig, loadConfig } from "./config.js";
import { tryParseJson, readBody, sendJson } from "./http.js";
import { filterProxyHeaders, joinProxyPath } from "./proxy.js";
import { BridgeRuntime, HttpError } from "./runtime.js";
import type { AttachRequest, HeartbeatRequest, ReleaseRequest } from "./types.js";

function getOrigin(req: IncomingMessage, configuredOrigin: string | undefined): string {
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const host = req.headers.host ?? "127.0.0.1";
  return `http://${host}`;
}

function isProxyRequest(method: string, pathName: string): RegExpMatchArray | null {
  if (method !== "GET" && method !== "POST") {
    return null;
  }
  return pathName.match(/^\/cdp\/([^/]+)(?:\/(ws|.*))?$/);
}

function proxyHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: string,
  rawBody: string,
  rewriteVersionWsUrl?: string,
): void {
  const url = new URL(targetUrl);
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = transport(url, {
    method: req.method,
    headers: filterProxyHeaders(req.headers),
  }, (upstreamRes) => {
    const contentType = Array.isArray(upstreamRes.headers["content-type"])
      ? upstreamRes.headers["content-type"][0]
      : upstreamRes.headers["content-type"];
    if (rewriteVersionWsUrl && contentType?.includes("application/json")) {
      const chunks: Buffer[] = [];
      upstreamRes.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      upstreamRes.on("end", () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
          if (typeof payload.webSocketDebuggerUrl === "string") {
            payload.webSocketDebuggerUrl = rewriteVersionWsUrl;
          }
          const body = JSON.stringify(payload);
          res.writeHead(upstreamRes.statusCode ?? 502, {
            ...upstreamRes.headers,
            "content-length": Buffer.byteLength(body),
          });
          res.end(body);
        } catch {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
          res.end(Buffer.concat(chunks));
        }
      });
      return;
    }

    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on("error", (error) => {
    sendJson(res, 502, { success: false, error: `CDP proxy failed: ${error.message}` });
  });

  if (rawBody.length > 0) {
    upstream.write(rawBody);
  }
  upstream.end();
}

export function createBridgeServer(
  runtime = new BridgeRuntime(loadConfig()),
  config: BridgeConfig = loadConfig(),
) {
  const replayGuard = new ReplayGuard(config.auth.replayWindowMs);
  const wsServer = new WebSocketServer({ noServer: true });

  const server = createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, { success: false, error: "Invalid request" });
      return;
    }

    const url = new URL(req.url, getOrigin(req, config.publicOrigin));
    const rawBody = await readBody(req);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, await runtime.health());
        return;
      }

      if (!authorizeRequest(req, rawBody, `${url.pathname}${url.search}`, config, replayGuard)) {
        sendJson(res, 401, { success: false, error: "Unauthorized" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/session/attach") {
        const body = tryParseJson<AttachRequest>(rawBody);
        sendJson(res, 200, await runtime.attach(body ?? {}, getOrigin(req, config.publicOrigin)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/session/release") {
        const body = tryParseJson<ReleaseRequest>(rawBody);
        const lease = await runtime.release(body ?? {});
        sendJson(res, 200, {
          released: true,
          leaseId: lease.leaseId,
          releasedAt: lease.releasedAt,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/session/heartbeat") {
        const body = tryParseJson<HeartbeatRequest>(rawBody);
        const lease = await runtime.heartbeat(body?.leaseId, body?.jobId);
        sendJson(res, 200, {
          success: true,
          leaseId: lease.leaseId,
          expiresAt: lease.expiresAt,
        });
        return;
      }

      const statusMatch = req.method === "GET"
        ? url.pathname.match(/^\/session\/([^/]+)\/status$/)
        : null;
      if (statusMatch?.[1]) {
        const lease = runtime.getStatus(statusMatch[1]);
        sendJson(res, 200, {
          ...lease,
          cdpUrl: `${getOrigin(req, config.publicOrigin)}/cdp/${lease.leaseId}`,
          wsEndpoint: lease.sessionTarget.wsUrl
            ? `${getOrigin(req, config.publicOrigin).replace(/^http/i, "ws")}/cdp/${lease.leaseId}/ws`
            : undefined,
          capabilities: lease.grantedCapabilities,
        });
        return;
      }

      const proxyMatch = isProxyRequest(req.method, url.pathname);
      if (proxyMatch?.[1]) {
        const leaseId = proxyMatch[1];
        const suffix = proxyMatch[2] && proxyMatch[2] !== "ws" ? `/${proxyMatch[2]}` : "";
        const target = runtime.buildProxyTarget(leaseId);
        const rewriteVersionWsUrl = suffix === "/json/version"
          ? `${getOrigin(req, config.publicOrigin).replace(/^http/i, "ws")}/cdp/${leaseId}/ws${url.search}`
          : undefined;
        proxyHttpRequest(
          req,
          res,
          joinProxyPath(target.httpUrl, suffix, url.search),
          rawBody,
          rewriteVersionWsUrl,
        );
        return;
      }

      sendJson(res, 404, { success: false, error: "Not found" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
        return;
      }
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, { success: false, error: error.message, ...error.details });
        return;
      }
      sendJson(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url) {
      socket.destroy();
      return;
    }

    const url = new URL(req.url, config.publicOrigin ?? `http://${req.headers.host ?? "127.0.0.1"}`);
    const match = url.pathname.match(/^\/cdp\/([^/]+)\/ws$/);
    if (!match?.[1]) {
      socket.destroy();
      return;
    }

    try {
      if (!authorizeRequest(req, "", `${url.pathname}${url.search}`, config, replayGuard)) {
        socket.destroy();
        return;
      }

      const target = runtime.buildProxyTarget(match[1]);
      if (!target.wsUrl) {
        socket.destroy();
        return;
      }

      wsServer.handleUpgrade(req, socket, head, (clientSocket) => {
        const upstreamSocket = new WebSocket(target.wsUrl!, {
          headers: filterProxyHeaders(req.headers),
        });

        const clientStream = createWebSocketStream(clientSocket);
        const upstreamStream = createWebSocketStream(upstreamSocket);

        clientStream.pipe(upstreamStream).pipe(clientStream);

        const closeBoth = () => {
          clientSocket.close();
          upstreamSocket.close();
        };

        clientSocket.on("close", closeBoth);
        upstreamSocket.on("close", closeBoth);
        upstreamSocket.on("message", (_data: RawData) => undefined);
      });
    } catch {
      socket.destroy();
    }
  });

  const cleanupTimer = setInterval(() => {
    runtime.cleanupExpiredLeases().catch(() => undefined);
  }, config.cleanupIntervalMs);
  cleanupTimer.unref();

  return {
    server,
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => resolve());
      });
    },
    async stop() {
      clearInterval(cleanupTimer);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    getAddress(): AddressInfo | string | null {
      return server.address();
    },
  };
}

export async function startServer(): Promise<void> {
  const bridge = createBridgeServer();
  await bridge.start();

  const address = bridge.getAddress();
  const printable = typeof address === "string"
    ? address
    : address
      ? `http://${address.address}:${address.port}`
      : "unknown";
  console.log(`Multilogin bridge listening on ${printable}`);

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
