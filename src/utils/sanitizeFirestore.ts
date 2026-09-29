/**
 * Purple Bean Gaming — Firestore Payload Sanitization Utility
 *
 * Recursively removes all `undefined` values from Firestore payloads while
 * strictly preserving:
 * - false (booleans)
 * - 0 (numbers)
 * - empty arrays []
 * - valid empty strings ""
 * - null values intentionally used by schema
 * - Date and RegExp instances
 *
 * Never send `undefined` to Firestore.
 */

export function removeUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle arrays: filter out undefined items and sanitize nested items
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? removeUndefinedDeep(item) : item)) as unknown as T;
  }

  // Handle objects: recursively sanitize keys, removing any key whose value is undefined
  if (typeof value === 'object') {
    // Preserve instances of Date, RegExp, etc.
    if (value instanceof Date || value instanceof RegExp) {
      return value;
    }

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        if (typeof v === 'object' && v !== null) {
          sanitized[k] = removeUndefinedDeep(v);
        } else {
          sanitized[k] = v;
        }
      }
    }
    return sanitized as T;
  }

  return value;
}

export function sanitizeFirestorePayload<T extends Record<string, any>>(payload: T): T {
  return removeUndefinedDeep(payload);
}
