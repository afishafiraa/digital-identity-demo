import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Config } from './config.ts';
import { AppError } from './errors.ts';
import { integerColumn, isRecord } from './validation.ts';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export interface SessionView { expiresAt: string }
export interface OfferDecision { state: 'accepting' | 'accepted' | 'declined'; baseline: string[] }
export interface PresentationReference { reviewId: string; state: 'pending' | 'unavailable'; startedAt: number }
export interface SharingReference { reviewId: string; digest: string; state: 'reviewing' | 'approved' | 'cancelled' }
export interface VerificationReference { attemptId: string; walletId: string; credentialId: string; expiresAt: number; requestId: string | null; requestUrl: string | null }
export interface OfferReference { id: string; walletId: string; expiresAt: number }
export interface WalletBinding {
  storeId: string;
  phase: 'allocated' | 'creating' | 'ready';
  walletId: string | null;
}
function decodeBinding(value: unknown): WalletBinding {
  if (!isRecord(value)) throw new Error('Invalid wallet binding');
  const storeId = value['store_id'];
  const phase = value['phase'];
  const walletId = value['wallet_id'];
  if (typeof storeId !== 'string' || (walletId !== null && typeof walletId !== 'string')) throw new Error('Invalid wallet binding');
  if (phase !== 'allocated' && phase !== 'creating' && phase !== 'ready') throw new Error('Invalid provisioning state');
  return { storeId, phase, walletId };
}

export function cookieName(origin: string): string {
  return origin.startsWith('https:') ? '__Host-diw-session' : 'diw-session';
}
export function sessionCookie(token: string, config: Config, clear = false): string {
  return `${cookieName(config.origin)}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : config.sessionTtlSeconds}${config.origin.startsWith('https:') ? '; Secure' : ''}`;
}
export type SessionCookie =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'present'; token: string };

export function readSessionCookie(request: Request, config: Config): SessionCookie {
  const name = cookieName(config.origin);
  const values = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  if (values.length === 0) return { state: 'missing' };
  // Ambiguous duplicate cookies must not choose one identity arbitrarily.
  if (values.length !== 1) return { state: 'invalid' };
  const [value] = values;
  if (!value) return { state: 'invalid' };
  const token = value.slice(name.length + 1);
  return tokenPattern.test(token) ? { state: 'present', token } : { state: 'invalid' };
}

// Coordination metadata only. This store does not create a wallet or store credentials/keys.
export class SessionStore {
  private readonly db: DatabaseSync;
  private readonly config: Config;
  constructor(config: Config) {
    this.config = config;
    mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    if (!lstatSync(config.dataDir).isDirectory() || lstatSync(config.dataDir).isSymbolicLink()) throw new Error('Unsafe data directory');
    chmodSync(config.dataDir, 0o700);
    const path = join(config.dataDir, 'coordination.sqlite');
    try { if (lstatSync(path).isSymbolicLink()) throw new Error('Unsafe database path'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(`PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS wallet_bindings (
        session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash),
        store_id TEXT NOT NULL UNIQUE,
        phase TEXT NOT NULL CHECK(phase IN ('allocated', 'creating', 'ready')),
        wallet_id TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS offer_decisions (offer_id TEXT PRIMARY KEY, state TEXT NOT NULL, baseline TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS current_verifications (
        session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash), wallet_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL UNIQUE, credential_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
        request_id TEXT, request_url TEXT
      );
      CREATE TABLE IF NOT EXISTS presentations (
        attempt_id TEXT PRIMARY KEY, review_id TEXT NOT NULL, state TEXT NOT NULL, started_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sharing_reviews (
        attempt_id TEXT PRIMARY KEY, review_id TEXT NOT NULL UNIQUE, digest TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('reviewing', 'approved', 'cancelled'))
      );
      CREATE TABLE IF NOT EXISTS current_offers (
        session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash),
        wallet_id TEXT NOT NULL, offer_id TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL
      );`);
  }
  get(token: string | null, now = Date.now()): SessionView | null {
    if (!token || !tokenPattern.test(token)) return null;
    const row = this.db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?').get(digest(token), now);
    return row ? { expiresAt: new Date(integerColumn(row, 'expires_at')).toISOString() } : null;
  }
  start(token: string | null, now = Date.now()): { token: string; session: SessionView; created: boolean } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.get(token, now);
      if (existing && token) { this.db.exec('COMMIT'); return { token, session: existing, created: false }; }
      // Do not silently replace a stale identity with a fresh session on retry.
      if (token !== null) throw new AppError('SESSION_EXPIRED', 409);
      this.db.prepare('DELETE FROM sessions WHERE expires_at <= ? AND token_hash NOT IN (SELECT session_hash FROM wallet_bindings)').run(now);
      const row = this.db.prepare('SELECT count(*) AS count FROM sessions WHERE expires_at > ?').get(now);
      const count = integerColumn(row, 'count');
      if (count >= this.config.maxActiveSessions) throw new AppError('SESSION_LIMIT', 429);
      const next = randomBytes(32).toString('base64url');
      const expires = now + this.config.sessionTtlSeconds * 1000;
      this.db.prepare('INSERT INTO sessions(token_hash, expires_at) VALUES (?, ?)').run(digest(next), expires);
      this.db.exec('COMMIT');
      return { token: next, session: { expiresAt: new Date(expires).toISOString() }, created: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  revoke(token: string | null): void {
    if (token && tokenPattern.test(token) && this.db.prepare('SELECT 1 FROM wallet_bindings WHERE session_hash = ?').get(digest(token))) throw new AppError('RESET_UNAVAILABLE', 409);
    if (token && tokenPattern.test(token)) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
  }
  binding(token: string): WalletBinding | null {
    if (!this.get(token)) throw new AppError('SESSION_EXPIRED', 409);
    const row = this.db.prepare('SELECT store_id, phase, wallet_id FROM wallet_bindings WHERE session_hash = ?').get(digest(token));
    return row ? decodeBinding(row) : null;
  }
  allocateWallet(token: string): WalletBinding {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let binding = this.binding(token);
      if (!binding) {
        const storeId = `diw-${randomUUID()}`;
        this.db.prepare("INSERT INTO wallet_bindings(session_hash, store_id, phase) VALUES (?, ?, 'allocated')").run(digest(token), storeId);
        binding = { storeId, phase: 'allocated', walletId: null };
      }
      this.db.exec('COMMIT');
      return binding;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  claimWalletCreation(token: string): boolean {
    if (!this.get(token)) throw new AppError('SESSION_EXPIRED', 409);
    const result = this.db.prepare("UPDATE wallet_bindings SET phase = 'creating' WHERE session_hash = ? AND phase = 'allocated'").run(digest(token));
    return Number(result.changes) === 1;
  }
  completeWallet(token: string, walletId: string): void {
    if (!this.get(token)) throw new AppError('SESSION_EXPIRED', 409);
    const result = this.db.prepare("UPDATE wallet_bindings SET phase = 'ready', wallet_id = ? WHERE session_hash = ? AND phase = 'creating'").run(walletId, digest(token));
    if (Number(result.changes) !== 1) {
      const current = this.binding(token);
      if (current?.phase !== 'ready' || current.walletId !== walletId) throw new Error('Invalid wallet provisioning transition');
    }
  }
  offer(token: string): OfferReference | null {
    const binding = this.binding(token);
    if (binding?.phase !== 'ready' || !binding.walletId) throw new AppError('FORBIDDEN', 403);
    const row = this.db.prepare('SELECT wallet_id, offer_id, expires_at FROM current_offers WHERE session_hash = ?').get(digest(token));
    if (!row) return null;
    if (!isRecord(row) || typeof row['offer_id'] !== 'string' || typeof row['wallet_id'] !== 'string') throw new Error('Invalid offer reference');
    if (row['wallet_id'] !== binding.walletId) return null;
    return { id: row['offer_id'], walletId: row['wallet_id'], expiresAt: integerColumn(row, 'expires_at') };
  }
  reserveOffer(token: string, now = Date.now()): { reference: OfferReference; created: boolean } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.offer(token);
      if (existing && (this.decision(token)?.state === 'accepting' || (existing.expiresAt > now && !this.decision(token)))) {
        this.db.exec('COMMIT');
        return { reference: existing, created: false };
      }
      const binding = this.binding(token);
      if (!binding?.walletId) throw new AppError('FORBIDDEN', 403);
      const reference = { id: randomUUID(), walletId: binding.walletId, expiresAt: now + 300000 };
      this.db.prepare(`INSERT INTO current_offers(session_hash, wallet_id, offer_id, expires_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(session_hash) DO UPDATE SET wallet_id=excluded.wallet_id, offer_id=excluded.offer_id, expires_at=excluded.expires_at`)
        .run(digest(token), reference.walletId, reference.id, reference.expiresAt);
      this.db.exec('COMMIT');
      return { reference, created: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  decision(token: string): OfferDecision | null {
    const offer = this.offer(token);
    if (!offer) return null;
    const row = this.db.prepare('SELECT state, baseline FROM offer_decisions WHERE offer_id = ?').get(offer.id);
    if (!row) return null;
    if (!isRecord(row)) throw new Error('Invalid decision');
    const state = row['state'];
    if (state !== 'accepting' && state !== 'accepted' && state !== 'declined') throw new Error('Invalid decision state');
    if (typeof row['baseline'] !== 'string') throw new Error('Invalid baseline');
    const baseline: unknown = JSON.parse(row['baseline']);
    if (!Array.isArray(baseline) || !baseline.every((id: unknown) => typeof id === 'string')) throw new Error('Invalid baseline');
    return { state, baseline: baseline.map((id: unknown) => { if (typeof id !== 'string') throw new Error('Invalid ID'); return id; }) };
  }
  decide(token: string, id: string, state: 'accepting' | 'declined', baseline: string[] = []): boolean {
    const offer = this.offer(token);
    if (offer?.id !== id || offer.expiresAt <= Date.now()) throw new AppError('OFFER_EXPIRED', 409);
    return Number(this.db.prepare('INSERT OR IGNORE INTO offer_decisions(offer_id, state, baseline) VALUES (?, ?, ?)')
      .run(id, state, JSON.stringify(baseline)).changes) === 1;
  }
  confirmReceipt(token: string, id: string): void {
    if (this.offer(token)?.id !== id) throw new AppError('OFFER_EXPIRED', 409);
    this.db.prepare("UPDATE offer_decisions SET state = 'accepted' WHERE offer_id = ? AND state = 'accepting'").run(id);
  }
  expireOffer(token: string, id: string): void {
    if (this.offer(token)?.id !== id) throw new AppError('OFFER_EXPIRED', 409);
    this.db.prepare('UPDATE current_offers SET expires_at = 0 WHERE session_hash = ? AND offer_id = ?').run(digest(token), id);
  }
  verification(token: string): VerificationReference | null {
    const binding = this.binding(token);
    if (binding?.phase !== 'ready' || !binding.walletId) throw new AppError('FORBIDDEN', 403);
    const row = this.db.prepare('SELECT * FROM current_verifications WHERE session_hash = ?').get(digest(token));
    if (!row) return null;
    if (!isRecord(row) || typeof row['wallet_id'] !== 'string' || typeof row['attempt_id'] !== 'string' || typeof row['credential_id'] !== 'string' ||
        (row['request_id'] !== null && typeof row['request_id'] !== 'string') || (row['request_url'] !== null && typeof row['request_url'] !== 'string')) throw new Error('Invalid verification reference');
    if (row['wallet_id'] !== binding.walletId) return null;
    return { attemptId: row['attempt_id'], walletId: row['wallet_id'], credentialId: row['credential_id'], expiresAt: integerColumn(row, 'expires_at'), requestId: row['request_id'], requestUrl: row['request_url'] };
  }
  reserveVerification(token: string, credentialId: string, now = Date.now()): { reference: VerificationReference; created: boolean } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.verification(token);
      if (existing && existing.expiresAt > now) { this.db.exec('COMMIT'); return { reference: existing, created: false }; }
      const binding = this.binding(token);
      if (!binding?.walletId) throw new AppError('FORBIDDEN', 403);
      const reference = { attemptId: randomUUID(), walletId: binding.walletId, credentialId, expiresAt: now + 30000, requestId: null, requestUrl: null };
      this.db.prepare(`INSERT INTO current_verifications(session_hash, wallet_id, attempt_id, credential_id, expires_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_hash) DO UPDATE SET wallet_id=excluded.wallet_id, attempt_id=excluded.attempt_id, credential_id=excluded.credential_id, expires_at=excluded.expires_at, request_id=NULL, request_url=NULL`)
        .run(digest(token), reference.walletId, reference.attemptId, credentialId, reference.expiresAt);
      this.db.exec('COMMIT');
      return { reference, created: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  completeVerification(token: string, attemptId: string, requestId: string, requestUrl: string): void {
    const current = this.verification(token);
    if (current?.attemptId !== attemptId || current.expiresAt <= Date.now() || current.requestId !== null) throw new AppError('VERIFICATION_EXPIRED', 409);
    this.db.prepare('UPDATE current_verifications SET request_id=?, request_url=?, expires_at=? WHERE session_hash=? AND attempt_id=?')
      .run(requestId, requestUrl, Date.now() + 300000, digest(token), attemptId);
  }
  expireVerification(token: string, attemptId: string): void {
    if (this.verification(token)?.attemptId !== attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
    this.db.prepare('UPDATE current_verifications SET expires_at=0 WHERE session_hash=? AND attempt_id=?').run(digest(token), attemptId);
  }
  sharing(token: string): SharingReference | null {
    const current = this.verification(token);
    if (!current) return null;
    const row = this.db.prepare('SELECT review_id, digest, state FROM sharing_reviews WHERE attempt_id=?').get(current.attemptId);
    if (!row) return null;
    if (!isRecord(row) || typeof row['review_id'] !== 'string' || typeof row['digest'] !== 'string' || (row['state'] !== 'reviewing' && row['state'] !== 'approved' && row['state'] !== 'cancelled')) throw new Error('Invalid sharing review');
    return { reviewId: row['review_id'], digest: row['digest'], state: row['state'] };
  }
  reviewSharing(token: string, attemptId: string, digest: string): SharingReference {
    const current = this.verification(token);
    if (current?.attemptId !== attemptId || !current.requestId || current.expiresAt <= Date.now()) throw new AppError('VERIFICATION_EXPIRED', 409);
    this.db.prepare(`INSERT INTO sharing_reviews(attempt_id, review_id, digest, state) VALUES (?, ?, ?, 'reviewing')
      ON CONFLICT(attempt_id) DO UPDATE SET review_id=excluded.review_id, digest=excluded.digest, state='reviewing' WHERE sharing_reviews.digest != excluded.digest OR sharing_reviews.state='cancelled'`)
      .run(attemptId, randomUUID(), digest);
    const reference = this.sharing(token);
    if (!reference) throw new Error('Missing sharing review');
    return reference;
  }
  decideSharing(token: string, attemptId: string, reviewId: string, digest: string, state: 'approved' | 'cancelled'): void {
    const current = this.verification(token);
    const review = this.sharing(token);
    if (current?.attemptId !== attemptId || current.expiresAt <= Date.now() || review?.reviewId !== reviewId || review.digest !== digest || review.state === 'cancelled') throw new AppError('VERIFICATION_EXPIRED', 409);
    this.db.prepare("UPDATE sharing_reviews SET state=? WHERE attempt_id=? AND review_id=? AND digest=? AND state='reviewing'").run(state, attemptId, reviewId, digest);
  }
  presentation(token: string): PresentationReference | null {
    const current = this.verification(token);
    if (!current) return null;
    const row = this.db.prepare('SELECT review_id, state, started_at FROM presentations WHERE attempt_id=?').get(current.attemptId);
    if (!row) return null;
    if (!isRecord(row) || typeof row['review_id'] !== 'string' || (row['state'] !== 'pending' && row['state'] !== 'unavailable')) throw new Error('Invalid presentation reference');
    return { reviewId: row['review_id'], state: row['state'], startedAt: integerColumn(row, 'started_at') };
  }
  claimPresentation(token: string, attemptId: string, reviewId: string, digest: string): boolean {
    const current = this.verification(token); const review = this.sharing(token);
    if (current?.attemptId !== attemptId || current.expiresAt <= Date.now() || review?.reviewId !== reviewId || review.state !== 'approved' || review.digest !== digest) throw new AppError('VERIFICATION_EXPIRED', 409);
    return Number(this.db.prepare("INSERT OR IGNORE INTO presentations(attempt_id, review_id, state, started_at) VALUES (?, ?, 'pending', ?)").run(attemptId, reviewId, Date.now()).changes) === 1;
  }
  presentationUnavailable(token: string, attemptId: string): void {
    if (this.verification(token)?.attemptId !== attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
    this.db.prepare("UPDATE presentations SET state='unavailable' WHERE attempt_id=?").run(attemptId);
  }
  close(): void { this.db.close(); }
}
