# CrawlX Threat Model

## Server-Side Request Forgery (SSRF)
SSRF is mitigated via the Egress Firewall (URL Validator). It blocks requests to private IPs (RFC 1918), loopback, link-local, and cloud metadata endpoints. Only `http` and `https` protocols are allowed.

## Recipe Injection
Dynamic scrape recipes are strictly sandboxed. Only allowlisted actions are permitted (`goto`, `click`, `fill`, etc.). `page.evaluate()` with arbitrary code is completely blocked.

## Credential Leakage
The `SecretRedactor` automatically scrubs common credential patterns (API keys, passwords, JWT tokens) from logs, artifacts, and outputs before they are stored.

## LLM Prompt Injection
DOM chunks and extracted text fed to LLM models are sanitized. System prompts are strictly separated from user content to prevent adversarial prompt injection from crawled pages.

## AGPL Boundary
CrawlX wraps Firecrawl OSS via Docker APIs. We do not fork or modify Firecrawl's core codebase, thereby maintaining a clear boundary and compliance with AGPL-3.0.

## DNS Rebinding
The `DNSGuard` prevents DNS rebinding attacks by verifying the resolved IP addresses *after* DNS resolution to ensure they do not fall within restricted ranges.
