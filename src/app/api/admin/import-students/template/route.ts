import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const sampleData = [
    {
      NIS: '22231010',
      NISN: '0061234580',
      'Nama Lengkap': 'Fahri Ramadhan',
      'Jenis Kelamin': 'L',
      Kelas: 'XII MIPA 1',
    },
    {
      NIS: '22231011',
      NISN: '0061234581',
      'Nama Lengkap': 'Nabila Zahra',
      'Jenis Kelamin': 'P',
      Kelas: 'XII MIPA 1',
    },
    {
      NIS: '22231012',
      NISN: '0061234582',
      'Nama Lengkap': 'Rizky Pratama',
      'Jenis Kelamin': 'L',
      Kelas: 'XII MIPA 2',
    },
    {
      NIS: '22231013',
      NISN: '0061234583',
      'Nama Lengkap': 'Salma Putri Hidayat',
      'Jenis Kelamin': 'P',
      Kelas: 'XII IPS 1',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

  // Auto column widths
  worksheet['!cols'] = [
    { wch: 14 }, // NIS
    { wch: 16 }, // NISN
    { wch: 30 }, // Nama Lengkap
    { wch: 15 }, // Jenis Kelamin
    { wch: 18 }, // Kelas
  ];

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'Content-Disposition': 'attachment; filename="template_import_siswa_sagaya.xlsx"',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
