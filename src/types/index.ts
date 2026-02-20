// Shared API contract types from @sudobility/types
export type {
  ConsumableSource,
  ConsumableBalanceResponse,
  ConsumablePurchaseRequest,
  ConsumableUseRequest,
  ConsumableUseResponse,
  ConsumablePurchaseRecord,
  ConsumableUsageRecord,
} from "@sudobility/types";

// Backward-compat aliases for existing consumers
export type {
  ConsumableBalanceResponse as BalanceResponse,
  ConsumablePurchaseRequest as PurchaseRequest,
  ConsumableUseRequest as UseRequest,
  ConsumableUseResponse as UseResponse,
} from "@sudobility/types";

// === DB row types (service-only) ===

export interface ConsumableBalance {
  user_id: string;
  balance: number;
  initial_credits: number;
  created_at: Date;
  updated_at: Date;
}

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

export interface ConsumableUsage {
  id: number;
  user_id: string;
  filename: string | null;
  created_at: Date;
}

// === Webhook types (service-only) ===

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

export interface ConsumablesConfig {
  initialFreeCredits: number;
  revenueCatWebhookSecret?: string;
}
