import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        "src/routes/**/*.ts",
        "src/lib/**/*.ts",
        "src/middleware/**/*.ts",
        "src/services/worker/**/*.ts",
        "src/services/**/*-worker.ts",
        "src/**/*.test.ts",
        "src/__tests__/**/*.ts",
      ],
      project: ["src/**/*.ts"],
    },
  },
  ignore: [
    "native/**",
    "src/scraper/scrapeURL/engines/fire-engine/branding-script/**",
    // Legacy auto-recharge files — kept but disabled (Autumn handles auto-recharge now)
    "src/services/billing/auto_charge.ts",
    "src/services/billing/issue_credits.ts",
    "src/services/billing/stripe.ts",
  ],
  ignoreDependencies: [
    "undici-types",
    "stripe",
    // Legacy Firecrawl native module — used in source but not in package.json
    "@mendable/firecrawl-rs",
    // Workspace packages — knip can't resolve pnpm workspace symlinks from this sub-project
    "@crawlx/artifact-store",
    "@crawlx/change-tracking",
    "@crawlx/db",
    "@crawlx/firecrawl-client",
    "@crawlx/firecrawl-compat",
    "@crawlx/jobs",
    "@crawlx/model-adapter",
    "@crawlx/policy",
    "@crawlx/search-provider",
    "@crawlx/security",
    "@crawlx/usage-meter",
    "@crawlx/waterfall-engine",
    "@crawlx/webhooks",
  ],
};

export default config;
