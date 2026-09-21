import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/core/rate-limit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Whitelisted upload folders (path traversal prevention)
const ALLOWED_FOLDERS = ['logos', 'student-photos', 'question-media'] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

// Strict MIME type mapping and size limits
const MIME_CONFIG: Record<string, { ext: string; maxSize: number }> = {
  'image/jpeg': { ext: '.jpg', maxSize: 10 * 1024 * 1024 },
  'image/png': { ext: '.png', maxSize: 10 * 1024 * 1024 },
  'image/webp': { ext: '.webp', maxSize: 10 * 1024 * 1024 },
  'image/gif': { ext: '.gif', maxSize: 10 * 1024 * 1024 },
  'audio/mpeg': { ext: '.mp3', maxSize: 50 * 1024 * 1024 },
  'audio/wav': { ext: '.wav', maxSize: 50 * 1024 * 1024 },
  'audio/ogg': { ext: '.ogg', maxSize: 50 * 1024 * 1024 },
  'video/mp4': { ext: '.mp4', maxSize: 50 * 1024 * 1024 },
  'video/webm': { ext: '.webm', maxSize: 50 * 1024 * 1024 },
};

export async function POST(req: Request) {
  // 1. Authentication & Role Authorization
  const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
  if (!auth.authorized) {
    return auth.response;
  }

  // 2. Rate Limiting per user
  const rl = checkRateLimit(`upload:user:${auth.user.id}`, RATE_LIMITS.GENERAL_API);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan unggah berkas. Coba lagi sebentar lagi.' },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawFolder = (formData.get('folder') as string) || 'logos';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Berkas tidak ditemukan.' }, { status: 400 });
    }

    // 3. Folder Whitelist Validation (Fix J-001: Path Traversal)
    if (!ALLOWED_FOLDERS.includes(rawFolder as AllowedFolder)) {
      return NextResponse.json(
        {
          success: false,
          error: `Folder tidak valid. Folder yang diizinkan: ${ALLOWED_FOLDERS.join(', ')}.`,
        },
        { status: 400 }
      );
    }
    const folder = rawFolder as AllowedFolder;

    // 4. MIME Type Validation (Fix J-002: MIME Type Whitelist)
    const mimeType = file.type?.toLowerCase();
    const mimeConfig = MIME_CONFIG[mimeType];

    if (!mimeConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipe berkas '${file.type || 'tidak diketahui'}' tidak diizinkan. Hanya format gambar, audio, dan video yang diperbolehkan.`,
        },
        { status: 400 }
      );
    }

    // 5. File Size Limit Validation (Fix J-003: Max File Size)
    if (file.size > mimeConfig.maxSize) {
      const maxMb = Math.round(mimeConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran berkas melebihi batas maksimum (${maxMb}MB untuk format ini).`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 6. Secure Random File Name Generation (Fix J-004: Do NOT trust client file extension)
    const randomUuid = crypto.randomUUID();
    const safeFileName = `${randomUuid}${mimeConfig.ext}`;
    const storagePath = `${folder}/${safeFileName}`;

    let publicUrl = '';

    // 7. Attempt upload to Supabase Storage bucket 'school-assets'
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.storage
        .from('school-assets')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;
      }
    } catch (sbErr) {
      console.warn('Supabase storage upload fallback activated:', sbErr);
    }

    // 8. Fallback to public/uploads directory if Supabase Storage returns mock or empty
    if (!publicUrl || publicUrl.includes('mock.supabase.co')) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const localFilePath = path.join(uploadDir, safeFileName);
      fs.writeFileSync(localFilePath, buffer);

      publicUrl = `/uploads/${folder}/${safeFileName}`;
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: safeFileName,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengunggah berkas.' },
      { status: 500 }
    );
  }
}
