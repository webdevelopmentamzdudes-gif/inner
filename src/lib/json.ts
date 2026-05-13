import type { Prisma } from "@prisma/client";

// Helpers for JSON columns (native MySQL JSON via Prisma `Json`).
// parseJson normalizes driver output (object vs string). toJson produces values
// safe to assign to Prisma Json fields.

export function parseJson<T = unknown>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function toJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}
