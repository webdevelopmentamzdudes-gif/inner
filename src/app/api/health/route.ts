// Lightweight health check endpoint for any load balancer or uptime monitor.
// Returns 200 OK immediately with no DB or auth dependency.

export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { status: 200 });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
