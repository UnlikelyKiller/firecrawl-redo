import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dns from 'dns/promises';
import { EgressPolicy } from '../egress-policy';

vi.mock('dns/promises', () => ({
  resolve4: vi.fn(),
}));

const mockedResolve4 = vi.mocked(dns.resolve4);

describe('EgressPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows the configured Multilogin bridge through both URL and DNS checks', async () => {
    mockedResolve4.mockResolvedValue(['127.0.0.1']);

    const result = await EgressPolicy.validate('http://host.docker.internal:19000/session', {
      allowedMultiloginBridgeOrigin: 'http://host.docker.internal:19000',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ip).toBe('127.0.0.1');
      expect(result.value.url.origin).toBe('http://host.docker.internal:19000');
    }
  });

  it('still blocks unresolved private destinations when no Multilogin exception is configured', async () => {
    mockedResolve4.mockResolvedValue(['127.0.0.1']);

    const result = await EgressPolicy.validate('http://host.docker.internal:19000/session');
    expect(result.isErr()).toBe(true);
  });
});
