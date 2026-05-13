// Standalone seed entrypoint for local CLI use: `npm run db:seed`
// (Hostinger / production uses src/instrumentation.ts to run the same logic
// via src/lib/seed.ts on every boot.)

import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed";

const prisma = new PrismaClient();

runSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
