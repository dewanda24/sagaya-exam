import { NextResponse } from 'next/server';

export async function GET() {
  const csvHeader = 'NPSN_KODE,NAMA_SEKOLAH,JENJANG,RAYON,KUOTA_SISWA,KUOTA_UJIAN,PAKET_LISENSI,MASA_AKTIF_HARI,NAMA_KEPALA_SEKOLAH,ALAMAT\n';
  const sampleRow1 = '20101001,SMA Negeri 1 Sagaya,SMA,Rayon 1 - Pusat,500,25,TAHUNAN,365,Drs. H. Hendra M.Pd,Jl. Merdeka No. 1\n';
  const sampleRow2 = '20101002,SMK Negeri 2 Teknologi,SMK,Rayon 2 - Utara,600,30,TAHUNAN,365,Ir. Bambang Santoso,Jl. Industri No. 45\n';
  const sampleRow3 = '20101003,SMP Negeri 3 Juara,SMP,Rayon 3 - Selatan,400,20,SEMESTER,180,Siti Rahayu S.Pd,Jl. Pahlawan No. 12\n';

  const csvContent = csvHeader + sampleRow1 + sampleRow2 + sampleRow3;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template_impor_satuan_pendidikan.csv"',
    },
  });
}
