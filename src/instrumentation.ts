// Next.js 15 instrumentation hook — runs once when the Node server boots.
// Used by managed hosts (e.g. Hostinger Node.js Web App) whose BUILD container
// can't reach MySQL: we defer schema migration + seed to first runtime boot.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL not set — skipping migrate + seed");
    return;
  }

  // Hide Node built-in requires from webpack's static analysis.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req: NodeRequire = (eval("require") as any);
  const { spawnSync } = req("child_process") as typeof import("child_process");
  const path = req("path") as typeof import("path");
  const fs = req("fs") as typeof import("fs");

  const cwd = process.cwd();

  // 1. Run prisma migrate deploy via the prisma CLI bundled in node_modules.
  const prismaBin = path.join(cwd, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(prismaBin)) {
    console.log("[instrumentation] prisma migrate deploy…");
    const r = spawnSync(process.execPath, [prismaBin, "migrate", "deploy"], {
      stdio: "inherit",
      cwd,
      env: process.env,
    });
    if (r.status !== 0) {
      console.error(`[instrumentation] prisma migrate deploy failed (exit ${r.status})`);
    } else {
      console.log("[instrumentation] prisma migrate deploy OK");
    }
  } else {
    console.warn("[instrumentation] prisma CLI not found at", prismaBin);
  }

  // 2. Seed the DB inline (no external tsx, no missing-file risk).
  try {
    console.log("[instrumentation] seed…");
    const { PrismaClient } = await import("@prisma/client");
    const { runSeed } = await import("@/lib/seed");
    const prisma = new PrismaClient();
    try {
      await runSeed(prisma);
      console.log("[instrumentation] seed OK");
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    console.error("[instrumentation] seed failed:", e);
  }
}
