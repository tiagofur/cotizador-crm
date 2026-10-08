import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, findUserByIdentifier, setSessionCookie, verifyPassword } from '@/lib/server/auth';
import type { SessionUserDTO, UserRole } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? '').trim();
    const password = String(body.password ?? '');
    if (!identifier || !password) {
      return NextResponse.json({ error: 'Escribe tu usuario y contraseña' }, { status: 400 });
    }
    const user = await findUserByIdentifier(identifier);
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }
    const dto: SessionUserDTO = {
      id: user.id,
      name: user.name,
      role: user.role as UserRole,
      email: user.email,
      phone: user.phone,
      clientId: user.clientId,
    };
    const res = NextResponse.json({ user: dto });
    setSessionCookie(res, createSessionToken({ id: user.id, role: user.role as UserRole }));
    return res;
  } catch {
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 400 });
  }
}
