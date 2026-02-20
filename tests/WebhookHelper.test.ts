import { describe, it, expect } from "vitest";
import {
  validateWebhookSignature,
  parseConsumablePurchaseEvent,
} from "../src/helpers/WebhookHelper";
import { createHmac } from "crypto";
import type { RevenueCatWebhookEvent } from "../src/types";

describe("WebhookHelper", () => {
  describe("validateWebhookSignature", () => {
    it("should return true for valid signature", () => {
      const secret = "test_secret";
      const body = '{"event":{"type":"test"}}';
      const hmac = createHmac("sha256", secret);
      hmac.update(body);
      const signature = hmac.digest("hex");

      expect(validateWebhookSignature(body, signature, secret)).toBe(true);
    });

    it("should return false for invalid signature", () => {
      expect(
        validateWebhookSignature(
          '{"event":{}}',
          "invalid_sig",
          "test_secret",
        ),
      ).toBe(false);
    });

    it("should return false for tampered body", () => {
      const secret = "test_secret";
      const originalBody = '{"event":{"type":"test"}}';
      const hmac = createHmac("sha256", secret);
      hmac.update(originalBody);
      const signature = hmac.digest("hex");

      const tamperedBody = '{"event":{"type":"tampered"}}';
      expect(validateWebhookSignature(tamperedBody, signature, secret)).toBe(
        false,
      );
    });
  });

  describe("parseConsumablePurchaseEvent", () => {
    const baseEvent: RevenueCatWebhookEvent = {
      api_version: "1.0",
      event: {
        type: "NON_RENEWING_PURCHASE",
        app_user_id: "user123",
        product_id: "credits_25",
        price_in_purchased_currency: 19.99,
        currency: "USD",
        store: "STRIPE",
        transaction_id: "txn_abc123",
        purchased_at_ms: 1700000000000,
      },
    };

    it("should parse NON_RENEWING_PURCHASE events", () => {
      const result = parseConsumablePurchaseEvent(baseEvent);

      expect(result).toEqual({
        userId: "user123",
        transactionId: "txn_abc123",
        productId: "credits_25",
        priceCents: 1999,
        currency: "USD",
        store: "web",
      });
    });

    it("should parse INITIAL_PURCHASE events", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, type: "INITIAL_PURCHASE" },
      };
      const result = parseConsumablePurchaseEvent(event);
      expect(result).not.toBeNull();
    });

    it("should return null for subscription events", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, type: "RENEWAL" },
      };
      expect(parseConsumablePurchaseEvent(event)).toBeNull();
    });

    it("should map APP_STORE to apple", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, store: "APP_STORE" },
      };
      const result = parseConsumablePurchaseEvent(event);
      expect(result!.store).toBe("apple");
    });

    it("should map PLAY_STORE to google", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, store: "PLAY_STORE" },
      };
      const result = parseConsumablePurchaseEvent(event);
      expect(result!.store).toBe("google");
    });

    it("should pass through unknown store names", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, store: "AMAZON" },
      };
      const result = parseConsumablePurchaseEvent(event);
      expect(result!.store).toBe("AMAZON");
    });

    it("should round price to cents correctly", () => {
      const event = {
        ...baseEvent,
        event: { ...baseEvent.event, price_in_purchased_currency: 4.995 },
      };
      const result = parseConsumablePurchaseEvent(event);
      expect(result!.priceCents).toBe(500);
    });
  });
});
