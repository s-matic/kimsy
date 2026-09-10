function validHostname(hostname: string) {
  if (hostname.length > 253 || !hostname.includes(".")) return false;
  return hostname.split(".").every((label) => label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}

export function normalizeAllowedWebSource(value: string) {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return validHostname(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function allowedWebSourceErrors(sources: string[]) {
  const errors: string[] = [];
  const normalized = sources.map(normalizeAllowedWebSource);
  if (normalized.some((source) => !source)) errors.push("Every allowed web source must be a valid domain.");
  const valid = normalized.filter((source): source is string => Boolean(source));
  if (new Set(valid).size !== valid.length) errors.push("Allowed web sources cannot contain duplicate domains.");
  return errors;
}
