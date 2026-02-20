# Consumables Service

Shared backend library for consumable credits management with Drizzle ORM.

**npm**: `@sudobility/consumables_service` (public)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Bun
- **Package Manager**: Bun (do not use npm/yarn/pnpm for installing dependencies)
- **Build**: TypeScript compiler (ESM)
- **Test**: vitest

## Project Structure

```
src/
├── index.ts                    # Main exports
├── types/
│   └── index.ts                # All type definitions
├── schema/
│   └── index.ts                # Drizzle schema creator
└── helpers/
    ├── index.ts                # Helper re-exports
    ├── ConsumablesHelper.ts    # Core business logic
    └── WebhookHelper.ts       # RevenueCat webhook validation
tests/
├── ConsumablesHelper.test.ts
└── WebhookHelper.test.ts
```

## Commands

```bash
bun run build        # Build ESM
bun run clean        # Remove dist/
bun run dev          # Watch mode
bun test             # Run tests
bun run lint         # Run ESLint
bun run typecheck    # TypeScript check
bun run verify       # All checks + build (use before commit)
```

## Key Concepts

### Schema Creator

`createConsumablesSchema(pgSchema)` creates three tables within a given Drizzle PgSchema:
- `consumable_balances` — user balance with stored credit count
- `consumable_purchases` — purchase audit trail (source, transaction ref, price)
- `consumable_usages` — usage audit trail (filename, timestamp)

The consuming API passes its own schema so migrations stay in one place.

### ConsumablesHelper

Core business logic class. Constructed with `(db, tables, config)`:
- `getBalance(userId)` — get-or-create; auto-grants free credits on first access
- `recordPurchase(userId, request)` — insert purchase + atomic balance increment
- `recordUsage(userId, filename?)` — atomic decrement with balance > 0 guard
- `getPurchaseHistory/getUsageHistory` — paginated audit trail queries
- `recordPurchaseFromWebhook(...)` — idempotent webhook processing

### WebhookHelper

- `validateWebhookSignature(rawBody, signature, secret)` — HMAC-SHA256 validation
- `parseConsumablePurchaseEvent(event)` — extract purchase data from RevenueCat webhook

## Usage

```typescript
import {
  createConsumablesSchema,
  ConsumablesHelper,
} from "@sudobility/consumables_service";

// In your API's schema file:
const tables = createConsumablesSchema(mySchema);

// In your API's service file:
const helper = new ConsumablesHelper(db, tables, { initialFreeCredits: 3 });

const balance = await helper.getBalance(userId);
const updated = await helper.recordPurchase(userId, { credits: 25, source: "web", ... });
const result = await helper.recordUsage(userId, "logo.svg");
```

## Consuming APIs

APIs using this library:
- svgr_api
