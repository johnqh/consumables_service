/**
 * @fileoverview Webhook validation and parsing utilities for RevenueCat events.
 * Handles HMAC-SHA256 signature verification and extraction of purchase data
 * from webhook payloads.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { RevenueCatWebhookEvent } from "../types";

/**
 * Validates a RevenueCat webhook HMAC-SHA256 signature.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param rawBody - The raw request body string.
 * @param signature - The signature from the webhook header.
 * @param secret - The shared webhook secret.
 * @returns True if the signature is valid, false otherwise.
 */
export function validateWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

const STORE_TO_SOURCE: Record<string, string> = {
  STRIPE: "web",
  APP_STORE: "apple",
  PLAY_STORE: "google",
};

/**
 * Parses a RevenueCat webhook event and extracts purchase data.
 * Only processes NON_RENEWING_PURCHASE and INITIAL_PURCHASE event types.
 * Maps store names to sources (STRIPE -> web, APP_STORE -> apple, PLAY_STORE -> google).
 * @param event - The RevenueCat webhook event payload.
 * @returns Extracted purchase data, or null if the event type is not a consumable purchase.
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
