'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Eye,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedStudentRow {
  nisn: string;
  nis: string;
  fullName: string;
  gender: string;
  className: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export default function StudentImportWizardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 1 = Upload, 2 = Preview & Validation, 3 = Confirmation & Execution, 4 = Final Summary
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failedCount: number;
    message: string;
  } | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const downloadTemplate = () => {
    const templateData = [
      {
        NISN: '0061234571',
        NIS: '22231005',
        'Nama Lengkap': 'Rizky Pratama',
        'Jenis Kelamin': 'L',
        Kelas: 'XII MIPA 1',
      },
      {
        NISN: '0061234572',
        NIS: '22231006',
        'Nama Lengkap': 'Nabila Maharani',
        'Jenis Kelamin': 'P',
        Kelas: 'XII MIPA 1',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa_Sagaya.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const seenNisn = new Set<string>();
        const rows: ParsedStudentRow[] = rawData.map((r) => {
          const nisn = String(r['NISN'] || r['nisn'] || '').trim();
          const nis = String(r['NIS'] || r['nis'] || '').trim();
          const fullName = String(r['Nama Lengkap'] || r['nama'] || r['name'] || '').trim();
          const rawGender = String(r['Jenis Kelamin'] || r['jk'] || r['gender'] || 'L').toUpperCase().trim();
          const gender = rawGender.startsWith('P') ? 'P' : 'L';
          const className = String(r['Kelas'] || r['kelas'] || r['rombel'] || '').trim();

          const errors: string[] = [];
          if (!fullName) errors.push('Nama lengkap wajib diisi.');
          if (!nisn) errors.push('NISN wajib diisi.');

          let isDuplicate = false;
          if (nisn) {
            if (seenNisn.has(nisn)) {
              isDuplicate = true;
              errors.push(`Duplikasi NISN '${nisn}' di dalam berkas.`);
            } else {
              seenNisn.add(nisn);
            }
          }

          return {
            nisn,
            nis,
            fullName,
            gender,
            className,
            isValid: errors.length === 0,
            isDuplicate,
            errors,
          };
        });

        setParsedRows(rows);
        setCurrentStep(2);
      } catch (err) {
        console.error(err);
        alert('Gagal membaca berkas spreadsheet. Pastikan format valid (.xlsx, .xls, .csv).');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const validCount = parsedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;

  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/admin/import-students', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setImportResult({
          successCount: validCount,
          failedCount: invalidCount,
          message: data.message || 'Import data siswa selesai.',
        });
        setCurrentStep(4);
      } else {
        alert(data.error || 'Gagal mengimpor siswa.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsProcessing(false);
      setConfirmModalOpen(false);
    }
  };

  return (
    <AdminLayout
      title="Import Siswa Massal"
      subtitle="Wizard import data peserta didik dengan validasi dan deteksi duplikasi"
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Siswa', href: '/admin/students' },
        { label: 'Import Massal' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push('/admin/students')}
        >
          Kembali
        </Button>
      }
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Step Indicator Tracker */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
            <div className={`p-2 rounded-xl border ${currentStep === 1 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-400 border-transparent'}`}>
              1. Unggah Berkas
            </div>
            <div className={`p-2 rounded-xl border ${currentStep === 2 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-400 border-transparent'}`}>
              2. Validasi &amp; Preview
            </div>
            <div className={`p-2 rounded-xl border ${currentStep === 3 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-400 border-transparent'}`}>
              3. Konfirmasi
            </div>
            <div className={`p-2 rounded-xl border ${currentStep === 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-slate-400 border-transparent'}`}>
              4. Ringkasan Selesai
            </div>
          </div>
        </div>

        {/* STEP 1: Upload */}
        {currentStep === 1 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
              <CardTitle className="text-base font-black text-slate-900">
                Pilih Berkas Spreadsheet Dapodik / Excel
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                onClick={downloadTemplate}
              >
                Unduh Format Excel
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-12 text-center cursor-pointer transition bg-slate-50/60 hover:bg-blue-50/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-14 h-14 mx-auto text-blue-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Klik atau seret berkas ke sini'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">Aturan Kolom Spreadsheet:</span>
                <p>• <strong>NISN</strong>: Nomor Induk Siswa Nasional (Wajib unik).</p>
                <p>• <strong>NIS</strong>: Nomor Induk Sekolah.</p>
                <p>• <strong>Nama Lengkap</strong>: Nama lengkap siswa sesuai ijazah/rapor.</p>
                <p>• <strong>Jenis Kelamin</strong>: L untuk Laki-laki, P untuk Perempuan.</p>
                <p>• <strong>Kelas</strong>: Nama rombel sasaran (misal: XII MIPA 1).</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Preview & Validation */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Validation Metrics Radar */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Baris</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">{parsedRows.length}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Valid</span>
                <span className="text-xl font-black text-emerald-800 mt-1 block">{validCount}</span>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">Invalid / Error</span>
                <span className="text-xl font-black text-rose-800 mt-1 block">{invalidCount}</span>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Duplikat</span>
                <span className="text-xl font-black text-amber-800 mt-1 block">{duplicateCount}</span>
              </div>
            </div>

            {/* Rows Preview Table */}
            <Card>
              <CardHeader className="flex items-center justify-between border-b border-slate-100">
                <CardTitle className="text-sm font-black text-slate-900">
                  Pratinjau Data (10 Baris Pertama)
                </CardTitle>
                <span className="text-xs text-slate-400">
                  Periksa keabsahan format sebelum melanjutkan
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Nama Lengkap</th>
                        <th className="px-3 py-3">NISN</th>
                        <th className="px-3 py-3">NIS</th>
                        <th className="px-3 py-3">JK</th>
                        <th className="px-3 py-3">Kelas</th>
                        <th className="px-4 py-3 text-right">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-bold text-slate-900">{r.fullName || '—'}</td>
                          <td className="px-3 py-3 font-mono">{r.nisn || '—'}</td>
                          <td className="px-3 py-3 font-mono">{r.nis || '—'}</td>
                          <td className="px-3 py-3">{r.gender}</td>
                          <td className="px-3 py-3">{r.className || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {r.isValid && !r.isDuplicate ? (
                              <Badge variant="success" size="sm">Siap Import</Badge>
                            ) : (
                              <Badge variant="danger" size="sm">{r.errors[0] || 'Error'}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setParsedRows([]);
                  setCurrentStep(1);
                }}
              >
                Ganti Berkas
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={validCount === 0}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => setConfirmModalOpen(true)}
              >
                Lanjutkan ke Import ({validCount} Siswa)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Final Summary */}
        {currentStep === 4 && importResult && (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Proses Import Siswa Selesai!
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {importResult.message} Seluruh PIN akses kartu ujian telah dibuat secara otomatis untuk siswa yang berhasil didaftarkan.
              </p>

              <div className="pt-4 flex items-center justify-center gap-3">
                <Link href="/admin/students">
                  <Button variant="primary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                    Lihat Data Siswa
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setParsedRows([]);
                    setCurrentStep(1);
                  }}
                >
                  Import Berkas Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Import Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleExecuteImport}
        title="Konfirmasi Import Siswa Massal"
        description={`Apakah Anda yakin ingin memasukkan ${validCount} baris siswa valid ke database sekolah Anda? Siswa yang memiliki error atau duplikat akan dilewati secara aman.`}
        confirmLabel={isProcessing ? 'Mengimpor...' : 'Ya, Import Sekarang'}
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isProcessing}
      />
    </AdminLayout>
  );
}
