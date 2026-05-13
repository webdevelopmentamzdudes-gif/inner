// Disabled while we debug a Hostinger boot crash. The seed/migrate were moved
// here to defer DB setup to runtime, but if anything inside register() or its
// deferred work throws synchronously we lose the entire Node process and get
// 503 from the reverse proxy. Returning immediately guarantees Next can boot.
//
// DB schema is already deployed (tables exist in MySQL). Admin user is inserted
// manually via phpMyAdmin. Once login is confirmed working we can revisit
// automated seeding with proper logging.

export async function register() {
  return;
}
