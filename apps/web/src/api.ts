import type { ApiResponse } from "@emily/shared";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "NETWORK_ERROR", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Private API data stays in memory; cookies are owned by the server. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new ApiError("无效的 API 地址。", "INVALID_PATH");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 45_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal;
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers }
    });
    if (response.status === 401 && path !== "/api/login") {
      window.dispatchEvent(new Event("emily:session-expired"));
    }
    let payload: ApiResponse<T>;
    try {
      payload = await response.json() as ApiResponse<T>;
    } catch {
      throw new ApiError("服务返回了无法读取的响应，请稍后重试。", "INVALID_RESPONSE", response.status);
    }
    if (!payload || typeof payload.ok !== "boolean") {
      throw new ApiError("服务响应与 Emily 接口不匹配。", "INVALID_RESPONSE", response.status);
    }
    if (!payload.ok) {
      throw new ApiError(payload.error?.message || "请求未完成。", payload.error?.code || "API_ERROR", response.status);
    }
    if (!response.ok) throw new ApiError("服务暂时不可用，请稍后重试。", "HTTP_ERROR", response.status);
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (init.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (timeout.signal.aborted) throw new ApiError("请求超时。节目准备可能需要一些时间，请重试。", "TIMEOUT");
    throw new ApiError("无法连接 Emily 服务。请检查网络或服务配置。", "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export function post<T>(path: string, body?: unknown, signal?: AbortSignal) {
  return api<T>(path, { method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...(signal ? { signal } : {}) });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作未完成，请重试。";
}

/** No javascript/file URLs, credentials in URLs, or private external referrers. */
export function safeUrl(value?: string, allowImageData = false): string | undefined {
  if (!value) return undefined;
  if (allowImageData && /^data:image\/(?:png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value, window.location.origin);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    if (window.location.protocol === "https:" && url.protocol === "http:") return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
