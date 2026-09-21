'use client';

import { useState, useEffect, useCallback, use } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  X,
  Send,
  AlertTriangle,
  DoorOpen,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ExamSpecificIncidentsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);

  const [examData, setExamData] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Incident Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    roomId: '',
    category: 'NETWORK_ISSUE',
    severity: 'WARNING',
    description: '',
    actionTaken: '',
  });

  // Resolve Incident Modal
  const [resolveIncidentItem, setResolveIncidentItem] = useState<any>(null);
  const [resolveAction, setResolveAction] = useState('');

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch exam details
  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}`);
        const json = await res.json();
        if (json.success) {
          setExamData(json.data);
          if (json.data.assignedRooms?.length > 0) {
            setNewIncident((prev) => ({ ...prev, roomId: json.data.assignedRooms[0].id }));
          }
        }
      } catch (err) {
        console.error('Gagal memuat ujian:', err);
      }
    }
    loadExam();
  }, [examId]);

  // 2. Fetch incidents for this exam
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/proctor/incidents?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        // Filter for this exam
        const filtered = (json.data || []).filter((inc: any) => inc.examId === examId);
        setIncidents(filtered);
      }
    } catch {
      showToast('Gagal memuat insiden.', 'error');
    } finally {
      setLoading(false);
    }
  }, [examId, statusFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleCreateIncident = async () => {
    if (!newIncident.description.trim() || !newIncident.roomId) {
      showToast('Pilih ruang dan isi deskripsi insiden.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/rooms/${newIncident.roomId}/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newIncident.category,
          severity: newIncident.severity,
          description: newIncident.description,
          actionTaken: newIncident.actionTaken,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Laporan insiden berhasil dicatat.');
        setModalOpen(false);
        setNewIncident((prev) => ({ ...prev, description: '', actionTaken: '' }));
        fetchIncidents();
      } else {
        showToast(json.error || 'Gagal melaporkan insiden.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveAction.trim() || !resolveIncidentItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/proctor/incidents/${resolveIncidentItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTaken: resolveAction.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Insiden berhasil diselesaikan.');
        setResolveIncidentItem(null);
        setResolveAction('');
        fetchIncidents();
      } else {
        showToast(json.error || 'Gagal menyelesaikan insiden.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PengawasLayout
      title={`Log Insiden — ${examData?.exam?.title || 'Ujian'}`}
      subtitle="Catatan kendala teknis dan riwayat penanganan insiden khusus ujian ini."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: examData?.exam?.title || 'Detail Ujian', href: `/pengawas/exams/${examId}` },
        { label: 'Insiden' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/pengawas/exams/${examId}`}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Kembali
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            Lapor Insiden Baru
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Status Insiden:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Insiden</option>
              <option value="OPEN">OPEN (Belum Selesai)</option>
              <option value="RESOLVED">RESOLVED (Terselesaikan)</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total <strong>{incidents.length}</strong> Insiden pada Ujian Ini
          </div>
        </Card>

        {/* Incidents List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : incidents.length > 0 ? (
          <div className="space-y-4">
            {incidents.map((inc) => {
              const isResolved = inc.status === 'RESOLVED';
              const sevVariant =
                inc.severity === 'CRITICAL'
                  ? 'danger'
                  : inc.severity === 'WARNING'
                  ? 'warning'
                  : 'info';

              return (
                <Card
                  key={inc.id}
                  className={`p-5 bg-white border transition shadow-2xs space-y-3 ${
                    isResolved ? 'border-slate-200' : 'border-rose-200/90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={sevVariant} size="sm">
                        {inc.severity}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {inc.category}
                      </Badge>
                      <Badge variant={isResolved ? 'success' : 'danger'} size="sm">
                        {inc.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-400 font-mono">
                      {new Date(inc.createdAt).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">{inc.description}</p>
                    {inc.actionTaken && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <span className="font-bold text-slate-900">Tindakan Penanganan: </span>
                        {inc.actionTaken}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <span>Ruang: <strong className="text-slate-800">{inc.roomName}</strong></span>
                      <span>Pelapor: <strong className="text-slate-800">{inc.reportedByName}</strong></span>
                    </div>

                    {!isResolved && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setResolveIncidentItem(inc);
                          setResolveAction('');
                        }}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Tandai Selesai
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-white border-slate-200">
            <EmptyState
              title="Tidak ada insiden tercatat"
              description="Tidak ada kendala atau insiden aktif pada ujian ini."
            />
          </Card>
        )}

        {/* Modal Lapor Insiden Baru */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Lapor Insiden / Kendala Ruang"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Pilih Ruang Ujian:</label>
              <select
                value={newIncident.roomId}
                onChange={(e) => setNewIncident({ ...newIncident, roomId: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                {examData?.assignedRooms?.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kategori Kendala:</label>
                <select
                  value={newIncident.category}
                  onChange={(e) => setNewIncident({ ...newIncident, category: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="NETWORK_ISSUE">Gangguan Jaringan (Network)</option>
                  <option value="HARDWARE_ISSUE">Kendala Perangkat / PC</option>
                  <option value="POWER_OUTAGE">Pemadaman Listrik (Power)</option>
                  <option value="CHEATING_ATTEMPT">Dugaan Kecurangan</option>
                  <option value="OTHER">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tingkat Keparahan:</label>
                <select
                  value={newIncident.severity}
                  onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="LOW">LOW (Ringan)</option>
                  <option value="WARNING">WARNING (Sedang)</option>
                  <option value="CRITICAL">CRITICAL (Kritis / Mendesak)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Deskripsi Kejadian (Wajib):</label>
              <textarea
                rows={3}
                placeholder="Jelaskan kendala atau anomali yang terjadi secara faktual..."
                value={newIncident.description}
                onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tindakan Sementara (Opsional):</label>
              <textarea
                rows={2}
                placeholder="Langkah penanganan yang telah dilakukan jika ada..."
                value={newIncident.actionTaken}
                onChange={(e) => setNewIncident({ ...newIncident, actionTaken: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateIncident}
                isLoading={isSubmitting}
                disabled={!newIncident.description.trim()}
              >
                Catat Insiden
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal Resolve Incident */}
        <Modal
          isOpen={Boolean(resolveIncidentItem)}
          onClose={() => setResolveIncidentItem(null)}
          title="Selesaikan Insiden Ruang"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <span className="font-bold block mb-0.5">Deskripsi Masalah:</span>
              <p>{resolveIncidentItem?.description}</p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Tindakan Penanganan Akhir (Wajib Diisi):
              </label>
              <textarea
                rows={3}
                value={resolveAction}
                onChange={(e) => setResolveAction(e.target.value)}
                placeholder="Contoh: PC cadangan telah disiapkan dan siswa melanjutkan ujian..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setResolveIncidentItem(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResolve}
                isLoading={isSubmitting}
                disabled={!resolveAction.trim()}
              >
                Simpan & Tandai Selesai
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </PengawasLayout>
  );
}
