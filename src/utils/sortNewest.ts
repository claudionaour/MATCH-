export function getTimestampMillis(value: unknown): number {
  if (!value) {
    // Pending local serverTimestamp() during optimistic snapshot — sort as newest
    return Date.now() + 5000;
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTs = value as {toMillis?: () => number; seconds?: number};
    if (typeof maybeTs.toMillis === 'function') {
      return maybeTs.toMillis();
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function sortByCreatedDesc<T extends {createdAt?: unknown}>(items: T[]): T[] {
  return [...items].sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
}
