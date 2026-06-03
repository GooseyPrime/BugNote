export function getRows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  return r.rows ?? [];
}

export function getFirstRow<T>(result: unknown): T | undefined {
  return getRows<T>(result)[0];
}
