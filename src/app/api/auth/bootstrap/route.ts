import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSessionToken, hashPassword, setSessionCookie } from '@/lib/server/auth';
import type { SessionUserDTO, UserRole } from '@/lib/types';

/** Primer arranque: crea al ADMIN inicial. Solo funciona mientras no exista ningún usuario. */
export async function POST(req: NextRequest) {
  try {
    if ((await db.user.count()) > 0) {
      return NextResponse.json({ error: 'La configuración inicial ya fue realizada' }, { status: 403 });
    }
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!name) return NextResponse.json({ error: 'Escribe tu nombre' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Escribe un correo válido' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña necesita al menos 6 caracteres' }, { status: 400 });
    }
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: 'ADMIN' },
    });
    const dto: SessionUserDTO = {
      id: user.id,
      name: user.name,
      role: 'ADMIN',
      email: user.email,
      phone: user.phone,
      clientId: user.clientId,
    };
    const res = NextResponse.json({ user: dto });
    setSessionCookie(res, createSessionToken({ id: user.id, role: user.role as UserRole }));
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Ese correo ya está registrado' : 'Error al crear el usuario administrador';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
