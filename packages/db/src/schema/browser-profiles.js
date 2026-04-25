"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserProfiles = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.browserProfiles = (0, pg_core_1.pgTable)('browser_profiles', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    domain: (0, pg_core_1.text)('domain').notNull(),
    backend: (0, pg_core_1.text)('backend').notNull().default('local_vault'),
    encryptedProfile: (0, pg_core_1.text)('encrypted_profile'),
    externalProfileId: (0, pg_core_1.text)('external_profile_id'),
    externalProfileLabel: (0, pg_core_1.text)('external_profile_label'),
    bridgeTarget: (0, pg_core_1.text)('bridge_target'),
    automationType: (0, pg_core_1.text)('automation_type'),
    profileKind: (0, pg_core_1.text)('profile_kind'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
//# sourceMappingURL=browser-profiles.js.map
