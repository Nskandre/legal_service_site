import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  max: 1,
  connect_timeout: 15,
});

try {
  const directory = path.resolve("migrations");
  const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    await sql.unsafe(await fs.readFile(path.join(directory, file), "utf8"));
    console.log("Applied migration " + file);
  }
} finally {
  await sql.end();
}
