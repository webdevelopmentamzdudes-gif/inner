// Custom Node entry for Hostinger Node.js Web App.
// Hostinger's LSWS reverse-proxies to a Unix socket whose path it puts in
// HOSTNAME (e.g. /usr/local/lsws/extapp-sock/lmp.amzdudes.io:_.sock). If we
// only listen on a TCP port the proxy can never reach us and we get 504.
// This file detects the socket path and listens on it; otherwise falls back
// to TCP $PORT for any plain-Node host.

const { createServer } = require("http");
const { parse } = require("url");
const fs = require("fs");
const next = require("next");

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const hostname = process.env.HOSTNAME || process.env.HOST || "0.0.0.0";
const isSocket = hostname.startsWith("/") || hostname.includes(".sock");

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    server.on("error", (err) => {
      console.error("[server] HTTP server error:", err);
    });

    if (isSocket) {
      try {
        fs.unlinkSync(hostname);
      } catch {
        // ignore if it doesn't exist
      }
      server.listen(hostname, () => {
        try {
          fs.chmodSync(hostname, 0o666);
        } catch (e) {
          console.warn("[server] could not chmod socket:", e && e.message);
        }
        console.log(`[server] Listening on unix socket ${hostname}`);
      });
    } else {
      server.listen(port, hostname, () => {
        console.log(`[server] Listening on http://${hostname}:${port}`);
      });
    }
  })
  .catch((err) => {
    console.error("[server] Failed to start Next.js:", err);
    process.exit(1);
  });
