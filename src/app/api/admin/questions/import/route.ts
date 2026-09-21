import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { requireApiAuth } from '@/lib/core/rbac';
import * as XLSX from 'xlsx';
import { QuestionType, DifficultyLevel } from '@/lib/core/types';

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const subjectId = (formData.get('subjectId') as string) || 'b1111111-1111-1111-1111-111111111111';

    if (!file) {
      return NextResponse.json({ success: false, error: 'File spreadsheet wajib diunggah.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lembar kerja Excel kosong atau tidak terbaca.' },
        { status: 400 }
      );
    }

    let insertedCount = 0;
    const errors: string[] = [];

    const targetSchoolId = auth.user.role === 'SUPER_ADMIN' ? null : auth.user.schoolId;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // header line + 1

      const questionText = r['Teks Pertanyaan'] || r['Pertanyaan'] || r['Soal'];
      if (!questionText || !String(questionText).trim()) {
        continue; // Lewati baris tanpa teks pertanyaan
      }

      let type: QuestionType = 'PILIHAN_GANDA';
      const rawType = String(r['Tipe Soal'] || r['Tipe'] || 'PILIHAN_GANDA').trim().toUpperCase();
      if (['PILIHAN_GANDA', 'PG_KOMPLEKS', 'BENAR_SALAH', 'MENJODOHKAN', 'ISIAN_SINGKAT', 'ESSAY'].includes(rawType)) {
        type = rawType as QuestionType;
      }

      const topic = String(r['Topik / Materi'] || r['Topik'] || 'Umum').trim();
      const weight = parseFloat(r['Bobot Poin'] || r['Bobot'] || '10') || 10;
      const competenceCode = r['Kode KD/CP'] ? String(r['Kode KD/CP']).trim() : undefined;

      let cognitiveLevel: 'L1_PENGETAHUAN' | 'L2_PENERAPAN' | 'L3_PENALARAN' = 'L2_PENERAPAN';
      const rawCog = String(r['Level Kognitif'] || '').toUpperCase();
      if (rawCog.includes('L1') || rawCog.includes('INGATAN') || rawCog.includes('PENGETAHUAN')) {
        cognitiveLevel = 'L1_PENGETAHUAN';
      } else if (rawCog.includes('L3') || rawCog.includes('PENALARAN') || rawCog.includes('HOTS')) {
        cognitiveLevel = 'L3_PENALARAN';
      }

      const difficulty: DifficultyLevel = cognitiveLevel === 'L3_PENALARAN' ? 'HARD' : cognitiveLevel === 'L1_PENGETAHUAN' ? 'EASY' : 'MEDIUM';

      // Build options
      const options: any[] = [];
      ['A', 'B', 'C', 'D', 'E'].forEach((letter) => {
        const text = r[`Pilihan ${letter}`] || r[`Opsi ${letter}`] || r[letter];
        if (text !== undefined && text !== null && String(text).trim() !== '') {
          options.push({ id: letter, text: String(text).trim() });
        }
      });

      // Parse answer key
      let answerKey: any = r['Kunci Jawaban'] || r['Kunci'] || '';
      if (type === 'PG_KOMPLEKS') {
        if (typeof answerKey === 'string') {
          answerKey = answerKey
            .split(/[,;\s]+/)
            .map((k: string) => k.trim().toUpperCase())
            .filter(Boolean);
        }
      } else if (type === 'PILIHAN_GANDA' || type === 'BENAR_SALAH') {
        answerKey = String(answerKey).trim().toUpperCase();
      } else if (type === 'ISIAN_SINGKAT') {
        answerKey = String(answerKey).trim();
      }

      const rubric = r['Rubrik Essay'] || r['Rubrik'] ? String(r['Rubrik Essay'] || r['Rubrik']).trim() : undefined;

      try {
        await db.addQuestionBankItem(
          {
            subjectId,
            topic,
            difficulty,
            type,
            questionText: String(questionText).trim(),
            options: options.length > 0 ? options : undefined,
            answerKey,
            weight,
            rubric,
            cognitiveLevel,
            competenceCode,
            tags: [topic],
            isShared: false,
          },
          targetSchoolId,
          auth.user.id
        );
        insertedCount++;
      } catch (err: any) {
        errors.push(`Baris ${rowNum}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        insertedCount,
        errors,
        message: `Berhasil mengimpor ${insertedCount} butir soal ke Bank Soal.`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses file Excel.' },
      { status: 500 }
    );
  }
}
