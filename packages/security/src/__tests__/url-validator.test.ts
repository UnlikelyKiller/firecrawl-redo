import { describe, it, expect } from 'vitest';
import { URLValidator, URLValidationError } from '../url-validator';

describe('URLValidator', () => {
  describe('validate - valid public URLs', () => {
    it('accepts a valid https URL', () => {
      const result = URLValidator.validate('https://example.com/page');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.hostname).toBe('example.com');
        expect(result.value.protocol).toBe('https:');
      }
    });

    it('accepts a valid http URL', () => {
      const result = URLValidator.validate('http://example.com');
      expect(result.isOk()).toBe(true);
    });

    it('accepts a URL with a port', () => {
      const result = URLValidator.validate('https://example.com:8443/path');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.port).toBe('8443');
      }
    });

    it('accepts a URL with query parameters and fragment', () => {
      const result = URLValidator.validate('https://example.com/path?q=1#section');
      expect(result.isOk()).toBe(true);
    });

    it('accepts a public IP address', () => {
      const result = URLValidator.validate('https://8.8.8.8');
      expect(result.isOk()).toBe(true);
    });
  });

  describe('validate - private IPs are blocked', () => {
    const privateIpCases: readonly [string, string][] = [
      ['127.0.0.1', 'loopback'],
      ['10.0.0.1', '10.x Class A private'],
      ['10.255.255.255', '10.x max range'],
      ['172.16.0.1', '172.16.x Class B private'],
      ['172.31.255.255', '172.31.x max range'],
      ['192.168.0.1', '192.168.x Class C private'],
      ['192.168.1.100', '192.168.x typical home network'],
      ['169.254.100.1', '169.254.x link-local'],
    ] as const;

    for (const [ip, description] of privateIpCases) {
      it(`blocks private IP ${ip} (${description})`, () => {
        const result = URLValidator.validate(`http://${ip}/path`);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(URLValidationError);
          expect(result.error.message).toContain('private IP');
        }
      });
    }
  });

  describe('validate - blocked hosts are rejected', () => {
    const blockedHostCases: readonly [string, string][] = [
      ['http://localhost/path', 'localhost'],
      ['https://host.docker.internal/api', 'host.docker.internal'],
      ['http://metadata.google.internal/computeMetadata/v1/', 'metadata.google.internal'],
    ] as const;

    for (const [url, hostname] of blockedHostCases) {
      it(`blocks host: ${hostname}`, () => {
        const result = URLValidator.validate(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(URLValidationError);
          expect(result.error.message).toContain('Blocked host');
        }
      });
    }
  });

  describe('validate - blocked schemes are rejected', () => {
    const blockedSchemeCases: readonly [string, string][] = [
      ['file:///etc/passwd', 'file:'],
      ['ftp://example.com/file', 'ftp:'],
      ['chrome://settings', 'chrome:'],
      ['devtools://devtools/bundled/inspector.html', 'devtools:'],
      ['data:text/html,<h1>Hello</h1>', 'data:'],
    ] as const;

    for (const [url, scheme] of blockedSchemeCases) {
      it(`blocks scheme: ${scheme}`, () => {
        const result = URLValidator.validate(url);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(URLValidationError);
          expect(result.error.message).toContain('Blocked protocol');
        }
      });
    }
  });

  describe('validate - cloud metadata IP is blocked', () => {
    it('blocks 169.254.169.254 (AWS/GCP metadata endpoint)', () => {
      const result = URLValidator.validate('http://169.254.169.254/latest/meta-data/');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(URLValidationError);
        // 169.254.169.254 is in both BLOCKED_HOSTS and isPrivateIP,
        // but BLOCKED_HOSTS is checked first, so the message mentions "Blocked host"
        expect(result.error.message).toMatch(/Blocked (host|private IP)/);
      }
    });
  });

  describe('validate - invalid URL format', () => {
    it('rejects an empty string', () => {
      const result = URLValidator.validate('');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(URLValidationError);
        expect(result.error.message).toContain('Invalid URL');
      }
    });

    it('rejects a string without a scheme', () => {
      const result = URLValidator.validate('just-a-string');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('isPrivateIP', () => {
    it('returns true for loopback addresses', () => {
      expect(URLValidator.isPrivateIP('127.0.0.1')).toBe(true);
      expect(URLValidator.isPrivateIP('127.0.0.99')).toBe(true);
    });

    it('returns true for 10.x.x.x', () => {
      expect(URLValidator.isPrivateIP('10.0.0.1')).toBe(true);
      expect(URLValidator.isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('returns true for 172.16.x.x through 172.31.x.x', () => {
      expect(URLValidator.isPrivateIP('172.16.0.1')).toBe(true);
      expect(URLValidator.isPrivateIP('172.31.255.255')).toBe(true);
    });

    it('returns false for 172.15.x.x and 172.32.x.x', () => {
      expect(URLValidator.isPrivateIP('172.15.0.1')).toBe(false);
      expect(URLValidator.isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('returns true for 192.168.x.x', () => {
      expect(URLValidator.isPrivateIP('192.168.0.1')).toBe(true);
      expect(URLValidator.isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('returns true for 169.254.x.x (link-local)', () => {
      expect(URLValidator.isPrivateIP('169.254.0.1')).toBe(true);
      expect(URLValidator.isPrivateIP('169.254.169.254')).toBe(true);
    });

    it('returns false for public IPs', () => {
      expect(URLValidator.isPrivateIP('8.8.8.8')).toBe(false);
      expect(URLValidator.isPrivateIP('1.1.1.1')).toBe(false);
      expect(URLValidator.isPrivateIP('203.0.113.5')).toBe(false);
    });

    it('returns false for non-IP hostnames', () => {
      expect(URLValidator.isPrivateIP('example.com')).toBe(false);
      expect(URLValidator.isPrivateIP('localhost')).toBe(false);
    });

    it('returns false for invalid octets', () => {
      expect(URLValidator.isPrivateIP('999.0.0.1')).toBe(false);
    });
  });
});