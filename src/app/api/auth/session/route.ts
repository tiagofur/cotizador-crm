import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/server/auth';
import { getSettings } from '@/lib/server/queries';

/** Sesión actual. needsBootstrap=true cuando aún no existe ningún usuario (primer arranque). */
export async function GET(req: NextRequest) {
  const [user, usersCount] = await Promise.all([getAuthUser(req), db.user.count().catch(() => 0)]);
  let companyName: string | null = null;
  try {
    companyName = (await getSettings()).companyName ?? null;
  } catch {
    // La BD aún sin inicializar no debe romper la pantalla de login
  }
  return NextResponse.json({ user, needsBootstrap: usersCount === 0, companyName });
}
