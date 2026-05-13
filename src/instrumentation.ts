// Next.js 15 instrumentation hook — runs once when the Node server boots
// (regardless of how it was started: `next start`, `npm start`, a custom
// server file, or a managed host like Hostinger that uses `next start`
// directly). We use it to apply Prisma migrations and (if needed) seed
// the database, so deploys to environments whose BUILD container can't
// reach MySQL still bootstrap correctly on first run.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL not set — skipping migrate + seed");
    return;
  }

  const { spawnSync } = await import("node:child_process");
  const path = await import("node:path");
  const fs = await import("node:fs");

  const cwd = process.cwd();

  const run = (label: string, args: string[]) => {
    console.log(`[instrumentation] ${label}…`);
    const result = spawnSync(process.execPath, args, {
      stdio: "inherit",
      cwd,
      env: process.env,
    });
    if (result.error) {
      console.error(`[instrumentation] ${label} spawn error:`, result.error.message);
    } else if (result.status !== 0) {
      console.error(`[instrumentation] ${label} exit ${result.status}`);
    } else {
      console.log(`[instrumentation] ${label} OK`);
    }
  };

  const prismaBin = path.join(cwd, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaBin)) {
    run("prisma migrate deploy", [prismaBin, "migrate", "deploy"]);
  } else {
    console.warn("[instrumentation] prisma CLI not found at", prismaBin);
  }

  const tsxBin = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  if (fs.existsSync(tsxBin)) {
    run("seed", [tsxBin, "prisma/seed.ts"]);
  } else {
    console.warn("[instrumentation] tsx CLI not found — skipping seed");
  }
}
