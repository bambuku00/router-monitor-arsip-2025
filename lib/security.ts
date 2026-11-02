import DOMPurify from "isomorphic-dompurify";

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input);
}

export function sanitizeObject<T extends object>(obj: T): T {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const sanitized = { ...obj } as Record<string, unknown>;
  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value as object);
    }
  }
  return sanitized as T;
}
