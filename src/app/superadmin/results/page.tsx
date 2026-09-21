'use client';

import { useState, useEffect } from 'react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import {
  Award,
  Download,
  Search,
  School,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Calendar,
  Building2,
  ChevronRight,
  TrendingUp,
  RotateCw,
  FileSpreadsheet,
} from 'lucide-react';

interface ResultItem {
  resultId: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  studentId: string;
  studentName: string;
  nisn: string;
  nis: string;
  className: string;
  finalScore: number;
  percentage: number;
  passingGrade: number;
  isPassed: boolean;
  status: string;
  publishedAt: string | null;
  gradedAt: string | null;
}

export default function SuperAdminResultsPage() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [schools, setSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (selectedSchoolId) q.set('schoolId', selectedSchoolId);
      if (selectedStatus) q.set('status', selectedStatus);
      if (search) q.set('search', search);

      const res = await fetch(`/api/superadmin/results?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setResults(json.data.results || []);
        setTotal(json.data.total || 0);
        if (json.data.schools) setSchools(json.data.schools);
      } else {
        setError(json.error || 'Gagal memuat rekap nilai platform.');
      }
    } catch (err: any) {
      setError(err.message || 'Koneksi jaringan terputus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [selectedSchoolId, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults();
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Award className="w-4 h-4" />
              National & Cross-School Intelligence
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Rekapitulasi Hasil Asesmen Lintas Sekolah
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Pantau seluruh capaian skor peserta didik, status publikasi, dan verifikasi nilai di seluruh tenant sekolah terdaftar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchResults}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
            <a
              href="/api/superadmin/reports/master-export"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Master Export (CSV)
            </a>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Section */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Sekolah</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Seluruh Sekolah</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Status Hasil</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Semua Status</option>
                <option value="PUBLISHED">PUBLISHED (Terbit)</option>
                <option value="GRADED">GRADED (Selesai Dinilai)</option>
                <option value="REVIEWED">REVIEWED (Telah Direview)</option>
                <option value="VOID">VOID (Dibatalkan)</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">Pencarian Siswa / Sekolah</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ketik nama siswa, NISN, atau sekolah..."
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  Cari
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Results Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-200">
              Menampilkan {results.length} dari {total} total rekap nilai
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="p-4">Peserta Didik</th>
                  <th className="p-4">Sekolah & Rombel</th>
                  <th className="p-4">Asesmen / Ujian</th>
                  <th className="p-4 text-right">Skor Akhir</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Waktu Terbit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Memuat data nilai platform...
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 italic">
                      Tidak ada data hasil ujian yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.resultId} className="hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <div className="font-bold text-white">{r.studentName}</div>
                        <div className="text-xs text-slate-400 font-mono">NISN: {r.nisn || '-'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span>{r.schoolName}</span>
                        </div>
                        <div className="text-xs text-slate-400">Kelas: {r.className}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{r.examTitle}</div>
                        <div className="text-xs text-slate-400">{r.subjectName}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-mono text-base font-bold text-white">
                          {Number(r.finalScore).toFixed(1)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {Number(r.percentage).toFixed(0)}% (KKM: {r.passingGrade})
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            r.status === 'PUBLISHED'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                              : r.status === 'VOID'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400 font-mono">
                        {r.publishedAt ? new Date(r.publishedAt).toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
