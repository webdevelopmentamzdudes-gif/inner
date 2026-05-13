// Custom Node entrypoint for hosts that boot a single JS file (e.g. Hostinger
// Node.js Web App via Phusion Passenger). Runs prisma migrate + seed BEFORE
// starting Next.js, so deploy environments that can't reach the DB at build
// time still get the schema/data set up on first boot.

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

function runStartupTask(label, args) {
  console.log(`[startup] ${label}…`);
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: __dirname,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`[startup] ${label} failed (exit ${result.status}). App will still start.`);
  } else {
    console.log(`[startup] ${label} OK`);
  }
}

function runStartupSetup() {
  if (!process.env.DATABASE_URL) {
    console.warn("[startup] DATABASE_URL not set — skipping migrate + seed");
    return;
  }

  const prismaBin = path.join(__dirname, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaBin)) {
    runStartupTask("prisma migrate deploy", [prismaBin, "migrate", "deploy"]);
  } else {
    console.warn("[startup] prisma CLI not found at", prismaBin);
  }

  const tsxBin = path.join(__dirname, "node_modules", "tsx", "dist", "cli.mjs");
  if (fs.existsSync(tsxBin)) {
    runStartupTask("seed", [tsxBin, "prisma/seed.ts"]);
  } else {
    console.warn("[startup] tsx CLI not found at", tsxBin);
  }
}

runStartupSetup();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js:", err);
    process.exit(1);
  });
