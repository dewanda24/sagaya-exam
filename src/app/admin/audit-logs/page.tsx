'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  FileCheck2,
  Search,
  Filter,
  Clock,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  userId: string;
  userFullName: string;
  username: string;
  role: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  schoolId?: string;
  schoolName: string;
  schoolCode?: string;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      params.set('page', currentPage.toString());
      params.set('limit', pageSize.toString());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setTotalPages(data.data.totalPages || 1);
        setTotalCount(data.data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs();
  };

  const getActionBadgeVariant = (action: string): BadgeVariant => {
    if (action.includes('RESET') || action.includes('UNLOCK')) return 'warning';
    if (action.includes('FORCE') || action.includes('DELETE') || action.includes('VOID')) return 'danger';
    if (action.includes('CREATE') || action.includes('LOGIN') || action.includes('ADD_TIME')) return 'success';
    return 'info';
  };

  const breadcrumbs = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Sistem' },
    { label: 'Audit Log' },
  ];

  const columns: ColumnDef<AuditLogItem>[] = [
    {
      key: 'createdAt',
      header: 'Waktu',
      cell: (r: AuditLogItem) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}</span>
        </div>
      ),
      className: 'w-44',
    },
    {
      key: 'user',
      header: 'Pengguna',
      cell: (r: AuditLogItem) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{r.userFullName}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            {r.username} &bull; <span className="uppercase text-violet-600 font-medium">{r.role}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aksi / Tindakan',
      cell: (r: AuditLogItem) => (
        <div className="flex items-center gap-2">
          <Badge variant={getActionBadgeVariant(r.action)}>
            {r.action}
          </Badge>
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Alamat IP',
      cell: (r: AuditLogItem) => (
        <span className="text-xs font-mono text-slate-500">{r.ipAddress || '—'}</span>
      ),
      className: 'w-32',
    },
    {
      key: 'actions',
      header: 'Detail',
      cell: (r: AuditLogItem) => (
        <button
          onClick={() => setSelectedLog(r)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Lihat</span>
        </button>
      ),
      className: 'w-24 text-right',
    },
  ];

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Audit Forensik Sekolah
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Rekam jejak seluruh tindakan pengawas, operator, dan staf di lingkungan satuan pendidikan Anda ({totalCount} entri).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Muat Ulang
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="mb-6">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aksi, pengguna, atau isi log..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
            />
          </form>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 font-semibold"
              >
                <option value="">Semua Jenis Aksi</option>
                <option value="AUTH_LOGIN">Login Berhasil</option>
                <option value="AUTH_LOGOUT">Logout</option>
                <option value="PROCTOR_RESET_DEVICE">Reset Perangkat Siswa</option>
                <option value="PROCTOR_ADD_TIME">Penambahan Waktu</option>
                <option value="PROCTOR_FORCE_SUBMIT">Selesaikan Paksa</option>
                <option value="EXAM_STATUS_CHANGE">Perubahan Status Ujian</option>
                <option value="STUDENT_IMPORT">Impor Data Siswa</option>
                <option value="RESULT_RECALCULATE">Kalkulasi Ulang Nilai</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <DataTable
        data={logs}
        columns={columns}
        isLoading={loading}
        emptyTitle="Belum Ada Log"
        emptyDescription="Belum ada rekam jejak audit yang sesuai dengan filter pencarian."
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2 text-xs text-slate-500">
          <div>
            Halaman <span className="font-semibold text-slate-900">{currentPage}</span> dari{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span> ({totalCount} log total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* Modal Detail Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rincian Log Forensik</h3>
                  <p className="text-[11px] text-slate-400">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Aksi:</span>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Waktu Kejadian:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedLog.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Pelaku (User):</span>
                  <span className="font-semibold text-slate-800">{selectedLog.userFullName}</span>
                  <span className="text-slate-500 block">@{selectedLog.username} ({selectedLog.role})</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Alamat IP:</span>
                  <span className="font-mono text-slate-800">{selectedLog.ipAddress || 'Tidak tercatat'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-xs block mb-1.5 font-semibold">Metadata / Payload JSON:</span>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
