import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware: only the auth.config (no Prisma).
// Auth.js's `authorized` callback handles the redirect when not logged in.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
