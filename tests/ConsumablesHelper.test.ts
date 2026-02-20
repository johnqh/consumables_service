import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConsumablesHelper } from "../src/helpers/ConsumablesHelper";
import type { ConsumablesSchemaResult } from "../src/schema";
import type { ConsumablesConfig } from "../src/types";

// Mock table references (used for eq/desc comparisons in Drizzle)
const mockTables = {
  consumableBalances: {
    user_id: "consumable_balances.user_id",
    balance: "consumable_balances.balance",
    initial_credits: "consumable_balances.initial_credits",
    updated_at: "consumable_balances.updated_at",
  },
  consumablePurchases: {
    id: "consumable_purchases.id",
    user_id: "consumable_purchases.user_id",
    credits: "consumable_purchases.credits",
    source: "consumable_purchases.source",
    transaction_ref_id: "consumable_purchases.transaction_ref_id",
    product_id: "consumable_purchases.product_id",
    price_cents: "consumable_purchases.price_cents",
    currency: "consumable_purchases.currency",
    created_at: "consumable_purchases.created_at",
  },
  consumableUsages: {
    id: "consumable_usages.id",
    user_id: "consumable_usages.user_id",
    filename: "consumable_usages.filename",
    created_at: "consumable_usages.created_at",
  },
} as unknown as ConsumablesSchemaResult;

const config: ConsumablesConfig = {
  initialFreeCredits: 3,
};

/**
 * Creates a mock Drizzle DB where every method returns `chainable` (sync)
 * except terminal methods (where, returning, offset, values) which are
 * thenable — they return the chainable AND can be awaited.
 *
 * Terminal resolution queues allow tests to enqueue return values.
 */
function createMockDb() {
  // Resolution queues for terminal methods
  const whereQueue: any[] = [];
  const returningQueue: any[] = [];
  const offsetQueue: any[] = [];
  const valuesQueue: any[] = [];

  const chainable: any = {};

  // Non-terminal methods: always return chainable synchronously
  for (const method of ["select", "from", "insert", "update", "set", "orderBy", "limit"]) {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  }

  // Terminal methods: return chainable (for further chaining) but also thenable
  function makeTerminal(queue: any[]) {
    const fn = vi.fn().mockImplementation(() => {
      // Return an object that is both chainable AND thenable
      const result = Object.create(chainable);
      result.then = (resolve: any, reject: any) => {
        const value = queue.length > 0 ? queue.shift() : [];
        return Promise.resolve(value).then(resolve, reject);
      };
      // Ensure all chain methods are still available
      for (const method of Object.keys(chainable)) {
        if (!(method in result)) {
          result[method] = chainable[method];
        }
      }
      return result;
    });
    return fn;
  }

  chainable.where = makeTerminal(whereQueue);
  chainable.returning = makeTerminal(returningQueue);
  chainable.offset = makeTerminal(offsetQueue);
  chainable.values = makeTerminal(valuesQueue);

  // Helper to enqueue responses
  chainable._enqueueWhere = (val: any) => whereQueue.push(val);
  chainable._enqueueReturning = (val: any) => returningQueue.push(val);
  chainable._enqueueOffset = (val: any) => offsetQueue.push(val);
  chainable._enqueueValues = (val: any) => valuesQueue.push(val);

  return chainable;
}

describe("ConsumablesHelper", () => {
  let db: any;
  let helper: ConsumablesHelper;

  beforeEach(() => {
    db = createMockDb();
    helper = new ConsumablesHelper(db, mockTables, config);
  });

  describe("getBalance", () => {
    it("should create balance with free credits on first access", async () => {
      // select().from().where() — user not found
      db._enqueueWhere([]);
      // insert().values() — balance insert
      db._enqueueValues(undefined);
      // insert().values() — free credits purchase insert
      db._enqueueValues(undefined);

      const result = await helper.getBalance("user123");

      expect(result).toEqual({
        balance: 3,
        initial_credits: 3,
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it("should return existing balance", async () => {
      db._enqueueWhere([
        { user_id: "user123", balance: 10, initial_credits: 3 },
      ]);

      const result = await helper.getBalance("user123");

      expect(result).toEqual({
        balance: 10,
        initial_credits: 3,
      });
    });

    it("should not insert free credits purchase if initialFreeCredits is 0", async () => {
      const noFreeHelper = new ConsumablesHelper(db, mockTables, {
        initialFreeCredits: 0,
      });
      // select().from().where() — user not found
      db._enqueueWhere([]);
      // insert().values() — balance insert
      db._enqueueValues(undefined);

      const result = await noFreeHelper.getBalance("user123");

      expect(result).toEqual({ balance: 0, initial_credits: 0 });
      // insert called once for balance, NOT for purchase
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe("recordPurchase", () => {
    it("should insert purchase and increment balance atomically", async () => {
      // getBalance → select().from().where() — existing user
      db._enqueueWhere([
        { user_id: "user123", balance: 3, initial_credits: 3 },
      ]);
      // insert purchase → values()
      db._enqueueValues(undefined);
      // update balance → set().where()
      db._enqueueWhere(undefined);
      // final select → where()
      db._enqueueWhere([
        { user_id: "user123", balance: 28, initial_credits: 3 },
      ]);

      const result = await helper.recordPurchase("user123", {
        credits: 25,
        source: "web",
        transaction_ref_id: "txn_abc",
        product_id: "credits_25",
        price_cents: 2000,
        currency: "USD",
      });

      expect(result).toEqual({
        balance: 28,
        initial_credits: 3,
      });
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("recordUsage", () => {
    it("should deduct 1 credit and record usage", async () => {
      // update().set().where().returning() — atomic decrement succeeds
      db._enqueueReturning([{ balance: 9 }]);
      // insert usage → values()
      db._enqueueValues(undefined);

      const result = await helper.recordUsage("user123", "logo.svg");

      expect(result).toEqual({ balance: 9, success: true });
      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it("should fail gracefully when balance is 0", async () => {
      // update().set().where().returning() — no rows updated
      db._enqueueReturning([]);
      // getBalance → select().from().where()
      db._enqueueWhere([
        { user_id: "user123", balance: 0, initial_credits: 3 },
      ]);

      const result = await helper.recordUsage("user123", "logo.svg");

      expect(result).toEqual({ balance: 0, success: false });
    });
  });

  describe("recordPurchaseFromWebhook", () => {
    it("should skip duplicate transactions", async () => {
      // select().from().where() — check existing transaction — found
      db._enqueueWhere([{ id: 1, transaction_ref_id: "txn_existing" }]);
      // getBalance → select().from().where()
      db._enqueueWhere([
        { user_id: "user123", balance: 28, initial_credits: 3 },
      ]);

      const result = await helper.recordPurchaseFromWebhook(
        "user123",
        "txn_existing",
        25,
        "web",
        "credits_25",
        2000,
        "USD",
      );

      expect(result.alreadyProcessed).toBe(true);
      expect(result.balance).toBe(28);
    });

    it("should process new transactions", async () => {
      // Check for existing — not found
      db._enqueueWhere([]);
      // recordPurchase → getBalance → where (existing user)
      db._enqueueWhere([
        { user_id: "user123", balance: 3, initial_credits: 3 },
      ]);
      // recordPurchase → insert purchase → values
      db._enqueueValues(undefined);
      // recordPurchase → update balance → where
      db._enqueueWhere(undefined);
      // recordPurchase → final select → where
      db._enqueueWhere([
        { user_id: "user123", balance: 28, initial_credits: 3 },
      ]);

      const result = await helper.recordPurchaseFromWebhook(
        "user123",
        "txn_new",
        25,
        "web",
        "credits_25",
        2000,
        "USD",
      );

      expect(result.alreadyProcessed).toBe(false);
      expect(result.balance).toBe(28);
    });
  });

  describe("getPurchaseHistory", () => {
    it("should return purchases ordered by date desc", async () => {
      const purchases = [
        {
          id: 2,
          user_id: "user123",
          credits: 25,
          source: "web",
          created_at: new Date("2025-01-02"),
        },
        {
          id: 1,
          user_id: "user123",
          credits: 3,
          source: "free",
          created_at: new Date("2025-01-01"),
        },
      ];
      db._enqueueOffset(purchases);

      const result = await helper.getPurchaseHistory("user123");

      expect(result).toEqual(purchases);
    });
  });

  describe("getUsageHistory", () => {
    it("should return usages ordered by date desc", async () => {
      const usages = [
        {
          id: 2,
          user_id: "user123",
          filename: "b.svg",
          created_at: new Date("2025-01-02"),
        },
        {
          id: 1,
          user_id: "user123",
          filename: "a.svg",
          created_at: new Date("2025-01-01"),
        },
      ];
      db._enqueueOffset(usages);

      const result = await helper.getUsageHistory("user123");

      expect(result).toEqual(usages);
    });
  });
});
