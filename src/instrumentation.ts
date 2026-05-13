// Next.js 15 instrumentation hook — runs once when the Node server boots.
// IMPORTANT: register() must return quickly. Anything we do here runs BEFORE
// Next opens its HTTP listener, so if we block (spawnSync, slow Prisma query,
// network stall) the reverse proxy will return 503 to all traffic.
//
// Strategy: schedule migrate + seed as a background task and return immediately.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL not set — skipping migrate + seed");
    return;
  }

  setTimeout(() => {
    void runSetup().catch((e) => console.error("[instrumentation] setup failed:", e));
  }, 0);
}

async function runSetup() {
  // Hide Node built-in requires from webpack's static analysis.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req: NodeRequire = (eval("require") as any);
  const { spawn } = req("child_process") as typeof import("child_process");
  const path = req("path") as typeof import("path");
  const fs = req("fs") as typeof import("fs");

  const cwd = process.cwd();
  const prismaBin = path.join(cwd, "node_modules", "prisma", "build", "index.js");

  if (fs.existsSync(prismaBin)) {
    console.log("[instrumentation] prisma migrate deploy…");
    await new Promise<void>((resolve) => {
      const child = spawn(process.execPath, [prismaBin, "migrate", "deploy"], {
        stdio: "inherit",
        cwd,
        env: process.env,
      });
      child.on("close", (code) => {
        if (code !== 0) console.error(`[instrumentation] migrate deploy exit ${code}`);
        else console.log("[instrumentation] prisma migrate deploy OK");
        resolve();
      });
      child.on("error", (err) => {
        console.error("[instrumentation] migrate spawn error:", err);
        resolve();
      });
    });
  } else {
    console.warn("[instrumentation] prisma CLI not found at", prismaBin);
  }

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
