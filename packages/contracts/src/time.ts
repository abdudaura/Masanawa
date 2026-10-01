declare const instantBrand: unique symbol;

export type Instant = string & { readonly [instantBrand]: "Instant" };

export function toInstant(value: Date | string): Instant {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("Invalid instant");
  }
  return date.toISOString() as Instant;
}

export function nowInstant(): Instant {
  return toInstant(new Date());
}

export function compareInstants(left: Instant, right: Instant): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
