import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma, no Node-only deps).
// Used in middleware via NextAuth(authConfig). Full config in src/auth.ts
// extends this with the Credentials provider (which needs Prisma + bcrypt).

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      if (pathname === "/" || pathname.startsWith("/login")) return true;
      if (pathname.startsWith("/api/auth")) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        // user fields are added by the credentials authorize() in auth.ts
        const u = user as { id?: string; role?: string };
        if (u.id) token.userId = u.id;
        if (u.role) token.role = u.role as never;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        const t = token as { userId?: string; role?: string };
        if (t.userId) session.user.id = t.userId;
        if (t.role) session.user.role = t.role as never;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
