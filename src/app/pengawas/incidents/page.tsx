'use client';

import { useState, useEffect, useCallback } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
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
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProctorIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Resolve Incident Modal
  const [resolveIncidentItem, setResolveIncidentItem] = useState<any>(null);
  const [resolveAction, setResolveAction] = useState('');

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/proctor/incidents?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setIncidents(json.data || []);
      }
    } catch {
      showToast('Gagal memuat insiden.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

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
      showToast('Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PengawasLayout
      title="Pusat Insiden & Kendala Ujian"
      subtitle="Pencatatan, pelaporan kendala teknis, dan resolusi penanganan insiden ruang ujian."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Pusat Insiden' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchIncidents}
          isLoading={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Segarkan
        </Button>
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
            Total <strong>{incidents.length}</strong> Insiden Tercatat
          </div>
        </Card>

        {/* Incident Cards List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-white border border-slate-200" />
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
                    <div className="flex flex-wrap items-center gap-4">
                      <span>Ujian: <strong className="text-slate-800">{inc.examTitle}</strong></span>
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
              description="Operasional seluruh ruang pengawasan berjalan kondusif tanpa kendala aktif."
            />
          </Card>
        )}

        {/* Modal Resolve Incident */}
        <Modal
          isOpen={Boolean(resolveIncidentItem)}
          onClose={() => setResolveIncidentItem(null)}
          title="Selesaikan Insiden Ruang Ujian"
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
                placeholder="Contoh: Perangkat switch telah direstart dan koneksi seluruh peserta pulih normal..."
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

        {/* Floating Toast Notification */}
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
