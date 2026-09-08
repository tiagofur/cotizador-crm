import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { slugify } from '@/lib/format';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return NextResponse.json({ error: 'Formato no soportado (usa PNG, JPG, WEBP o GIF)' }, { status: 400 });
    }
    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'imagen';
    const fileName = `${base}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch {
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}
