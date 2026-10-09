import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { AccountState } from "@prisma/client";
import { WebSocketServer } from "ws";
import type { PrismaService } from "../prisma/prisma.service";
import type { TokenService } from "../auth/token.service";
import type { RealtimeHub } from "./realtime.hub";

export function attachRealtime(
  server: Server,
  tokens: TokenService,
  prisma: PrismaService,
  hub: RealtimeHub,
): void {
  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const path = (request.url ?? "").split("?")[0];
    if (path !== "/v1/realtime") {
      socket.destroy();
      return;
    }
    void authorize(tokens, prisma, request.headers.authorization).then(
      (userId) => {
        if (!userId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        sockets.handleUpgrade(request, socket, head, (client) => {
          hub.attach(userId, client);
          client.on("message", (raw) => {
            let event = "";
            try {
              const parsed = JSON.parse(raw.toString()) as { event?: unknown };
              event = typeof parsed.event === "string" ? parsed.event : "";
            } catch {
              return;
            }
            if (event !== "system.heartbeat.v1" || client.readyState !== 1) {
              return;
            }
            client.send(
              JSON.stringify({
                event: "system.heartbeat.v1",
                eventId: randomUUID(),
                occurredAt: new Date().toISOString(),
                payload: { serverTime: new Date().toISOString() },
              }),
            );
          });
          client.send(
            JSON.stringify({
              event: "system.ready.v1",
              eventId: randomUUID(),
              occurredAt: new Date().toISOString(),
              payload: {
                protocolVersion: 1,
                serverTime: new Date().toISOString(),
                heartbeatIntervalMs: 25000,
                resumeSupported: false,
              },
            }),
          );
        });
      },
      () => {
        socket.destroy();
      },
    );
  });
}

async function authorize(
  tokens: TokenService,
  prisma: PrismaService,
  header: string | undefined,
): Promise<string | null> {
  const [scheme, token] = (header ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  let claims;
  try {
    claims = await tokens.verifyAccessToken(token);
  } catch {
    return null;
  }
  const session = await prisma.client.session.findUnique({
    where: { id: claims.sid },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.userId !== claims.sub
  ) {
    return null;
  }
  const user = await prisma.client.user.findUnique({
    where: { id: claims.sub },
    select: { accountState: true },
  });
  if (!user || user.accountState !== AccountState.ACTIVE) {
    return null;
  }
  return claims.sub;
}
