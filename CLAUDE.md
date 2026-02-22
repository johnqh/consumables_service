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

## Related Projects

- **svgr_api** — The primary consuming API. It uses `createConsumablesSchema` and `ConsumablesHelper` for its credits system. Changes here directly affect svgr_api.
- **consumables_client** (`@sudobility/consumables_client`) — Frontend counterpart that calls this service's API endpoints over HTTP. The client and service must agree on API contracts (response shapes, error codes).

Dependency direction: `svgr_api` --> `consumables_service` (library dep); `consumables_client` --> `consumables_service` (HTTP at runtime)

## Coding Patterns

- **Schema factory pattern**: `createConsumablesSchema(pgSchema)` accepts any Drizzle `PgSchema` so the consumer owns all migrations. Never create migrations in this package -- the consuming API handles that.
- **Atomic balance operations**: Balance increments (purchases) and decrements (usage) use atomic SQL operations (e.g., `SET credits = credits + N`). Never read-then-write; always use atomic updates to avoid race conditions.
- **Idempotent webhook processing**: `recordPurchaseFromWebhook()` uses the transaction reference as a deduplication key. Replaying the same webhook is safe and produces no duplicate records.
- **Get-or-create pattern for balances**: `getBalance(userId)` creates a balance row with `initialFreeCredits` if none exists. This avoids separate "create user" flows.

## Gotchas

- **`createConsumablesSchema` takes any `PgSchema` to avoid drizzle-orm version coupling**: The consuming API passes its own schema instance. This means this library does not pin a specific drizzle-orm version for schema creation. Be careful not to use drizzle APIs that only exist in specific versions.
- **`recordPurchaseFromWebhook` is idempotent (safe to replay)**: It checks for existing transactions by reference ID before inserting. Do not remove this deduplication check.
- **Balance decrements guard against going negative**: `recordUsage()` uses a `WHERE credits > 0` guard in the atomic update. If the balance is zero, the operation fails gracefully rather than going negative. Do not remove this guard.
- **Consumer owns migrations**: Even though this package defines the schema, the consuming API (e.g., svgr_api) generates and runs migrations. Never add migration files to this package.
- **Free credits are granted once**: `getBalance()` only grants `initialFreeCredits` on first access (row creation). Subsequent calls return the existing balance. Do not change this to grant free credits on every call.

## Testing

- Run tests: `bun test` (uses vitest)
- Tests use a **mock database** -- they do not connect to a real PostgreSQL instance.
- `ConsumablesHelper.test.ts` tests core business logic: balance get-or-create, purchase recording, usage recording, pagination, and idempotent webhook processing.
- `WebhookHelper.test.ts` tests HMAC signature validation and event parsing.
- When adding new helper methods, add corresponding tests with both success and failure cases (e.g., insufficient balance, duplicate webhook).

## Publishing

- Package: `@sudobility/consumables_service` (public on npm)
- Build before publish: `bun run build` produces ESM output in `dist/`
- Run `bun run verify` before publishing -- this runs lint, typecheck, tests, and build in sequence.
- Bump version in `package.json`, then `npm publish --access public`
- After publishing, update the dependency version in consuming APIs (e.g., svgr_api) and verify they still build and pass tests
