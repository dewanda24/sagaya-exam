'use client';

import { useState, useEffect } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Filter,
  Download,
  Eye,
  Calendar,
  Building2,
  Shield,
  Clock,
  Laptop,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface AuditItem {
  id: string;
  userId?: string;
  actorName: string;
  actorRole?: string;
  schoolId?: string;
  schoolName: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Selected Log Inspector Modal
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/superadmin/audit?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, roleFilter, severityFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadAuditLogs();
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ['ID', 'Waktu', 'Aktor', 'Peran', 'Satuan Pendidikan', 'Aksi', 'Resource', 'Resource ID', 'Tingkat', 'IP'];
    const rows = logs.map((l) => [
      l.id,
      new Date(l.createdAt).toISOString(),
      `"${l.actorName.replace(/"/g, '""')}"`,
      l.actorRole || '',
      `"${l.schoolName.replace(/"/g, '""')}"`,
      l.action,
      l.resourceType || '',
      l.resourceId || '',
      l.severity,
      l.ipAddress || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sagaya_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SuperAdminLayout
      title="Audit Trail Terpadu (Audit Center)"
      subtitle="Pusat rekam jejak aktivitas, mutasi data, dan kepatuhan sistem yang bersifat kekal (Immutable)"
      actions={
        <button
          onClick={handleExportCSV}
          disabled={logs.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-sky-600" />
          <span>Ekspor CSV</span>
        </button>
      }
    >
      <div className="space-y-5">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari aksi, nama aktor, sekolah, atau ID resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 text-slate-800"
              />
            </form>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Tingkat</option>
                <option value="INFO">Informasi (INFO)</option>
                <option value="WARNING">Peringatan (WARNING)</option>
                <option value="CRITICAL">Kritis (CRITICAL)</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Peran</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin Sekolah</option>
                <option value="GURU">Guru</option>
                <option value="PENGAWAS">Pengawas</option>
              </select>

              <button
                onClick={loadAuditLogs}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="text-[11px] font-bold text-slate-400">Rentang Waktu:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
            />
            <span>s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-rose-600 hover:underline font-semibold ml-2"
              >
                Hapus Filter Tanggal
              </button>
            )}
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-3">Tingkat</th>
                  <th className="py-3 px-3">Aksi Audit</th>
                  <th className="py-3 px-3">Aktor Pelaksana</th>
                  <th className="py-3 px-3">Satuan Pendidikan</th>
                  <th className="py-3 px-3">Resource Target</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                      Memuat data log audit...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 text-xs">
                      Tidak ada catatan audit yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.severity === 'WARNING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 font-mono text-[11px]">{log.action}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-semibold text-slate-800">{log.actorName}</p>
                        <span className="text-[10px] text-slate-400">{log.actorRole || 'Sistem'}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 truncate max-w-[160px]">
                        {log.schoolName}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500">
                        {log.resourceType ? (
                          <span className="font-mono text-[11px] text-slate-700">
                            {log.resourceType} {log.resourceId ? `#${log.resourceId.slice(0, 8)}` : ''}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                          title="Inspeksi Metadata Event"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {logs.length} dari {totalCount} log audit
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>

        {/* Modal: Audit Event Detail Inspector */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-sky-600" />
                    Inspektor Rekam Jejak Audit
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {selectedLog.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Waktu Kejadian:</span>
                    <p className="font-semibold text-slate-800">{new Date(selectedLog.createdAt).toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tingkat Severity:</span>
                    <p className="font-bold text-slate-800">{selectedLog.severity}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Aktor Pelaksana:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.actorName} ({selectedLog.actorRole || 'Sistem'})</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Satuan Pendidikan:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.schoolName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">IP Address:</span>
                    <p className="font-mono text-slate-800">{selectedLog.ipAddress || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target Resource:</span>
                    <p className="font-mono text-slate-800">{selectedLog.resourceType || '-'} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ''}</p>
                  </div>
                </div>

                {selectedLog.userAgent && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">User Agent Browser:</span>
                    <p className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                      {selectedLog.userAgent}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Metadata Detail (JSON):</span>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-56">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
