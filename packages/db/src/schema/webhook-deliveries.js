"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookDeliveries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const webhook_subscriptions_1 = require("./webhook-subscriptions");
exports.webhookDeliveries = (0, pg_core_1.pgTable)('webhook_deliveries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    subscriptionId: (0, pg_core_1.uuid)('subscription_id').references(() => webhook_subscriptions_1.webhookSubscriptions.id).notNull(),
    status: (0, pg_core_1.integer)('status').notNull(),
    attemptAt: (0, pg_core_1.timestamp)('attempt_at').defaultNow(),
});
//# sourceMappingURL=webhook-deliveries.js.map