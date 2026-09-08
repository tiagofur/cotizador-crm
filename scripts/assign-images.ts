/* Asigna las imágenes generadas a los muebles según su código */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Orden importa: los patrones más específicos primero
const rules: Array<[RegExp, string]> = [
  [/^ALA-RIN/, '/uploads/furniture/ala-rin.png'],
  [/^ALA-1PU/, '/uploads/furniture/ala-1pu.png'],
  [/^ALA-2PU/, '/uploads/furniture/ala-2pu.png'],
  [/^ALA-BAS/, '/uploads/furniture/ala-bas.png'],
  [/^ALA-NIC/, '/uploads/furniture/ala-nic.png'],
  [/^ALA-MIC/, '/uploads/furniture/ala-mic.png'],
  [/^GAB-RIN/, '/uploads/furniture/gab-rin.png'],
  [/^GAB-3CA/, '/uploads/furniture/gab-3ca.png'],
  [/^GAB-1CA/, '/uploads/furniture/gab-3ca.png'],
  [/^GAB-MIC/, '/uploads/furniture/gab-nic.png'],
  [/^GAB-NIC/, '/uploads/furniture/gab-nic.png'],
  [/^GAB-1PU/, '/uploads/furniture/gab-1pu.png'],
  [/^GAB-2PU/, '/uploads/furniture/gab-2pu.png'],
  [/^TAR-/, '/uploads/furniture/tar.png'],
  [/^DES-HOR-3CA/, '/uploads/furniture/des-hor3ca.png'],
  [/^DES-HOR/, '/uploads/furniture/des-hor.png'],
  [/^DES-NIC/, '/uploads/furniture/des-nic.png'],
  [/^DES-1PU/, '/uploads/furniture/des-1pu.png'],
  [/^DES-2PU/, '/uploads/furniture/des-2pu.png'],
  [/^PAN-/, '/uploads/furniture/panel.png'],
  [/^ZOC-/, '/uploads/furniture/zoclo.png'],
];

async function main() {
  const furniture = await prisma.furniture.findMany({ select: { id: true, code: true, imageUrl: true } });
  let assigned = 0;
  let missing: string[] = [];
  for (const f of furniture) {
    if (f.imageUrl) continue;
    const rule = rules.find(([re]) => re.test(f.code));
    if (rule) {
      await prisma.furniture.update({ where: { id: f.id }, data: { imageUrl: rule[1] } });
      assigned++;
    } else {
      missing.push(f.code);
    }
  }
  console.log(`Imágenes asignadas: ${assigned}. Sin imagen: ${missing.length ? missing.join(', ') : 'ninguno'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
