import { URL } from "node:url";

export function joinProxyPath(baseUrl: string, suffix: string, search = ""): string {
  const target = new URL(baseUrl);
  const normalizedBasePath = target.pathname.endsWith("/")
    ? target.pathname.slice(0, -1)
    : target.pathname;
  const normalizedSuffix = suffix.length === 0
    ? ""
    : suffix.startsWith("/")
      ? suffix
      : `/${suffix}`;
  target.pathname = `${normalizedBasePath}${normalizedSuffix}`;
  target.search = search;
  return target.toString();
}

export function filterProxyHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const blocked = new Set([
    "connection",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (blocked.has(key.toLowerCase()) || value === undefined) {
      continue;
    }
    result[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  return result;
}
