import { and, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import { SANDBOX_PAYMENT_LIMITS_PER_COPY, SANDBOX_PAYMENT_LIMITS_PER_SERVER } from "../../domain/sandbox-payment-limit";
import type { SendLimit } from "../../domain/send-limit";
import type { Db } from "./client";
import type { SendTake } from "./paypal-sends";
import { sandboxPayments } from "./schema";

export interface SandboxPaymentLimits {
  perCopy: readonly SendLimit[];
  perServer: readonly SendLimit[];
}

const DEFAULT_LIMITS: SandboxPaymentLimits = { perCopy: SANDBOX_PAYMENT_LIMITS_PER_COPY, perServer: SANDBOX_PAYMENT_LIMITS_PER_SERVER };

// Takes one place under every limit, or answers which cap refused and records nothing. The same single batch as
// takePayPalSend (prune, one INSERT … SELECT … WHERE, then whether the copy still has room), so two requests can't both
// take the last place. A payment PayPal then refuses still counts: the call was made.
export async function takeSandboxPayment(
  db: Db,
  projectId: string,
  changeOrderId: string,
  at: Date,
  limits: SandboxPaymentLimits = DEFAULT_LIMITS,
): Promise<SendTake> {
  const now = at.getTime();
  const since = (windowMs: number) => new Date(now - windowMs).toISOString();
  const longestWindowMs = Math.max(...[...limits.perCopy, ...limits.perServer].map((limit) => limit.windowMs));

  const room = (limit: SendLimit, where: SQL | undefined) => sql`(SELECT count(*) FROM ${sandboxPayments} WHERE ${where}) < ${limit.max}`;
  const copyRooms = limits.perCopy.map((limit) => room(limit, and(eq(sandboxPayments.projectId, projectId), gt(sandboxPayments.at, since(limit.windowMs)))));
  const serverRooms = limits.perServer.map((limit) => room(limit, gt(sandboxPayments.at, since(limit.windowMs))));
  const all = (conditions: SQL[]) => (conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1`);

  const [, taken, copy] = await db.batch([
    db.delete(sandboxPayments).where(lte(sandboxPayments.at, since(longestWindowMs))),
    db.run(
      sql`INSERT INTO ${sandboxPayments} (change_order_id, project_id, at) SELECT ${changeOrderId}, ${projectId}, ${at.toISOString()} WHERE ${all([...copyRooms, ...serverRooms])}`,
    ),
    db.all<{ room: number }>(sql`SELECT ${all(copyRooms)} AS room`),
  ]);
  if (taken.rowsAffected > 0) return "taken";
  return copy[0]?.room ? "server_full" : "copy_full";
}
