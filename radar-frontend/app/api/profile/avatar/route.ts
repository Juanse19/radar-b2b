// app/api/profile/avatar/route.ts
//
// POST /api/profile/avatar — upload profile photo to Supabase Storage
//
// Accepts multipart/form-data with field "avatar" (image file, max 2 MB).
// Uploads to the "avatars" bucket and saves the public URL to matec_radar.usuarios.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Request inválido — se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('avatar') as File | null;
  if (!file) return NextResponse.json({ error: 'Campo "avatar" requerido' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos de imagen' }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo no puede superar 2 MB' }, { status: 400 });
  }

  // Derive extension safely; default to "jpg" for unknown subtypes
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const storagePath = `${session.id}/avatar.${ext}`;

  const db = getAdminDb();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(storagePath);

  const { error: updateError } = await db
    .from('usuarios')
    .update({ avatar_url: publicUrl })
    .eq('id', session.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: publicUrl });
}
