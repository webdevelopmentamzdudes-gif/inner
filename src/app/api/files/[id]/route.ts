import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewIcp } from "@/lib/scope";
import { readResourceFile } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: { icp: true },
  });
  if (!resource || !resource.filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Scope: must be able to view the parent ICP.
  if (!(await canViewIcp(session.user.role, session.user.id, resource.icp))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buf = await readResourceFile(resource.filePath);
  const blob = new Blob([new Uint8Array(buf)], {
    type: resource.fileMime ?? "application/octet-stream",
  });

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": resource.fileMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${resource.fileName ?? "file"}"`,
      "Content-Length": String(resource.fileSize ?? buf.byteLength),
      "Cache-Control": "private, max-age=300",
    },
  });
}
