/**
 * @fileoverview Service-only type definitions for the consumables backend library.
 * Defines database row types, RevenueCat webhook event structure, and service configuration.
 */

// === DB row types (service-only) ===

/** Database row type for a user's consumable credit balance. */
export interface ConsumableBalance {
  user_id: string;
  balance: number;
  initial_credits: number;
  created_at: Date;
  updated_at: Date;
}

/** Database row type for a consumable credit purchase record. */
export interface ConsumablePurchase {
  id: number;
  user_id: string;
  credits: number;
  source: string;
  transaction_ref_id: string | null;
  product_id: string | null;
  price_cents: number | null;
  currency: string | null;
  created_at: Date;
}

/** Database row type for a consumable credit usage record. */
export interface ConsumableUsage {
  id: number;
  user_id: string;
  filename: string | null;
  created_at: Date;
}

// === Webhook types (service-only) ===

/** Structure of a RevenueCat webhook event payload. */
export interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    price_in_purchased_currency: number;
    currency: string;
    store: string;
    transaction_id: string;
    purchased_at_ms: number;
  };
}

// === Config (service-only) ===

/** Configuration for the ConsumablesHelper service. */
export interface ConsumablesConfig {
  initialFreeCredits: number;
  revenueCatWebhookSecret?: string;
}
