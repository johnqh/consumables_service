// Shared types (from @sudobility/types, re-exported for convenience)
export type {
  ConsumableSource,
  ConsumableBalanceResponse,
  ConsumablePurchaseRequest,
  ConsumableUseRequest,
  ConsumableUseResponse,
  ConsumablePurchaseRecord,
  ConsumableUsageRecord,
  // Backward-compat aliases
  BalanceResponse,
  PurchaseRequest,
  UseRequest,
  UseResponse,
} from "./types";

// Service-only types
export type {
  ConsumableBalance,
  ConsumablePurchase,
  ConsumableUsage,
  RevenueCatWebhookEvent,
  ConsumablesConfig,
} from "./types";

// Schema
export {
  createConsumablesSchema,
  type ConsumablesSchemaResult,
} from "./schema";

// Helpers
export {
  ConsumablesHelper,
  validateWebhookSignature,
  parseConsumablePurchaseEvent,
} from "./helpers";
