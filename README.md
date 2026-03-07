# @sudobility/consumables_service

Shared backend library for consumable credits management with Drizzle ORM and PostgreSQL.

## Installation

```bash
bun add @sudobility/consumables_service
```

## Usage

```typescript
import {
  createConsumablesSchema,
  ConsumablesHelper,
  validateWebhookSignature,
  parseConsumablePurchaseEvent,
} from '@sudobility/consumables_service';

// Create schema tables within your Drizzle PgSchema
const tables = createConsumablesSchema(mySchema);

// Initialize helper with DB and config
const helper = new ConsumablesHelper(db, tables, { initialFreeCredits: 3 });

// Core operations
const balance = await helper.getBalance(userId);
const updated = await helper.recordPurchase(userId, { credits: 25, source: 'web' });
const result = await helper.recordUsage(userId, 'logo.svg');
```

## API

### Schema

| Export | Description |
|--------|-------------|
| `createConsumablesSchema(pgSchema)` | Creates `consumable_balances`, `consumable_purchases`, `consumable_usages` tables |

### ConsumablesHelper

| Method | Description |
|--------|-------------|
| `getBalance(userId)` | Get-or-create balance (auto-grants initial free credits) |
| `recordPurchase(userId, request)` | Record purchase + atomic balance increment |
| `recordUsage(userId, filename?)` | Atomic decrement with insufficient-balance guard |
| `getPurchaseHistory(userId, limit?, offset?)` | Paginated purchase audit trail |
| `getUsageHistory(userId, limit?, offset?)` | Paginated usage audit trail |
| `recordPurchaseFromWebhook(...)` | Idempotent webhook-driven purchase recording |

### Webhook Helpers

| Export | Description |
|--------|-------------|
| `validateWebhookSignature(rawBody, signature, secret)` | HMAC-SHA256 validation for RevenueCat webhooks |
| `parseConsumablePurchaseEvent(event)` | Extract purchase data from RevenueCat webhook events |

### Types

`ConsumableBalance`, `ConsumablePurchase`, `ConsumableUsage`, `RevenueCatWebhookEvent`, `ConsumablesConfig`

## Development

```bash
bun run build        # Build ESM via tsc
bun run dev          # Watch mode
bun test             # Run tests (vitest, mock DB)
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run verify       # All checks + build (typecheck && lint && test && build)
```

## License

BUSL-1.1
