// Health check + temporary DB diagnostic. Remove the DB lookup once login
// is confirmed working.

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const admin = (await prisma.user.findUnique({
      where: { email: "admin@example.com" },
    })) as {
      email: string;
      role: string;
      status: string;
      hashedPassword: string | null;
    } | null;
    return Response.json(
      {
        ok: true,
        db: "connected",
        users: userCount,
        admin: admin
          ? {
              email: admin.email,
              role: admin.role,
              status: admin.status,
              hashLength: admin.hashedPassword?.length ?? 0,
              hashStart: admin.hashedPassword?.slice(0, 7) ?? "",
            }
          : null,
      },
      { status: 200 },
    );
  } catch (e) {
    const err = e as Error;
    return Response.json(
      {
        ok: false,
        db: "error",
        errorName: err.name,
        errorMessage: err.message,
      },
      { status: 200 },
    );
  }
}
