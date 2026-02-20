import {
  varchar,
  timestamp,
  serial,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Create consumable tables within a given Drizzle PgSchema.
 * The consuming API passes its own schema so migrations stay in one place.
 *
 * Uses `any` for schema param to avoid drizzle-orm version coupling
 * between this library and the consuming API.
 */
export function createConsumablesSchema(schema: any) {
  const consumableBalances = schema.table("consumable_balances", {
    user_id: varchar("user_id", { length: 128 }).primaryKey(),
    balance: integer("balance").notNull().default(0),
    initial_credits: integer("initial_credits").notNull().default(0),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  });

  const consumablePurchases = schema.table("consumable_purchases", {
    id: serial("id").primaryKey(),
    user_id: varchar("user_id", { length: 128 }).notNull(),
    credits: integer("credits").notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    transaction_ref_id: varchar("transaction_ref_id", { length: 255 }),
    product_id: varchar("product_id", { length: 255 }),
    price_cents: integer("price_cents"),
    currency: varchar("currency", { length: 10 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
  });

  const consumableUsages = schema.table("consumable_usages", {
    id: serial("id").primaryKey(),
    user_id: varchar("user_id", { length: 128 }).notNull(),
    filename: varchar("filename", { length: 500 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
  });

  return { consumableBalances, consumablePurchases, consumableUsages };
}

export type ConsumablesSchemaResult = ReturnType<typeof createConsumablesSchema>;
