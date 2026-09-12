/* Backfill: crear perfiles BLANCO/MADERADO y marcar frentes (piezas en material maderado/VESTO) */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const settings = await db.settings.findUnique({ where: { id: 'default' }, include: { maderadoMaterial: true } });
  const maderado = settings?.maderadoMaterial ?? (await db.material.findFirst({ where: { isMaderado: true } }));
  console.log('Material maderado:', maderado?.name ?? 'NO ENCONTRADO');

  // Perfil BLANCO: cada pieza usa su material del despiece
  await db.finishProfile.upsert({
    where: { id: 'BLANCO' },
    update: { usePieceMaterials: true, active: true, order: 0 },
    create: { id: 'BLANCO', name: 'Blanco', usePieceMaterials: true, active: true, order: 0 },
  });
  // Perfil MADERADO: todo en material maderado
  await db.finishProfile.upsert({
    where: { id: 'MADERADO' },
    update: { usePieceMaterials: false, bodyMaterialId: maderado?.id ?? null, frontMaterialId: maderado?.id ?? null, active: true, order: 1 },
    create: { id: 'MADERADO', name: 'Maderado', usePieceMaterials: false, bodyMaterialId: maderado?.id ?? null, frontMaterialId: maderado?.id ?? null, active: true, order: 1 },
  });

  // Frentes = piezas cuyo material actual es el material maderado (VESTO)
  if (maderado) {
    const res = await db.piece.updateMany({ where: { materialId: maderado.id }, data: { isFront: true } });
    console.log('Piezas marcadas como frente:', res.count);
  } else {
    console.log('WARN: sin material maderado, no se marcaron frentes');
  }

  const profiles = await db.finishProfile.findMany();
  console.log('Perfiles:', profiles.map((p) => `${p.id} (${p.name})`).join(', '));
}

main().finally(() => db.$disconnect());
