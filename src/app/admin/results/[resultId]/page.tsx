'use client';

import { useState, useEffect, use } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Send,
  Edit3,
  Slash,
  Printer,
  RefreshCw,
  Layers,
  Percent,
  Check,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminResultDetailPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [newScoreVal, setNewScoreVal] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchResult = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/results/${resultId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setNewScoreVal(json.data.result?.finalScore || 0);
        setError(null);
      } else {
        setError(json.error || 'Gagal memuat detail hasil ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [resultId]);

  const handlePublish = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/results/${resultId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        showToast('Hasil ujian berhasil dipublikasikan ke siswa.');
        fetchResult();
      } else {
        showToast(json.error || 'Gagal mempublikasikan hasil.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCorrect = async () => {
    if (!correctionReason.trim()) {
      showToast('Alasan koreksi nilai wajib dicantumkan.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/results/${resultId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newScore: newScoreVal,
          reason: correctionReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Nilai berhasil dikoreksi dan tercatat pada audit.');
        setCorrectModalOpen(false);
        setCorrectionReason('');
        fetchResult();
      } else {
        showToast(json.error || 'Gagal mengoreksi nilai.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan koreksi.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      showToast('Alasan pembatalan (VOID) wajib dicantumkan.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/results/${resultId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Hasil ujian berhasil dibatalkan (VOID).');
        setVoidModalOpen(false);
        setVoidReason('');
        fetchResult();
      } else {
        showToast(json.error || 'Gagal membatalkan hasil ujian.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const r = data?.result;
  const questions = data?.questions || [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/results"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Hasil Ujian</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchResult}
              isLoading={loading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Segarkan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Cetak Hasil
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchResult}>
              Coba Lagi
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          </div>
        ) : r ? (
          <>
            {/* Header Identity Card */}
            <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="info" size="sm">
                      {r.subjectName || 'Mata Pelajaran'}
                    </Badge>
                    <Badge
                      variant={
                        r.status === 'PUBLISHED'
                          ? 'success'
                          : r.status === 'REVIEWED'
                          ? 'info'
                          : r.status === 'VOID'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {r.status}
                    </Badge>
                    {r.isPassed !== undefined && (
                      <Badge variant={r.isPassed ? 'success' : 'danger'} size="sm">
                        {r.isPassed ? 'TUNTAS (KKM)' : 'BELUM TUNTAS'}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {r.examTitle}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Peserta: <strong className="text-slate-800">{r.studentName}</strong> (NISN: {r.nisn || '-'}) &bull; Kelas: {r.className || '-'}
                  </p>
                </div>

                {/* Sensitive Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {r.status !== 'PUBLISHED' && r.status !== 'VOID' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handlePublish}
                      isLoading={isProcessing}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Publikasikan
                    </Button>
                  )}
                  {r.status !== 'VOID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCorrectModalOpen(true)}
                      leftIcon={<Edit3 className="w-3.5 h-3.5 text-amber-600" />}
                    >
                      Koreksi Nilai
                    </Button>
                  )}
                  {r.status !== 'VOID' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVoidModalOpen(true)}
                      leftIcon={<Slash className="w-3.5 h-3.5 text-rose-600" />}
                    >
                      Batalkan (VOID)
                    </Button>
                  )}
                </div>
              </div>

              {/* Score Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Nilai Akhir</span>
                  <div className="text-2xl font-black text-slate-900">{r.finalScore}</div>
                  <span className="text-[10px] text-slate-500">Skor ternormalisasi (0–100)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Nilai Mentah</span>
                  <div className="text-2xl font-black text-slate-900">
                    {r.rawScore} / {r.maxScore}
                  </div>
                  <span className="text-[10px] text-slate-500">Perolehan poin aktual</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Persentase</span>
                  <div className="text-2xl font-black text-emerald-700">{r.percentage}%</div>
                  <span className="text-[10px] text-slate-500">Kesesuaian capaian</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Standar KKM</span>
                  <div className="text-2xl font-black text-indigo-700">{r.passingGrade}</div>
                  <span className="text-[10px] text-slate-500">Batas kelulusan mapel</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Waktu Penilaian</span>
                  <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                    {r.gradedAt ? new Date(r.gradedAt).toLocaleDateString('id-ID') : 'Otomatis'}
                  </div>
                  <span className="text-[10px] text-slate-500">Versi skoring: v{r.scoringVersion || 1}</span>
                </div>
              </div>
            </Card>

            {/* Question Breakdown Table */}
            <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden space-y-0">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Rincian Perolehan Poin per Nomor Soal ({questions.length} Butir)
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  Data Server-Authoritative
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-14">No</th>
                      <th className="py-3 px-4">Jawaban Siswa</th>
                      <th className="py-3 px-4 text-center">Perolehan Poin</th>
                      <th className="py-3 px-4 text-center">Poin Maks</th>
                      <th className="py-3 px-4 text-center">Status Butir</th>
                      <th className="py-3 px-4">Umpan Balik / Catatan Guru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions.length > 0 ? (
                      questions.map((q: any, idx: number) => {
                        const isFull = q.score >= q.maxScore && q.maxScore > 0;
                        const isPartial = q.score > 0 && q.score < q.maxScore;
                        const isZero = q.score === 0;

                        return (
                          <tr key={q.id || idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-bold text-slate-800">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                              {typeof q.answer === 'object'
                                ? JSON.stringify(q.answer)
                                : String(q.answer || '-')}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-900">
                              {q.score}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-500">
                              {q.maxScore}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant={isFull ? 'success' : isPartial ? 'warning' : 'danger'}
                                size="sm"
                              >
                                {isFull ? 'BENAR' : isPartial ? 'SEBAGIAN' : 'SALAH'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {q.feedback || q.teacherInternalNote || (
                                <span className="text-slate-400 italic">Tidak ada catatan</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          Rincian butir soal belum dikompilasi atau diarsipkan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-12 text-center bg-white border-slate-200">
            <EmptyState
              title="Hasil Ujian Tidak Ditemukan"
              description="Data hasil ujian peserta ini tidak tersedia atau telah dihapus."
              actionLabel="Kembali ke Hasil Ujian"
              onAction={() => router.push('/admin/results')}
            />
          </Card>
        )}

        {/* MODAL 1: Koreksi Nilai */}
        <Modal
          isOpen={correctModalOpen}
          onClose={() => setCorrectModalOpen(false)}
          title="Koreksi Nilai Siswa (Result Correction)"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Pemberitahuan Audit Koreksi
              </span>
              <p>
                Mengubah nilai akhir peserta <strong>{r?.studentName}</strong> dari{' '}
                <strong>{r?.finalScore}</strong> menjadi nilai baru. Perubahan ini akan dicatat ke riwayat audit sistem.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Nilai Baru (0 - 100):</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={newScoreVal}
                onChange={(e) => setNewScoreVal(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Alasan Koreksi (Wajib Diisi):</label>
              <textarea
                rows={3}
                placeholder="Contoh: Koreksi manual butir soal uraian nomor 5 setelah peninjauan guru..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCorrectModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCorrect}
                isLoading={isProcessing}
                disabled={!correctionReason.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Simpan Koreksi Nilai
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 2: Pembatalan Nilai (VOID) */}
        <Modal
          isOpen={voidModalOpen}
          onClose={() => setVoidModalOpen(false)}
          title="Batalkan Hasil Ujian (VOID)"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Tindakan Berdampak Tinggi
              </span>
              <p>
                Membatalkan hasil ujian <strong>{r?.studentName}</strong>. Status hasil akan diubah menjadi VOID dan nilai tidak akan dihitung dalam rekapitulasi kelulusan.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Alasan Pembatalan (Wajib):</label>
              <textarea
                rows={3}
                placeholder="Tuliskan alasan diskualifikasi atau pembatalan hasil..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setVoidModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleVoid}
                isLoading={isProcessing}
                disabled={!voidReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Ya, Batalkan Hasil (VOID)
              </Button>
            </div>
          </div>
        </Modal>

        {/* Floating Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
