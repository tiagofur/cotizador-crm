import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pragmasConfigured?: boolean
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Optimizar SQLite con WAL mode para máxima confiabilidad y cero corrupción
if (!globalForPrisma.pragmasConfigured) {
  globalForPrisma.pragmasConfigured = true;
  void db.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
  void db.$queryRawUnsafe('PRAGMA synchronous = NORMAL;').catch(() => {});
  void db.$queryRawUnsafe('PRAGMA foreign_keys = ON;').catch(() => {});
}