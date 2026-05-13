#!/usr/bin/env node
// Production startup wrapper used by Hostinger / managed Node hosts.
// 1. Runs `prisma migrate deploy` so missing tables are created at runtime
//    (build environment may not reach the DB).
// 2. Runs the idempotent seed script (no-ops once users exist).
// 3. Hands off to `next start`.
//
// Each step is wrapped so that a failure logs but does NOT prevent the
// Next.js server from booting — we'd rather serve a clear error page than
// 503 on startup.

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");

function run(label, args) {
  console.log(`[start] ${label}…`);
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  if (result.error) {
    console.error(`[start] ${label} could not spawn:`, result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.error(`[start] ${label} failed (exit ${result.status}). Continuing.`);
    return false;
  }
  console.log(`[start] ${label} OK`);
  return true;
}

function runSetup() {
  if (!process.env.DATABASE_URL) {
    console.warn("[start] DATABASE_URL not set — skipping migrate + seed");
    return;
  }

  const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaBin)) {
    run("prisma migrate deploy", [prismaBin, "migrate", "deploy"]);
  } else {
    console.warn("[start] prisma CLI not found");
  }

  const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (fs.existsSync(tsxBin)) {
    run("seed", [tsxBin, "prisma/seed.ts"]);
  } else {
    console.warn("[start] tsx CLI not found — skipping seed");
  }
}

runSetup();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) {
  console.error("[start] next CLI not found at", nextBin);
  process.exit(1);
}

const next = spawnSync(process.execPath, [nextBin, "start"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
process.exit(next.status ?? 1);
