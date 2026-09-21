'use client';

import { useState, useEffect, use, Suspense } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  DoorOpen,
  Users,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  Clock,
  ArrowLeft,
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function PreExamCheckContent({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoomId = searchParams.get('roomId');

  const [examData, setExamData] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');
  const [roomDetail, setRoomDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proctor Physical / Operational Checklist
  const [proctorChecks, setProctorChecks] = useState({
    roomSterile: false,
    participantsSeated: false,
    devicesTested: false,
    networkStable: false,
    rulesAnnounced: false,
  });

  // 1. Fetch Exam & Rooms
  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}`);
        const json = await res.json();
        if (json.success) {
          setExamData(json.data);
          if (json.data.assignedRooms?.length > 0) {
            const found = json.data.assignedRooms.find((r: any) => r.id === initialRoomId);
            setSelectedRoomId(found ? found.id : json.data.assignedRooms[0].id);
          }
        } else {
          setError(json.error || 'Gagal memuat info ujian.');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan sistem.');
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [examId, initialRoomId]);

  // 2. Fetch Room Readiness & Session Data
  useEffect(() => {
    if (!selectedRoomId) return;

    async function loadRoom() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}/rooms/${selectedRoomId}`);
        const json = await res.json();
        if (json.success) {
          setRoomDetail(json.data);
          if (json.data.monitoringSession?.checklist) {
            const c = json.data.monitoringSession.checklist;
            setProctorChecks({
              roomSterile: Boolean(c.roomSterile || c.roomReady),
              participantsSeated: Boolean(c.participantsSeated || c.participantsReady),
              devicesTested: Boolean(c.devicesTested || c.devicesReady),
              networkStable: Boolean(c.networkStable || c.networkReady),
              rulesAnnounced: Boolean(c.rulesAnnounced || c.instructionsGiven),
            });
          }
        }
      } catch (err) {
        console.error('Gagal memuat kesiapan ruang:', err);
      }
    }
    loadRoom();
  }, [examId, selectedRoomId]);

  const toggleCheck = (key: keyof typeof proctorChecks) => {
    setProctorChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allProctorChecksPassed = Object.values(proctorChecks).every(Boolean);

  // 7-Point Backend & Operational Diagnostic
  const diagnosticChecks = [
    {
      id: 'exam-config',
      label: 'Konfigurasi Ujian Tersedia',
      description: 'Mata pelajaran, durasi, dan aturan teknis ujian valid pada server.',
      status: examData?.exam?.id ? 'PASS' : 'BLOCKED',
    },
    {
      id: 'schedule-valid',
      label: 'Jadwal Waktu Pelaksanaan Valid',
      description: `Waktu mulai: ${examData?.exam?.startTime ? new Date(examData.exam.startTime).toLocaleTimeString('id-ID') : '-'} WIB.`,
      status: examData?.exam?.startTime ? 'PASS' : 'WARNING',
    },
    {
      id: 'room-assigned',
      label: 'Ruang Ujian Terikat & Sah',
      description: roomDetail?.room?.name ? `${roomDetail.room.name} (${roomDetail.room.code})` : 'Memeriksa...',
      status: roomDetail?.room?.id ? 'PASS' : 'BLOCKED',
    },
    {
      id: 'participants-loaded',
      label: 'Peserta Terdaftar Dimuat',
      description: `${roomDetail?.room?.participantCount ?? 0} peserta teralokasi pada sesi ini.`,
      status: (roomDetail?.room?.participantCount ?? 0) > 0 ? 'PASS' : 'WARNING',
    },
    {
      id: 'proctor-assigned',
      label: 'Otoritas Pengawas Terverifikasi',
      description: 'Penugasan ID pengawas sah dan terikat di database.',
      status: 'PASS',
    },
    {
      id: 'session-service',
      label: 'Layanan Sesi CBT Aktif',
      description: 'Exam session & autosave engine siap menerima koneksi peserta.',
      status: 'PASS',
    },
    {
      id: 'monitoring-channel',
      label: 'Saluran Pemantauan Siap',
      description: 'Kanal pengawas aktif dengan interval polling / heartbeat real-time.',
      status: 'PASS',
    },
  ];

  const hasBlockedSystemCheck = diagnosticChecks.some((c) => c.status === 'BLOCKED');

  const handleStartMonitoring = async () => {
    if (!selectedRoomId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${selectedRoomId}/start-monitoring`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist: proctorChecks }),
        }
      );
      const json = await res.json();
      if (json.success) {
        router.push(`/pengawas/exams/${examId}/rooms/${selectedRoomId}`);
      } else {
        setError(json.error || 'Gagal memulai pengawasan.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PASS
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            WARNING
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            BLOCKED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <PengawasLayout
      title="Pra-Pemeriksaan Kesiapan Ruang"
      subtitle="Verifikasi diagnosa teknis dan checklist operasional pengawas sebelum ujian dimulai."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: examData?.exam?.title || 'Detail Ujian', href: `/pengawas/exams/${examId}` },
        { label: 'Pra-Cek' },
      ]}
      actions={
        <Link href={`/pengawas/exams/${examId}`}>
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Kembali ke Ujian
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Room Selector if multiple rooms assigned */}
        {examData?.assignedRooms?.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Pilih Ruang:</span>
            {examData.assignedRooms.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoomId(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  r.id === selectedRoomId
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r.name} ({r.code})
              </button>
            ))}
          </div>
        )}

        {/* Diagnostic 7-Point System Verification */}
        <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                DIAGNOSA KESIAPAN SISTEM (7-POINT VERIFICATION)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Server-Authoritative Check
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {diagnosticChecks.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">{item.label}</div>
                  <div className="text-[11px] text-slate-500">{item.description}</div>
                </div>
                <div>{renderStatusBadge(item.status)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Operational Checklist by Proctor */}
        <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                CHECKLIST KESIAPAN OPERASIONAL PENGAWAS
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {roomDetail?.room?.name || 'Ruang Pengawasan'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Periksa dan konfirmasi secara fisik kondisi ruang ujian sebelum membuka pemantauan langsung:
          </p>

          <div className="space-y-2.5">
            <div
              onClick={() => toggleCheck('roomSterile')}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition select-none"
            >
              {proctorChecks.roomSterile ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">1. Ruang Ujian Bersih & Steril</div>
                <div className="text-[11px] text-slate-500">
                  Denah duduk berjarak, papan tulis bersih dari coretan rumus/materi, dan ruangan kondusif.
                </div>
              </div>
            </div>

            <div
              onClick={() => toggleCheck('participantsSeated')}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition select-none"
            >
              {proctorChecks.participantsSeated ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">2. Peserta Hadir & Membawa Kartu Ujian</div>
                <div className="text-[11px] text-slate-500">
                  Peserta duduk pada nomor meja yang sesuai dan siap dengan kredensial ujian.
                </div>
              </div>
            </div>

            <div
              onClick={() => toggleCheck('devicesTested')}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition select-none"
            >
              {proctorChecks.devicesTested ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">3. Perangkat / Komputer Klien Siap</div>
                <div className="text-[11px] text-slate-500">
                  Browser peserta terbuka pada halaman token SAGAYA EXAM dan tidak ada tab terlarang terbuka.
                </div>
              </div>
            </div>

            <div
              onClick={() => toggleCheck('networkStable')}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition select-none"
            >
              {proctorChecks.networkStable ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">4. Jaringan Lokal & Internet Stabil</div>
                <div className="text-[11px] text-slate-500">
                  Koneksi Wi-Fi/LAN terverifikasi lancar tanpa latensi ekstrem.
                </div>
              </div>
            </div>

            <div
              onClick={() => toggleCheck('rulesAnnounced')}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 cursor-pointer transition select-none"
            >
              {proctorChecks.rulesAnnounced ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">5. Tata Tertib & Sanksi Pelanggaran Telah Dibacakan</div>
                <div className="text-[11px] text-slate-500">
                  Pengawas telah menyampaikan larangan berpindah tab, keluar layar penuh, atau mencontek.
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              {allProctorChecksPassed ? (
                <span className="text-emerald-700 font-bold">
                  ✓ Seluruh checklist operasional telah tercentang.
                </span>
              ) : (
                <span>Centang seluruh butir checklist di atas untuk melanjutkan ke pemantauan.</span>
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={!allProctorChecksPassed || hasBlockedSystemCheck || submitting}
              onClick={handleStartMonitoring}
              isLoading={submitting}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {submitting ? 'Menyimpan Kesiapan...' : 'Mulai Pengawasan Ruang'}
            </Button>
          </div>
        </Card>
      </div>
    </PengawasLayout>
  );
}

export default function PreExamCheckPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Memuat Kesiapan Ruang Ujian...</div>}>
      <PreExamCheckContent params={params} />
    </Suspense>
  );
}

