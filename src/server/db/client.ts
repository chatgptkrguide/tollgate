import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env";
import * as schema from "./schema";

// With no arguments, the URL and token come from the environment. A caller that passes a URL passes its token too.
export function createDb(url?: string, authToken?: string) {
  const target = url ?? env().DATABASE_URL;
  const token = url === undefined ? env().DATABASE_AUTH_TOKEN : authToken;
  // A local file database needs its folder; remote and in-memory URLs don't.
  if (target.startsWith("file:") && !target.includes(":memory:")) {
    mkdirSync(dirname(target.slice("file:".length)), { recursive: true });
  }
  return drizzle({ client: createClient(token ? { url: target, authToken: token } : { url: target }), schema });
}

export type Db = ReturnType<typeof createDb>;

let shared: Db | undefined;

export function getDb(): Db {
  shared ??= createDb();
  return shared;
}
