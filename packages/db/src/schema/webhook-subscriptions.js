"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookSubscriptions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.webhookSubscriptions = (0, pg_core_1.pgTable)('webhook_subscriptions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    url: (0, pg_core_1.text)('url').notNull(),
    events: (0, pg_core_1.text)('events').array().notNull(),
    eventTypes: (0, pg_core_1.text)("event_types").array(),
    secret: (0, pg_core_1.text)('secret').notNull(),
    active: (0, pg_core_1.boolean)("active"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
//# sourceMappingURL=webhook-subscriptions.js.map