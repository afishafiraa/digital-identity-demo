export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Database results are runtime boundaries, even for queries over our own schema.
export function integerColumn(row: unknown, column: string): number {
  if (!isRecord(row)) throw new Error('Invalid database row');
  const value = row[column];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid database integer');
  }
  return value;
}
