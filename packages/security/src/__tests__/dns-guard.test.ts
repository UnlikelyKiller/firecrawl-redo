import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DNSGuard, DNSGuardError } from '../dns-guard';

// Mock dns/promises to avoid actual DNS lookups
vi.mock('dns/promises', () => ({
  resolve4: vi.fn(),
}));

import * as dns from 'dns/promises';

const mockedResolve4 = vi.mocked(dns.resolve4);

describe('DNSGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateResolved - DNS resolution to public IPs is allowed', () => {
    it('returns ok with the resolved public IP', async () => {
      mockedResolve4.mockResolvedValue(['93.184.216.34']);

      const url = new URL('https://example.com');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('93.184.216.34');
      }
    });

    it('returns the first address when multiple are resolved', async () => {
      mockedResolve4.mockResolvedValue(['93.184.216.34', '93.184.216.35']);

      const url = new URL('https://example.com');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('93.184.216.34');
      }
    });
  });

  describe('validateResolved - DNS resolution to private IPs is blocked', () => {
    const privateIpCases: readonly [string[], string][] = [
      [['127.0.0.1'], 'loopback'],
      [['10.0.0.1'], '10.x Class A'],
      [['172.16.0.1'], '172.16.x Class B'],
      [['192.168.1.1'], '192.168.x Class C'],
      [['169.254.169.254'], 'cloud metadata'],
    ] as const;

    for (const [ips, description] of privateIpCases) {
      it(`blocks DNS resolution to private IP ${ips[0]} (${description})`, async () => {
        mockedResolve4.mockResolvedValue(ips as unknown as string[]);

        const url = new URL('https://attacker.example.com');
        const result = await DNSGuard.validateResolved(url);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(DNSGuardError);
          expect(result.error.message).toContain('private IP');
        }
      });
    }

    it('blocks when first resolved IP is private even if second is public', async () => {
      mockedResolve4.mockResolvedValue(['127.0.0.1', '93.184.216.34']);

      const url = new URL('https://attacker.example.com');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('private IP');
      }
    });
  });

  describe('validateResolved - DNS resolution failures', () => {
    it('returns error when DNS resolution fails', async () => {
      mockedResolve4.mockRejectedValue(new Error('ENOTFOUND'));

      const url = new URL('https://nonexistent.example.com');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(DNSGuardError);
        expect(result.error.message).toContain('DNS resolution failed');
      }
    });

    it('returns error when no A records found', async () => {
      mockedResolve4.mockResolvedValue([]);

      const url = new URL('https://empty.example.com');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(DNSGuardError);
        expect(result.error.message).toContain('No A records');
      }
    });
  });

  describe('validateResolved - hostname that is already a private IP', () => {
    it('returns error immediately for a hostname that is a private IP', async () => {
      // URL constructor will parse IP as hostname
      const url = new URL('http://127.0.0.1/path');
      const result = await DNSGuard.validateResolved(url);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(DNSGuardError);
        expect(result.error.message).toContain('private IP');
      }
      // Should not call DNS at all for IP hostnames
      expect(mockedResolve4).not.toHaveBeenCalled();
    });

    it('allows the configured Multilogin bridge origin to remain reachable', async () => {
      mockedResolve4.mockResolvedValue(['127.0.0.1']);

      const url = new URL('http://host.docker.internal:19000/session');
      const result = await DNSGuard.validateResolved(url, {
        allowedMultiloginBridgeOrigin: 'http://host.docker.internal:19000',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('127.0.0.1');
      }
    });

    it('allows direct Multilogin CDP destinations when explicitly enabled', async () => {
      const url = new URL('http://127.0.0.1:9222/json/version');
      const result = await DNSGuard.validateResolved(url, {
        allowDirectMultiloginCdp: true,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe('127.0.0.1');
      }
      expect(mockedResolve4).not.toHaveBeenCalled();
    });
  });
});
