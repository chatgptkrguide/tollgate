// libSQL reports constraint failures by extended code. A batch throws the libSQL error itself;
// a single Drizzle query wraps it, with the libSQL error as its cause.
const UNIQUE_CODES: ReadonlySet<string> = new Set(["SQLITE_CONSTRAINT_PRIMARYKEY", "SQLITE_CONSTRAINT_UNIQUE"]);

function field(value: unknown, name: "extendedCode" | "code" | "message" | "cause"): unknown {
  const read: unknown = typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined;
  return read;
}

// A remote database (Turso over HTTP) can send only the primary code, SQLITE_CONSTRAINT, with SQLite's own wording.
function isRemoteUniqueFailure(value: unknown): boolean {
  const message = field(value, "message");
  return field(value, "code") === "SQLITE_CONSTRAINT" && typeof message === "string" && message.includes("UNIQUE constraint failed");
}

// True when a write lost to an existing primary key or unique value (a duplicate, not a bug).
export function isUniqueViolation(error: unknown): boolean {
  const cause = field(error, "cause");
  const code = field(error, "extendedCode") ?? field(cause, "extendedCode");
  if (typeof code === "string") return UNIQUE_CODES.has(code);
  return isRemoteUniqueFailure(error) || isRemoteUniqueFailure(cause);
}
