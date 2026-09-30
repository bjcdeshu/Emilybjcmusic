import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthSession } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { isLoopbackHost } from "./config.js";
import { AppError } from "./errors.js";
import { Store } from "./store.js";

const hash = (input: string) => createHash("sha256").update(input).digest("hex");
export class OwnerAuth {
  readonly configured: boolean;
  private readonly salt = randomBytes(32);
  private readonly digest: Buffer;
  private readonly ownerHash: string;
  readonly cookieName: string;
  constructor(private readonly config: AppConfig, private readonly store: Store, private readonly clock: () => number) {
    this.configured = !!config.ownerPassword;
    this.digest = scryptSync(config.ownerPassword || randomBytes(32).toString("hex"), this.salt, 32);
    this.ownerHash = scryptSync(config.ownerPassword || "unconfigured", "emily-owner-fingerprint-v1", 32).toString("hex");
    this.cookieName = config.publicOrigin?.startsWith("https:") ? "__Host-emily_session" : "emily_session";
  }
  private token(request: FastifyRequest): string | undefined {
    const cookie = request.headers.cookie;
    if (!cookie || cookie.length > 4096) return undefined;
    const matches = cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(`${this.cookieName}=`));
    if (matches.length !== 1) return undefined;
    const token = matches[0]!.slice(this.cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  }
  sessionHash(request: FastifyRequest): string | undefined {
    const token = this.token(request);
    if (!this.configured || !token) return undefined;
    const sessionHash = hash(token);
    return this.store.validSession(sessionHash, this.ownerHash, this.clock()) ? sessionHash : undefined;
  }
  require(request: FastifyRequest): string {
    if (!this.configured) throw new AppError(503, "OWNER_AUTH_UNCONFIGURED", "Owner access is not configured. Set the application owner password.");
    const session = this.sessionHash(request);
    if (!session) throw new AppError(401, "AUTH_REQUIRED", "Sign in to your personal radio.");
    return session;
  }
  session(request: FastifyRequest): AuthSession { return { configured: this.configured, authenticated: !!this.sessionHash(request) }; }
  /** No wildcard CORS or forwarded-host trust. Missing Origin requires same-origin Fetch Metadata. */
  checkOrigin(request: FastifyRequest): void {
    const site = request.headers["sec-fetch-site"];
    if (site === "cross-site") throw new AppError(403, "ORIGIN_DENIED", "Cross-site requests are not permitted.");
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const origin = request.headers.origin;
    if (typeof origin === "string") {
      let valid = false;
      try {
        const u = new URL(origin);
        if (u.origin !== origin || u.username || u.password) throw new Error();
        if (this.config.publicOrigin) valid = origin === this.config.publicOrigin;
        else {
          const host = new URL(`http://${request.headers.host || "invalid"}`);
          valid = isLoopbackHost(host.hostname) && isLoopbackHost(u.hostname) && u.protocol === "http:" && u.host === host.host;
        }
      } catch { valid = false; }
      if (!valid) throw new AppError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
    } else if (mutation && site !== "same-origin") {
      throw new AppError(403, "ORIGIN_REQUIRED", "Send a same-origin request with an Origin header.");
    }
  }
  login(password: string, request: FastifyRequest, reply: FastifyReply): AuthSession {
    if (!this.configured) throw new AppError(503, "OWNER_AUTH_UNCONFIGURED", "Owner access is not configured. Set the application owner password.");
    const now = this.clock();
    const ipKey = hash(request.ip);
    if (!this.store.takeRate("login-global", 40, 900_000, now) || !this.store.takeRate(`login-ip:${ipKey}`, 8, 900_000, now)) {
      reply.header("Retry-After", "900");
      throw new AppError(429, "LOGIN_RATE_LIMITED", "Too many sign-in attempts. Please wait before trying again.");
    }
    const candidate = scryptSync(password, this.salt, 32);
    if (!timingSafeEqual(this.digest, candidate)) throw new AppError(401, "INVALID_PASSWORD", "Owner password is incorrect.");
    const oldToken = this.token(request);
    if (oldToken) this.store.deleteSession(hash(oldToken));
    const token = randomBytes(32).toString("hex");
    this.store.putSession(hash(token), this.ownerHash, now + this.config.sessionTtlMs, now);
    reply.header("Set-Cookie", this.cookie(token, Math.floor(this.config.sessionTtlMs / 1000)));
    return { configured: true, authenticated: true };
  }
  logout(request: FastifyRequest, reply: FastifyReply): AuthSession {
    const token = this.token(request);
    if (token) this.store.deleteSession(hash(token));
    reply.header("Set-Cookie", this.cookie("", 0));
    return { configured: this.configured, authenticated: false };
  }
  private cookie(token: string, maxAge: number): string {
    return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.cookieName.startsWith("__Host-") ? "; Secure" : ""}`;
  }
}
