import { createClient } from "@libsql/client";
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const res = await client.execute("SELECT c.slug, p.sizes, COUNT(*) as n FROM Product p JOIN Category c ON p.categoryId = c.id WHERE p.active = 1 AND p.sold = 0 GROUP BY c.slug, p.sizes ORDER BY c.slug, p.sizes");
for (const row of res.rows) console.log(row.slug, "|", row.sizes, "|", row.n);
