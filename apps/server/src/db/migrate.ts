import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
