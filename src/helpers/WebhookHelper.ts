import { createHmac } from "crypto";
import type { RevenueCatWebhookEvent } from "../types";

/**
 * Validates RevenueCat webhook HMAC signature.
 */
export function validateWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");
  return signature === expected;
}

const STORE_TO_SOURCE: Record<string, string> = {
  STRIPE: "web",
  APP_STORE: "apple",
  PLAY_STORE: "google",
};

/**
 * Parse the webhook event and extract purchase data.
 * Returns null if the event type is not a consumable purchase.
 */
export function parseConsumablePurchaseEvent(
  event: RevenueCatWebhookEvent,
): {
  userId: string;
  transactionId: string;
  productId: string;
  priceCents: number;
  currency: string;
  store: string;
} | null {
  const validTypes = ["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"];

  if (!validTypes.includes(event.event.type)) {
    return null;
  }

  return {
    userId: event.event.app_user_id,
    transactionId: event.event.transaction_id,
    productId: event.event.product_id,
    priceCents: Math.round(event.event.price_in_purchased_currency * 100),
    currency: event.event.currency,
    store: STORE_TO_SOURCE[event.event.store] ?? event.event.store,
  };
}
