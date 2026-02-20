import { eq, desc, sql } from "drizzle-orm";
import type { ConsumablesSchemaResult } from "../schema";
import type {
  ConsumableBalanceResponse,
  ConsumablePurchaseRequest,
  ConsumableSource,
  ConsumableUseResponse,
} from "@sudobility/types";
import type {
  ConsumablePurchase,
  ConsumableUsage,
  ConsumablesConfig,
} from "../types";

export class ConsumablesHelper {
  private db: any;
  private tables: ConsumablesSchemaResult;
  private config: ConsumablesConfig;

  constructor(
    db: any,
    tables: ConsumablesSchemaResult,
    config: ConsumablesConfig,
  ) {
    this.db = db;
    this.tables = tables;
    this.config = config;
  }

  /** Get or create balance record. Auto-grants free credits on first access. */
  async getBalance(userId: string): Promise<ConsumableBalanceResponse> {
    const { consumableBalances } = this.tables;
    const existing = await this.db
      .select()
      .from(consumableBalances)
      .where(eq(consumableBalances.user_id, userId));

    if (existing.length > 0) {
      return {
        balance: existing[0].balance,
        initial_credits: existing[0].initial_credits,
      };
    }

    // First access — create with free credits
    const freeCredits = this.config.initialFreeCredits;
    await this.db.insert(consumableBalances).values({
      user_id: userId,
      balance: freeCredits,
      initial_credits: freeCredits,
    });

    // Record the free credits as a purchase audit entry
    if (freeCredits > 0) {
      await this.db.insert(this.tables.consumablePurchases).values({
        user_id: userId,
        credits: freeCredits,
        source: "free" as ConsumableSource,
      });
    }

    return { balance: freeCredits, initial_credits: freeCredits };
  }

  /** Record a purchase. Atomically adds credits to balance. */
  async recordPurchase(
    userId: string,
    request: ConsumablePurchaseRequest,
  ): Promise<ConsumableBalanceResponse> {
    const { consumableBalances, consumablePurchases } = this.tables;

    // Ensure balance record exists (idempotent)
    await this.getBalance(userId);

    // Insert purchase record
    await this.db.insert(consumablePurchases).values({
      user_id: userId,
      credits: request.credits,
      source: request.source,
      transaction_ref_id: request.transaction_ref_id ?? null,
      product_id: request.product_id ?? null,
      price_cents: request.price_cents ?? null,
      currency: request.currency ?? null,
    });

    // Atomically increment balance
    await this.db
      .update(consumableBalances)
      .set({
        balance: sql`${consumableBalances.balance} + ${request.credits}`,
        updated_at: new Date(),
      })
      .where(eq(consumableBalances.user_id, userId));

    // Return updated balance
    const updated = await this.db
      .select()
      .from(consumableBalances)
      .where(eq(consumableBalances.user_id, userId));

    return {
      balance: updated[0].balance,
      initial_credits: updated[0].initial_credits,
    };
  }

  /** Record a usage. Atomically deducts 1 credit. Returns error if insufficient. */
  async recordUsage(
    userId: string,
    filename?: string,
  ): Promise<ConsumableUseResponse> {
    const { consumableBalances, consumableUsages } = this.tables;

    // Atomically decrement (with guard against going negative)
    const result = await this.db
      .update(consumableBalances)
      .set({
        balance: sql`${consumableBalances.balance} - 1`,
        updated_at: new Date(),
      })
      .where(
        sql`${consumableBalances.user_id} = ${userId} AND ${consumableBalances.balance} > 0`,
      )
      .returning({ balance: consumableBalances.balance });

    if (result.length === 0) {
      // Either user doesn't exist or balance is 0
      const current = await this.getBalance(userId);
      return { balance: current.balance, success: false };
    }

    // Record usage
    await this.db.insert(consumableUsages).values({
      user_id: userId,
      filename: filename ?? null,
    });

    return { balance: result[0].balance, success: true };
  }

  /** Get purchase history (most recent first). */
  async getPurchaseHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<ConsumablePurchase[]> {
    const { consumablePurchases } = this.tables;
    return this.db
      .select()
      .from(consumablePurchases)
      .where(eq(consumablePurchases.user_id, userId))
      .orderBy(desc(consumablePurchases.created_at))
      .limit(limit)
      .offset(offset);
  }

  /** Get usage history (most recent first). */
  async getUsageHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<ConsumableUsage[]> {
    const { consumableUsages } = this.tables;
    return this.db
      .select()
      .from(consumableUsages)
      .where(eq(consumableUsages.user_id, userId))
      .orderBy(desc(consumableUsages.created_at))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Idempotent purchase recording from webhook.
   * Checks if transaction_ref_id already exists to prevent duplicates.
   */
  async recordPurchaseFromWebhook(
    userId: string,
    transactionId: string,
    credits: number,
    source: ConsumableSource,
    productId: string,
    priceCents: number,
    currency: string,
  ): Promise<{ alreadyProcessed: boolean; balance: number }> {
    // Check for duplicate
    const existing = await this.db
      .select()
      .from(this.tables.consumablePurchases)
      .where(
        eq(this.tables.consumablePurchases.transaction_ref_id, transactionId),
      );

    if (existing.length > 0) {
      const bal = await this.getBalance(userId);
      return { alreadyProcessed: true, balance: bal.balance };
    }

    const result = await this.recordPurchase(userId, {
      credits,
      source,
      transaction_ref_id: transactionId,
      product_id: productId,
      price_cents: priceCents,
      currency,
    });

    return { alreadyProcessed: false, balance: result.balance };
  }
}
