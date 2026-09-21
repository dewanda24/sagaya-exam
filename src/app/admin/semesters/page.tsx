'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  Plus,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface SemesterRow {
  id: string;
  name: string;
  academicYearId: string;
  academicYearName: string;
  startDate?: string;
  endDate?: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}

export default function AdminSemestersPage() {
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Activate Semester Confirmation
  const [confirmTarget, setConfirmTarget] = useState<SemesterRow | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSemesters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/academic-years');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const years = json.data;
        setAcademicYears(years.map((y: any) => ({ id: y.id, name: y.name })));

        const flattened: SemesterRow[] = [];
        years.forEach((y: any) => {
          if (Array.isArray(y.semesters)) {
            y.semesters.forEach((s: any) => {
              flattened.push({
                id: s.id,
                name: s.name,
                academicYearId: y.id,
                academicYearName: y.name,
                startDate: y.startDate,
                endDate: y.endDate,
                status: s.status || 'DRAFT',
              });
            });
          }
        });
        setSemesters(flattened);
      } else {
        showNotification(json.error || 'Gagal memuat data semester.', 'error');
      }
    } catch {
      showNotification('Koneksi server gagal.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  const handleActivateConfirm = async () => {
    if (!confirmTarget) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SEMESTER',
          semesterId: confirmTarget.id,
          semesterStatus: 'ACTIVE',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`Semester "${confirmTarget.name}" (${confirmTarget.academicYearName}) berhasil diaktifkan.`);
        setConfirmTarget(null);
        fetchSemesters();
      } else {
        showNotification(json.error || 'Gagal mengaktifkan semester.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredData = selectedYearId
    ? semesters.filter((s) => s.academicYearId === selectedYearId)
    : semesters;

  const columns: ColumnDef<SemesterRow>[] = [
    {
      key: 'name',
      header: 'Semester',
      cell: (row) => (
        <div className="font-bold text-slate-900 text-sm">
          {row.name}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'academicYearName',
      header: 'Tahun Ajaran',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {row.academicYearName}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'startDate',
      header: 'Tanggal Mulai',
      cell: (row) => (
        <span className="text-xs text-slate-600">
          {row.startDate ? new Date(row.startDate).toLocaleDateString('id-ID') : 'TBD'}
        </span>
      ),
    },
    {
      key: 'endDate',
      header: 'Tanggal Selesai',
      cell: (row) => (
        <span className="text-xs text-slate-600">
          {row.endDate ? new Date(row.endDate).toLocaleDateString('id-ID') : 'TBD'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortable: true,
    },
    {
      key: 'actions',
      header: <span className="text-right block">Aksi</span>,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status !== 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ToggleLeft className="w-4 h-4 text-blue-600" />}
              onClick={() => setConfirmTarget(row)}
            >
              Aktifkan
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Berjalan
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Semester"
      subtitle="Kelola status semester aktif dan siklus perkuliahan/sekolah"
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Sekolah', href: '/admin/school' },
        { label: 'Semester' },
      ]}
      actions={
        <Link href="/admin/academic-years">
          <Button variant="primary" size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
            Kelola Tahun Ajaran
          </Button>
        </Link>
      }
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Filter Tahun Ajaran:</span>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Tahun Ajaran ({academicYears.length})</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total <strong>{filteredData.length}</strong> semester terdaftar
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <DataTable
            data={filteredData}
            columns={columns}
            isLoading={loading}
            emptyTitle="Belum Ada Semester"
            emptyDescription="Silakan buat tahun ajaran baru terlebih dahulu untuk menginisiasi semester."
            pageSize={10}
            itemName="semester"
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleActivateConfirm}
        title="Aktifkan Semester"
        description={`Apakah Anda yakin ingin mengaktifkan "${confirmTarget?.name}" untuk Tahun Ajaran ${confirmTarget?.academicYearName}? Semester aktif lainnya pada tahun ajaran ini akan dialihkan menjadi CLOSED.`}
        confirmLabel={isUpdating ? 'Memproses...' : 'Ya, Aktifkan'}
        cancelLabel="Batal"
        confirmVariant="warning"
        isLoading={isUpdating}
      />
    </AdminLayout>
  );
}
