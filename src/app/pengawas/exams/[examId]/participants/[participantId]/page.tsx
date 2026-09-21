'use client';

import { useState, useEffect, use } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  DoorOpen,
  Clock,
  Radio,
  AlertTriangle,
  RotateCcw,
  LogOut,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Globe,
  Wifi,
  History,
  Calendar,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ examId: string; participantId: string }>;
}) {
  const { examId, participantId } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals for actions
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [endSessionModalOpen, setEndSessionModalOpen] = useState(false);
  const [endSessionReason, setEndSessionReason] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchParticipant = async () => {
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/participants/${participantId}`
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || 'Gagal memuat detail peserta.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipant();
  }, [examId, participantId]);

  const p = data?.participant;
  const exam = data?.exam;
  const room = data?.room;
  const violations = data?.violations || [];
  const notes = data?.notes || [];

  const handleResetDevice = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${room?.id}/revoke-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId,
            reason: revokeReason || 'Reset perangkat siswa oleh pengawas.',
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast('Sesi perangkat berhasil direset.');
        setRevokeModalOpen(false);
        setRevokeReason('');
        fetchParticipant();
      } else {
        showToast(json.error || 'Gagal mereset sesi perangkat.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    if (!endSessionReason.trim()) {
      showToast('Alasan penghentian wajib diisi.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${room?.id}/end-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId,
            reason: endSessionReason,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast('Sesi siswa berhasil dihentikan secara paksa.');
        setEndSessionModalOpen(false);
        setEndSessionReason('');
        fetchParticipant();
      } else {
        showToast(json.error || 'Gagal menghentikan sesi siswa.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      showToast('Catatan tidak boleh kosong.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          roomId: room?.id,
          content: noteContent,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Catatan pengawas berhasil disimpan.');
        setNoteModalOpen(false);
        setNoteContent('');
        fetchParticipant();
      } else {
        showToast(json.error || 'Gagal menyimpan catatan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan catatan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <PengawasLayout
      title={`Detail Peserta — ${p?.studentName || 'Peserta'}`}
      subtitle="Informasi pengerjaan, konektivitas sesi, linimasa pelanggaran, dan catatan pengawas."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: exam?.title || 'Ujian', href: `/pengawas/exams/${examId}` },
        { label: 'Live Monitoring', href: `/pengawas/exams/${examId}/monitoring?roomId=${room?.id}` },
        { label: p?.studentName || 'Detail Peserta' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/pengawas/exams/${examId}/monitoring?roomId=${room?.id}`}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Kembali ke Monitoring
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setNoteModalOpen(true)}
            leftIcon={<FileText className="w-3.5 h-3.5" />}
          >
            + Catatan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevokeModalOpen(true)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
          >
            Reset Perangkat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEndSessionModalOpen(true)}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-600" />}
          >
            Hentikan Sesi
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchParticipant}>
              Coba Lagi
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* Identity & Session Header Card */}
            <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                    {p?.studentName ? p.studentName.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900">{p?.studentName}</h2>
                      <Badge
                        variant={p?.sessionStatus === 'IN_PROGRESS' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {p?.sessionStatus || 'NOT_STARTED'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>NIS: {p?.nis || '-'}</span>
                      <span>&bull;</span>
                      <span>NISN: {p?.nisn || '-'}</span>
                      <span>&bull;</span>
                      <span className="font-sans font-semibold text-slate-700">{p?.className}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Lokasi Duduk</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">{room?.name}</Badge>
                    <span className="text-sm font-bold text-slate-900">Meja {p?.seatNumber || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Progress & Heartbeat Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Progres Soal</span>
                  <div className="text-base font-black text-slate-900">
                    {p?.progress?.answered ?? 0} / {p?.progress?.total ?? 0} Soal
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    {p?.progress?.percentage ?? 0}% Selesai Dijawab
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Detak Jantung Terakhir</span>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {p?.lastHeartbeatAt ? new Date(p.lastHeartbeatAt).toLocaleTimeString('id-ID') : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500">Interval heartbeat 10 detik</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Sisa Waktu Sesi</span>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {Math.floor((p?.timeRemainingSeconds || 0) / 60)} Menit
                  </div>
                  <div className="text-[10px] text-slate-500">Server-authoritative timer</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pelanggaran Tab</span>
                  <div className="text-base font-black text-amber-700">
                    {p?.violationCount || 0} Kali
                  </div>
                  <div className="text-[10px] text-slate-500">Peristiwa perpindahan tab</div>
                </div>
              </div>
            </Card>

            {/* Device & Security Environment */}
            <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lingkungan Perangkat & Sesi Klien
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Perangkat / Browser</span>
                  </div>
                  <div className="font-mono text-slate-800 text-[11px] truncate" title={p?.deviceSummary}>
                    {p?.deviceSummary || 'Browser Klien'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Alamat IP Terkoneksi</span>
                  </div>
                  <div className="font-mono text-slate-800 text-[11px]">
                    {p?.ipAddress || '127.0.0.1 (Lokal)'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Sidik Jari Klien (Fingerprint)</span>
                  </div>
                  <div className="font-mono text-slate-800 text-[11px] truncate">
                    {p?.deviceFingerprint ? `${p.deviceFingerprint.slice(0, 16)}...` : 'Tersambung'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Two Columns: Linimasa Pelanggaran & Catatan Pengawas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Linimasa Pelanggaran */}
              <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Linimasa Pelanggaran Peserta</span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {violations.length} laporan
                  </span>
                </div>

                {violations.length > 0 ? (
                  <div className="space-y-2.5">
                    {violations.map((v: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{v.eventType || 'TAB_SWITCH'}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(v.createdAt).toLocaleTimeString('id-ID')}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">
                          {v.description || 'Peserta meninggalkan jendela ujian atau membuka tab lain.'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-medium">
                    Tidak ada catatan pelanggaran untuk peserta ini.
                  </div>
                )}
              </Card>

              {/* Catatan Pengawas */}
              <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Catatan Pengawasan</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-bold text-emerald-700"
                    onClick={() => setNoteModalOpen(true)}
                  >
                    + Tambah
                  </Button>
                </div>

                {notes.length > 0 ? (
                  <div className="space-y-2.5">
                    {notes.map((n: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{n.proctorName || 'Pengawas'}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(n.createdAt).toLocaleTimeString('id-ID')}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{n.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-medium">
                    Belum ada catatan khusus untuk peserta ini.
                  </div>
                )}
              </Card>
            </div>
          </>
        )}

        {/* MODAL 1: Reset Perangkat */}
        <Modal
          isOpen={revokeModalOpen}
          onClose={() => setRevokeModalOpen(false)}
          title="Reset Sesi Perangkat Peserta"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Reset pengikatan perangkat (fingerprint) untuk <strong>{p?.studentName}</strong> agar siswa dapat berpindah ke komputer atau browser pengganti.
            </p>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Alasan Reset (Audit):</label>
              <textarea
                rows={3}
                placeholder="Contoh: Komputer klien macet, berpindah ke PC-05..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevokeModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetDevice}
                isLoading={isProcessing}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Konfirmasi Reset
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 2: Hentikan Sesi */}
        <Modal
          isOpen={endSessionModalOpen}
          onClose={() => setEndSessionModalOpen(false)}
          title="Hentikan Sesi Ujian Siswa Secara Paksa"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Peringatan Tindakan Darurat
              </p>
              <p>
                Sesi ujian peserta <strong>{p?.studentName}</strong> akan dihentikan seketika dan status ujian menjadi TERMINATED.
              </p>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Alasan Penghentian Sesi:</label>
              <textarea
                rows={3}
                placeholder="Tuliskan alasan pelanggaran berat atau instruksi penghentian..."
                value={endSessionReason}
                onChange={(e) => setEndSessionReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEndSessionModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEndSession}
                isLoading={isProcessing}
                disabled={!endSessionReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Hentikan Sesi
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 3: Tambah Catatan */}
        <Modal
          isOpen={noteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          title={`Tambah Catatan Pengawas — ${p?.studentName}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <textarea
              rows={4}
              placeholder="Tuliskan catatan kejadian penting atau perlakuan khusus..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoteModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddNote}
                isLoading={isProcessing}
                disabled={!noteContent.trim()}
              >
                Simpan Catatan
              </Button>
            </div>
          </div>
        </Modal>

        {/* Toast Notification */}
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
    </PengawasLayout>
  );
}
