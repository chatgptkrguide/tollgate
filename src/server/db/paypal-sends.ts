import { and, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import { SEND_LIMITS, SEND_LIMITS_PER_COPY, type SendLimit } from "../../domain/send-limit";
import type { Db } from "./client";
import { paypalSends } from "./schema";

// The send caps per copy and per server, counted in their own table (P2-S1, P2-S1b, P2-S5). A demo reset and the
// seven-day cleanup delete a copy's orders and activity but never this table, and it outlives a restart. One row is one
// send that reached PayPal (a Send again counts too).

export interface SendLimits {
  perCopy: readonly SendLimit[];
  perServer: readonly SendLimit[];
}

const DEFAULT_LIMITS: SendLimits = { perCopy: SEND_LIMITS_PER_COPY, perServer: SEND_LIMITS };

// taken: a place was taken · copy_full: this copy is at one of its caps · server_full: the copy has room but the server
// doesn't. When both are full, the copy's cap is the one named: it is the one its visitor can do nothing about later.
export type SendTake = "taken" | "copy_full" | "server_full";

// Takes one place under every limit, or answers which cap refused and records nothing. One batch: prune rows older
// than the longest window, a single INSERT … SELECT … WHERE (count in each window) < max, then whether the copy still
// has room. SQLite runs one write at a time, so two requests (or two processes on the same file) can't both take the
// last place, and the last read sees the same rows the INSERT did. A row counts in a window while its time is after
// `at - windowMs`.
export async function takePayPalSend(db: Db, projectId: string, changeOrderId: string, at: Date, limits: SendLimits = DEFAULT_LIMITS): Promise<SendTake> {
  const now = at.getTime();
  const since = (windowMs: number) => new Date(now - windowMs).toISOString();
  const longestWindowMs = Math.max(...[...limits.perCopy, ...limits.perServer].map((limit) => limit.windowMs));

  const room = (limit: SendLimit, where: SQL | undefined) => sql`(SELECT count(*) FROM ${paypalSends} WHERE ${where}) < ${limit.max}`;
  const copyRooms = limits.perCopy.map((limit) => room(limit, and(eq(paypalSends.projectId, projectId), gt(paypalSends.at, since(limit.windowMs)))));
  const serverRooms = limits.perServer.map((limit) => room(limit, gt(paypalSends.at, since(limit.windowMs))));
  const all = (conditions: SQL[]) => (conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1`);

  const [, taken, copy] = await db.batch([
    db.delete(paypalSends).where(lte(paypalSends.at, since(longestWindowMs))),
    db.run(
      sql`INSERT INTO ${paypalSends} (change_order_id, project_id, at) SELECT ${changeOrderId}, ${projectId}, ${at.toISOString()} WHERE ${all([...copyRooms, ...serverRooms])}`,
    ),
    db.all<{ room: number }>(sql`SELECT ${all(copyRooms)} AS room`),
  ]);
  if (taken.rowsAffected > 0) return "taken";
  return copy[0]?.room ? "server_full" : "copy_full";
}
