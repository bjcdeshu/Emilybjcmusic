import type { ApiFailure } from "@emily/shared";

/** All messages in this class are public, authored constants, never provider errors. */
export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
  }
}
export const fail = (error: AppError): ApiFailure => ({ ok: false, error: { code: error.code, message: error.message } });
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function safeText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, max) : "";
}
export const MUSIC_ID = /^[1-9]\d{0,17}$/;
export function musicId(value: unknown): string | undefined {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  return typeof id === "string" && MUSIC_ID.test(id) ? id : undefined;
}
