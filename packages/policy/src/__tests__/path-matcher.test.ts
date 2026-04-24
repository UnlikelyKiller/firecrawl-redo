import { describe, it, expect } from 'vitest';
import { matchGlob, isPathBlocked } from '../path-matcher';

describe('matchGlob', () => {
  it('matches exact strings', () => {
    expect(matchGlob('/admin', '/admin')).toBe(true);
    expect(matchGlob('/admin', '/other')).toBe(false);
  });

  it('matches wildcard * against any segment', () => {
    expect(matchGlob('/api/*', '/api/users')).toBe(true);
    expect(matchGlob('/api/*', '/api/users/1')).toBe(false);
    expect(matchGlob('/*/settings', '/admin/settings')).toBe(true);
  });

  it('matches double star ** against nested paths', () => {
    expect(matchGlob('/docs/**', '/docs/a/b/c')).toBe(true);
    expect(matchGlob('/docs/**/edit', '/docs/a/b/edit')).toBe(true);
    expect(matchGlob('/docs/**', '/docs')).toBe(true);
  });

  it('matches character classes [abc]', () => {
    expect(matchGlob('/file.[abc]', '/file.a')).toBe(true);
    expect(matchGlob('/file.[abc]', '/file.d')).toBe(false);
  });

  it('matches character ranges [a-z]', () => {
    expect(matchGlob('/page/[a-z]', '/page/b')).toBe(true);
    expect(matchGlob('/page/[a-z]', '/page/Z')).toBe(false);
  });

  it('matches question mark ? against single character', () => {
    expect(matchGlob('/file?', '/file1')).toBe(true);
    expect(matchGlob('/file?', '/files')).toBe(true);
    expect(matchGlob('/file?', '/file12')).toBe(false);
  });

  it('handles mixed glob patterns', () => {
    expect(matchGlob('/api/v[0-9]/*', '/api/v1/users')).toBe(true);
    expect(matchGlob('/api/v[0-9]/*', '/api/vX/users')).toBe(false);
  });

  it('returns false for non-matching patterns', () => {
    expect(matchGlob('/admin/*', '/public/page')).toBe(false);
    expect(matchGlob('/admin', '/admin/dashboard')).toBe(false);
  });
});

describe('isPathBlocked', () => {
  it('allows paths that match no rules', () => {
    const result = isPathBlocked('/public/page', [], []);
    expect(result.blocked).toBe(false);
  });

  it('blocks paths matching blocked patterns', () => {
    const result = isPathBlocked('/admin/dashboard', ['/admin/*'], []);
    expect(result.blocked).toBe(true);
  });

  it('allows paths matching allowlist even if also blocked', () => {
    const result = isPathBlocked('/api/public/data', ['/api/*'], ['/api/public/*']);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe('path_matches_allowlist');
  });

  it('allows paths not matching any blocked pattern', () => {
    const result = isPathBlocked('/home', ['/admin/*', '/private/*'], []);
    expect(result.blocked).toBe(false);
  });

  it('blocks with reason containing the matching pattern', () => {
    const result = isPathBlocked('/admin/settings', ['/admin/*'], []);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('/admin/*');
  });

  it('prioritizes allowlist over blocklist', () => {
    const result = isPathBlocked('/admin/public', ['/admin/*'], ['/admin/public']);
    expect(result.blocked).toBe(false);
  });
});