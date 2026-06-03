const RULES: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9._-]{20,}/g, "[jwt]"],
  [/\b(sk|pk|rk)-[A-Za-z0-9]{16,}/g, "[apikey]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[ghtoken]"],
  [
    /((?:authorization|api[_-]?key|token|secret|password)\s*[:=]\s*)("?)[^"'\s,}]{6,}/gi,
    "$1[redacted]",
  ],
];

export function scrubString(s: string): string {
  let out = s;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out.length > 2000 ? out.slice(0, 2000) + "…" : out;
}
