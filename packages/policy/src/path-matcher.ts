export function matchGlob(pattern: string, path: string): boolean {
  if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
    return pattern === path;
  }

  const regexStr = globToRegex(pattern);
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

function globToRegex(pattern: string): string {
  let result = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      const nextChar = pattern[i + 1];
      if (nextChar === '*') {
        const charAfter = pattern[i + 2];
        if (charAfter === '/') {
          result += '(?:.+/)?';
          i += 3;
        } else {
          if (result.endsWith('/')) {
            result = result.slice(0, -1) + '(?:/.*)?';
          } else {
            result += '.*';
          }
          i += 2;
        }
      } else {
        result += '[^/]*';
        i += 1;
      }
    } else if (char === '?') {
      result += '[^/]';
      i += 1;
    } else if (char === '[') {
      const closingBracket = pattern.indexOf(']', i);
      if (closingBracket === -1) {
        result += '\\[';
        i += 1;
      } else {
        result += pattern.slice(i, closingBracket + 1);
        i = closingBracket + 1;
      }
    } else if (char !== undefined && '.+^${}()|'.includes(char)) {
      result += `\\${char}`;
      i += 1;
    } else if (char !== undefined) {
      result += char;
      i += 1;
    }
  }

  return result;
}

export function isPathBlocked(
  path: string,
  blockedPaths: ReadonlyArray<string>,
  allowedPaths: ReadonlyArray<string>,
): { blocked: boolean; reason: string } {
  const matchesAllowed = allowedPaths.some(p => matchGlob(p, path));
  if (matchesAllowed) {
    return { blocked: false, reason: 'path_matches_allowlist' };
  }

  const matchedBlock = blockedPaths.find(p => matchGlob(p, path));
  if (matchedBlock) {
    return { blocked: true, reason: `path_matches_blocklist:${matchedBlock}` };
  }

  return { blocked: false, reason: 'no_matching_rules' };
}