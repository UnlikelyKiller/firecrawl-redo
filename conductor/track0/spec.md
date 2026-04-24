# Specification: Track 0 - Security Baseline + Infra

## 1. Overview
This specification details the establishment of the foundational security and infrastructure baseline. Before any scrape attempt can be initiated, we must enforce strict security boundaries, establish persistent database structures, and harden CI/CD pipelines.

## 2. Egress Firewall (`packages/security/`)
### 2.1 URL Validator
- Uses **Zod 4** to parse and strictly validate incoming URLs.
- Rejects URLs pointing to private IP space (RFC 1918), loopback, link-local, and specific cloud metadata endpoints (e.g., `169.254.169.254`).
- Handles protocol whitelisting (only `http` and `https`).

### 2.2 DNS Guard
- Resolves DNS prior to initiating requests.
- Validates that the resolved IP addresses do not map back to internal or restricted IP ranges. This directly mitigates DNS Rebinding attacks.
- Implements strict timeouts and leverages `neverthrow` to return predictable typed results.

### 2.3 Secret Redactor
- Content-Addressing pattern applied to sensitive payload handling.
- Redacts common credential patterns (API keys, passwords, JWT tokens) from logs and outputs.
- Returns `Result<SafeString, RedactionError>` using `neverthrow`.

## 3. Database Schema (Drizzle ORM)
Drizzle ORM schema stubs must be generated to support Phase 1. The models must be defined with clear relations:
- `agent_jobs`: Tracks high-level scrape orchestration and state.
- `webhook_subscriptions`: Subscriptions for event notifications.
- `webhook_deliveries`: Logs of webhook payload delivery attempts and statuses.
- `watch_jobs`: Definitions for recurring scrape/watch tasks.
- `engine_attempts`: Granular execution tracking per scraping attempt.
- `page_snapshots`: Content-addressed references to captured HTML/DOM states (e.g., mapping a SHA256 hash to S3/blob storage).
- `browser_profiles`: Isolated context setups for Playwright instances.

## 4. Threat Model (`docs/threat-model.md`)
A comprehensive threat model covering:
- **SSRF**: Server-Side Request Forgery mitigated via the Egress Firewall (URL Validator).
- **Recipe Injection**: Sandboxing and strict validation for dynamic scrape recipes.
- **Credential Leakage**: Handled via Secret Redactor.
- **LLM Prompt Injection**: Input sanitization when feeding DOM chunks to LLM models.
- **AGPL Boundary**: Clear separation of proprietary vs. open-source components.
- **DNS Rebinding**: Prevented by the DNS Guard verifying IPs post-resolution.

## 5. CI / ChangeGuard Integration
Update `.changeguard/config.toml` to enforce security and quality steps in `verify.steps`:
- `pnpm audit --audit-level high`
- `biome check --write=false .`
- `pnpm -r run typecheck`
- `pnpm -r run test`

## 6. Docker Image Pinning
`docker-compose.yml` must update references for `firecrawl` and `playwright-service` (and optionally `nuq-postgres`) to use explicit SHA256 digests instead of `latest` or semantic version tags, ensuring immutable builds.

## 7. Development Guidelines
- Follow **Test-Driven Development (TDD)** for all security modules.
- Use **neverthrow** for all error handling, avoiding thrown exceptions in business logic.
- Use **Zod 4** for strict runtime validations of all inputs and environment variables.
- **Content-Addressing** must be used where applicable to prevent duplication and ensure integrity.