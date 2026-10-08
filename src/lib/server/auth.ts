/* ============================================================
 * Núcleo de autenticación (solo Node/Bun — no importar desde
 * middleware ni código de cliente).
 * - Contraseñas: scrypt de node:crypto (sin dependencias nativas)
 * - Sesión: cookie httpOnly firmada con HMAC-SHA256 (30 días)
 * - Secreto: env AUTH_SECRET o archivo .auth-secret en la raíz
 * ============================================================ */

import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { SessionUserDTO, UserRole } from '@/lib/types';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'nahu_session';
const SESSION_DAYS = 30;

/* ---------- Secreto de firma ---------- */

const globalForSecret = globalThis as unknown as { authSecret?: string };

export function getAuthSecret(): string {
  if (globalForSecret.authSecret) return globalForSecret.authSecret;
  let secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    const file = join(process.cwd(), '.auth-secret');
    try {
      secret = readFileSync(file, 'utf8').trim();
    } catch {
      secret = randomBytes(32).toString('hex');
      writeFileSync(file, secret, { mode: 0o600 });
    }
  }
  if (!secret) secret = 'insecure-dev-secret';
  globalForSecret.authSecret = secret;
  return secret;
}

/* ---------- Contraseñas ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/* ---------- Token de sesión (payload.payload_firmado) ---------- */

interface SessionPayload {
  uid: string;
  role: UserRole;
  exp: number; // epoch ms
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', getAuthSecret()).update(data).digest('base64url');
}

export function createSessionToken(user: { id: string; role: UserRole }): string {
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (!payload.uid || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Sesión actual ---------- */

export async function getAuthUser(req: NextRequest): Promise<SessionUserDTO | null> {
  const payload = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.uid } });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, role: user.role as UserRole, email: user.email, phone: user.phone, clientId: user.clientId };
}

/** Guarda para handlers: devuelve NextResponse con el error, o null si sigue. */
export async function requireRole(req: NextRequest, ...roles: UserRole[]): Promise<NextResponse | null> {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 });
  if (roles.length > 0 && !roles.includes(user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 });
  }
  return null;
}

/* ---------- Cookies ---------- */

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/* ---------- Login por email o teléfono ---------- */

/** Teléfono → solo dígitos. Si trae lada (+52 o 1), prueba también sin ella. */
export function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return [];
  const variants = [digits];
  if (digits.length === 12 && digits.startsWith('52')) variants.push(digits.slice(2));
  if (digits.length === 11 && digits.startsWith('1')) variants.push(digits.slice(1));
  return variants;
}

/** Busca al usuario por email (case-insensitive) o teléfono; null si no existe. */
export async function findUserByIdentifier(identifier: string) {
  const id = identifier.trim();
  if (id.includes('@')) {
    return db.user.findUnique({ where: { email: id.toLowerCase() } });
  }
  for (const phone of phoneVariants(id)) {
    const user = await db.user.findUnique({ where: { phone } });
    if (user) return user;
  }
  return null;
}
