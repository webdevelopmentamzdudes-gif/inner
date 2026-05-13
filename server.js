// Custom Node entrypoint for Hostinger Node.js Web App (Phusion Passenger).
// Kept intentionally minimal: just boot Next. Schema is created by running
// `npx prisma migrate deploy` manually on first deploy, and the admin user is
// seeded with a one-time SQL insert in phpMyAdmin.

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js:", err);
    process.exit(1);
  });
