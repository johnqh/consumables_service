# Consumables Service - Improvement Plans

## Priority 1: Critical / High-Impact

### 1.1 Add Transaction Wrapping for Purchase Recording
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: `recordPurchase()` performs three separate database operations (getBalance, insert purchase, update balance) without a transaction. If any step fails partway through, data could be left in an inconsistent state (e.g., purchase recorded but balance not incremented).
**Suggestion**: Wrap the multi-step operations in a database transaction using `db.transaction()`.

### 1.2 Add Type Safety for `db` Parameter
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: The `db` parameter is typed as `any`, which means no compile-time checks on query builder usage. This could lead to runtime errors if the API changes between drizzle-orm versions.
**Suggestion**: Define a minimal interface for the `db` parameter (e.g., `{ select, insert, update, transaction }`) rather than using `any`. This provides basic type checking without full version coupling.

### 1.3 Add Timing-Safe Comparison for Webhook Signatures
**File**: `src/helpers/WebhookHelper.ts`
**Issue**: `validateWebhookSignature()` uses `===` string comparison, which is vulnerable to timing attacks. An attacker could use response time differences to brute-force the signature.
**Suggestion**: Use Node.js `crypto.timingSafeEqual()` for constant-time comparison of the expected and actual signatures.

## Priority 2: Moderate / Quality

### 2.1 Add Credits Validation in `recordPurchase`
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: There is no validation that `request.credits` is a positive integer. Negative or zero credits would be silently accepted, potentially corrupting balances.
**Suggestion**: Add input validation: `credits` must be a positive integer, `source` must be a known value.

### 2.2 Add Pagination Metadata to History Methods
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: `getPurchaseHistory()` and `getUsageHistory()` return only the records array. Consumers cannot tell if there are more records without requesting the next page.
**Suggestion**: Return `{ data: T[], total: number, hasMore: boolean }` to enable proper pagination UIs.

### 2.3 Add Webhook Event Type Extensibility
**File**: `src/helpers/WebhookHelper.ts`
**Issue**: `parseConsumablePurchaseEvent()` only handles `NON_RENEWING_PURCHASE` and `INITIAL_PURCHASE` event types. Other event types (refunds, cancellations) are silently ignored.
**Suggestion**: Add handling for `CANCELLATION` events to support refund/credit-clawback flows. At minimum, add logging for unhandled event types.

### 2.4 Add Index Recommendations for Schema
**File**: `src/schema/index.ts`
**Issue**: The schema defines tables but no indexes beyond primary keys. Queries filter by `user_id` and order by `created_at`, which would benefit from composite indexes.
**Suggestion**: Add a `createConsumablesIndexes()` helper that creates `(user_id, created_at DESC)` indexes on the purchases and usages tables. Alternatively, document the recommended indexes for consuming APIs.

### 2.5 Add Rate Limiting Awareness
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: `recordUsage()` has no mechanism to prevent rapid-fire usage (e.g., a bug or exploit draining credits in milliseconds).
**Suggestion**: Add an optional `minUsageIntervalMs` config option that enforces a minimum time between usage recordings for the same user.

## Priority 3: Low / Nice-to-Have

### 3.1 Add Balance Audit Trail
**Issue**: The balance is stored as a single integer. If it drifts from the sum of purchases minus usages, there is no way to detect or reconcile.
**Suggestion**: Add a `reconcileBalance(userId)` method that recalculates the balance from the purchase and usage tables.

### 3.2 Add Credits Expiration Support
**Issue**: Credits never expire. Some business models require time-limited credits.
**Suggestion**: Add an optional `expires_at` field to purchases and a `getEffectiveBalance()` method that excludes expired credits.

### 3.3 Extract Store-to-Source Mapping to Types
**File**: `src/helpers/WebhookHelper.ts`
**Issue**: The `STORE_TO_SOURCE` mapping is a local constant. Other parts of the ecosystem may need the same mapping.
**Suggestion**: Move the mapping to `src/types/index.ts` and export it.

### 3.4 Add Batch Usage Recording
**File**: `src/helpers/ConsumablesHelper.ts`
**Issue**: `recordUsage()` only deducts 1 credit per call. Some operations may require multiple credits.
**Suggestion**: Add a `creditsPerUsage` parameter (defaulting to 1) for flexibility.
