// Root page returns a real 200 response (no server-side redirect) so that
// platform health probes which only accept 2xx don't mark the container as
// unhealthy. The redirect to /login happens via a meta refresh after the
// HTML is delivered with status 200.

export const dynamic = "force-dynamic";

export const metadata = {
  // Meta refresh redirect kicks in immediately on real browsers, but the
  // response itself is a 200 OK for any synthetic health probe.
  other: {
    refresh: "0; url=/login",
  },
};

export default function RootPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Lead Management Platform</h1>
      <p>
        Redirecting to <a href="/login">/login</a>…
      </p>
    </main>
  );
}
