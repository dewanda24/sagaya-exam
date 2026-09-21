import * as XLSX from 'xlsx';

export async function GET() {
  const sampleData = [
    {
      No: 1,
      'Topik / Materi': 'Aljabar & Persamaan Kuadrat',
      'Tipe Soal': 'PILIHAN_GANDA',
      'Teks Pertanyaan': 'Akar-akar dari persamaan kuadrat x^2 - 5x + 6 = 0 adalah...',
      'Pilihan A': 'x = 2 dan x = 3',
      'Pilihan B': 'x = -2 dan x = -3',
      'Pilihan C': 'x = 1 dan x = 6',
      'Pilihan D': 'x = -1 dan x = -6',
      'Pilihan E': 'x = 2 dan x = -3',
      'Kunci Jawaban': 'A',
      'Bobot Poin': 2,
      'Level Kognitif': 'L2_PENERAPAN',
      'Kode KD/CP': 'CP-MAT-01',
      'Rubrik Essay': '',
    },
    {
      No: 2,
      'Topik / Materi': 'Ciri-Ciri Makhluk Hidup',
      'Tipe Soal': 'PG_KOMPLEKS',
      'Teks Pertanyaan': 'Pilihlah pernyataan yang BENAR mengenai ciri-ciri sel hewan (Pilihan dapat lebih dari satu):',
      'Pilihan A': 'Memiliki dinding sel dari selulosa',
      'Pilihan B': 'Tidak memiliki plastida/kloroplas',
      'Pilihan C': 'Memiliki sentriol untuk pembelahan',
      'Pilihan D': 'Memiliki vakuola berukuran besar permanen',
      'Pilihan E': 'Bentuk sel relatif fleksibel tidak kaku',
      'Kunci Jawaban': 'B, C, E',
      'Bobot Poin': 3,
      'Level Kognitif': 'L2_PENERAPAN',
      'Kode KD/CP': 'CP-BIO-02',
      'Rubrik Essay': '',
    },
    {
      No: 3,
      'Topik / Materi': 'Fisika Dasar: Gerak Lurus',
      'Tipe Soal': 'BENAR_SALAH',
      'Teks Pertanyaan': 'Pada Gerak Lurus Beraturan (GLB), percepatan benda bernilai konstan bukan nol.',
      'Pilihan A': 'BENAR',
      'Pilihan B': 'SALAH',
      'Pilihan C': '',
      'Pilihan D': '',
      'Pilihan E': '',
      'Kunci Jawaban': 'B',
      'Bobot Poin': 2,
      'Level Kognitif': 'L1_PENGETAHUAN',
      'Kode KD/CP': 'CP-FIS-03',
      'Rubrik Essay': '',
    },
    {
      No: 4,
      'Topik / Materi': 'Kimia: Larutan Asam Basa',
      'Tipe Soal': 'ISIAN_SINGKAT',
      'Teks Pertanyaan': 'Berapakah nilai pH dari larutan netral murni pada suhu standar 25 derajat Celsius?',
      'Pilihan A': '',
      'Pilihan B': '',
      'Pilihan C': '',
      'Pilihan D': '',
      'Pilihan E': '',
      'Kunci Jawaban': '7',
      'Bobot Poin': 3,
      'Level Kognitif': 'L1_PENGETAHUAN',
      'Kode KD/CP': 'CP-KIM-01',
      'Rubrik Essay': '',
    },
    {
      No: 5,
      'Topik / Materi': 'Literasi Lingkungan Hidup',
      'Tipe Soal': 'ESSAY',
      'Teks Pertanyaan': 'Jelaskan mekanisme pemanasan global akibat peningkatan gas rumah kaca serta 3 upaya konkret sekolah untuk mereduksinya!',
      'Pilihan A': '',
      'Pilihan B': '',
      'Pilihan C': '',
      'Pilihan D': '',
      'Pilihan E': '',
      'Kunci Jawaban': '',
      'Bobot Poin': 5,
      'Level Kognitif': 'L3_PENALARAN',
      'Kode KD/CP': 'CP-IPA-04',
      'Rubrik Essay': 'Skor 5: Penjelasan mekanisme ilmiah lengkap dan 3 upaya logis. Skor 3: Mekanisme cukup, 2 upaya. Skor 1: Jawaban singkat.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Bank_Soal');

  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 26 }, // Topik
    { wch: 18 }, // Tipe
    { wch: 45 }, // Pertanyaan
    { wch: 24 }, // A
    { wch: 24 }, // B
    { wch: 24 }, // C
    { wch: 24 }, // D
    { wch: 24 }, // E
    { wch: 16 }, // Kunci
    { wch: 12 }, // Bobot
    { wch: 18 }, // Level Kognitif
    { wch: 14 }, // Kode KD
    { wch: 40 }, // Rubrik
  ];

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'Content-Disposition': 'attachment; filename="template_import_bank_soal_sagaya.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
