import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { kimiReply, validateRequest } from "./kimi.mjs";
import { VisionError, resolveVisionImages } from "./vision.mjs";
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
} catch {
  /* Local cloud configuration is optional. */
}
const allowedHosts = new Set([
  "localhost",
  "127.0.0.1",
  "192.168.0.30",
  "100.106.60.125",
]);
const requests = new Map();
let active = 0;
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    let permitted = false;
    try {
      const url = new URL(origin);
      permitted =
        url.protocol === "http:" &&
        url.port === "8081" &&
        allowedHosts.has(url.hostname);
    } catch {
      /* Invalid origins are rejected. */
    }
    if (!permitted) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, value) => {
    if (!res.destroyed) res.writeHead(status).end(JSON.stringify(value));
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    send(200, { ready: !!process.env.MOONSHOT_API_KEY });
    return;
  }
  if (req.method !== "POST" || req.url !== "/reply") {
    send(404, { error: "Not found." });
    return;
  }
  const address = req.socket.remoteAddress;
  const now = Date.now();
  for (const [ip, state] of requests)
    if (state.expires <= now) requests.delete(ip);
  const state = requests.get(address) ?? { count: 0, expires: now + 60000 };
  requests.set(address, state);
  if (++state.count > 15 || active >= 4) {
    send(429, { error: "AI is busy. Try again shortly." });
    return;
  }
  let raw = "";
  try {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (Buffer.byteLength(raw) > 96000) {
        send(413, { error: "Conversation is too long." });
        return;
      }
    }
    let body;
    try {
      body = validateRequest(JSON.parse(raw));
    } catch (error) {
      send(400, {
        error:
          error instanceof VisionError
            ? error.message
            : "Invalid conversation.",
      });
      return;
    }
    active++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const disconnect = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", disconnect);
    try {
      let userId;
      const authorization = req.headers.authorization;
      if (
        body.history.some(
          (entry) => entry.image?.attachmentId === "device-photo",
        )
      ) {
        const auth = await fetch(
          process.env.EXPO_PUBLIC_SUPABASE_URL + "/auth/v1/user",
          {
            headers: {
              apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
              Authorization: authorization ?? "",
            },
            signal: controller.signal,
          },
        );
        if (!auth.ok) {
          send(401, { error: "Sign in to analyze a shared photo." });
          return;
        }
        userId = (await auth.json()).id;
      }
      const images = await resolveVisionImages(body, {
        base: process.env.EXPO_PUBLIC_SUPABASE_URL,
        key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        authorization,
        userId,
        signal: controller.signal,
      });
      send(200, {
        text: await kimiReply(body, { signal: controller.signal, images }),
      });
    } catch (e) {
      send(e.status ?? 502, {
        error: controller.signal.aborted
          ? "AI took too long. Please retry."
          : e.message,
      });
    } finally {
      active--;
      clearTimeout(timeout);
      res.off("close", disconnect);
    }
  } catch {
    send(400, { error: "Could not read the request." });
  }
});
server.requestTimeout = 15000;
server.listen(
  Number(process.env.AI_PORT ?? 8082),
  process.env.AI_HOST ?? "0.0.0.0",
  () =>
    console.log(
      "Shiftline AI server listening on port " + (process.env.AI_PORT ?? 8082),
    ),
);
