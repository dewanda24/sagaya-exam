'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  School,
  BookOpen,
  Award,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface SchoolBenchmark {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  rayon: string;
  level: string;
  totalParticipants: number;
  completedParticipants: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  kkmStatus: string;
}

interface RayonBenchmark {
  rayonName: string;
  schoolCount: number;
  totalParticipants: number;
  completedParticipants: number;
  avgScore: number;
  passRate: number;
}

interface GradeDist {
  gradeA: { count: number; percentage: number };
  gradeB: { count: number; percentage: number };
  gradeC: { count: number; percentage: number };
  gradeD: { count: number; percentage: number };
  totalGraded: number;
}

interface SubjectAbsorption {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examCount: number;
  testedCount: number;
  avgScore: number;
}

interface AnalyticsData {
  kkmRegional: number;
  schoolBenchmarks: SchoolBenchmark[];
  rayonBenchmarks: RayonBenchmark[];
  gradeDistribution: GradeDist;
  subjectAbsorption: SubjectAbsorption[];
  timestamp: string;
}

export default function SuperAdminAnalitikPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rayonFilter, setRayonFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [rayonFilter, levelFilter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = '/api/superadmin/regional-analytics';
      const params = new URLSearchParams();
      if (rayonFilter !== 'ALL') {
        params.set('rayon', rayonFilter);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [rayonFilter]);

  const handleExportCsv = async () => {
    setDownloadingCsv(true);
    try {
      let url = '/api/superadmin/regional-analytics?format=csv';
      if (rayonFilter !== 'ALL') {
        url += `&rayon=${encodeURIComponent(rayonFilter)}`;
      }
      window.open(url, '_blank');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setTimeout(() => setDownloadingCsv(false), 2000);
    }
  };

  // Filter schools by level client-side for smooth UI
  const filteredSchools = (data?.schoolBenchmarks || []).filter((s) => {
    if (levelFilter === 'ALL') return true;
    return s.level.toUpperCase() === levelFilter;
  });

  const paginatedSchools = filteredSchools.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Calculate aggregates
  const kkm = data?.kkmRegional || 75.0;
  const totalCompleted = filteredSchools.reduce((sum, s) => sum + s.completedParticipants, 0);
  const regionalAvg =
    filteredSchools.length > 0
      ? Math.round(
          (filteredSchools.reduce((sum, s) => sum + s.avgScore, 0) / filteredSchools.length) * 10
        ) / 10
      : 0;
  const passRateAvg =
    filteredSchools.length > 0
      ? Math.round(
          filteredSchools.reduce((sum, s) => sum + s.passRate, 0) / filteredSchools.length
        )
      : 0;

  const highestScoreOverall =
    filteredSchools.length > 0
      ? Math.max(...filteredSchools.map((s) => s.highestScore))
      : 0;
  const lowestScoreOverall =
    filteredSchools.length > 0
      ? Math.min(...filteredSchools.map((s) => (s.lowestScore > 0 ? s.lowestScore : 100)))
      : 0;

  const handleExportMasterLedger = () => {
    let url = '/api/superadmin/reports/master-export';
    const params = new URLSearchParams();
    if (rayonFilter !== 'ALL') params.set('rayon', rayonFilter);
    if (levelFilter !== 'ALL') params.set('level', levelFilter);
    if (params.toString()) url += `?${params.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <SuperAdminLayout
      title="Analitik Mutu & Daya Serap Wilayah"
      subtitle="Evaluasi pencapaian KKM, disparitas nilai sekolah, dan buku rekapitulasi nilai se-wilayah"
      actions={
        <div className="flex items-center gap-2">
          {/* Tombol Unduh Rekap Nilai Master */}
          <button
            onClick={handleExportMasterLedger}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            title="Unduh Rekap Nilai Gabungan Seluruh Siswa & Sekolah"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Rekap Master Nilai (CSV)</span>
          </button>

          <button
            onClick={fetchAnalytics}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter Bar (Bright & Crisp) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Filter Analisis:</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Rayon */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Rayon:</span>
              <select
                value={rayonFilter}
                onChange={(e) => setRayonFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">Semua Rayon / Kecamatan</option>
                <option value="Rayon 1 - Pusat">Rayon 1 - Pusat</option>
                <option value="Rayon 2 - Utara">Rayon 2 - Utara</option>
                <option value="Rayon 3 - Selatan">Rayon 3 - Selatan</option>
                <option value="Rayon 4 - Barat">Rayon 4 - Barat</option>
                <option value="Rayon 5 - Timur">Rayon 5 - Timur</option>
              </select>
            </div>

            {/* Jenjang */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Jenjang:</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">Semua Jenjang</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4 Primary Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Rata-rata Nilai Wilayah */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Rata-rata Nilai
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-800">
                {loading ? '...' : regionalAvg}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">
                (KKM: {kkm})
              </span>
              <p className="text-xs text-slate-500 mt-1">
                {regionalAvg >= kkm ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Memenuhi standar KKM
                  </span>
                ) : (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Di bawah standar KKM
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* 2. Tingkat Kelulusan KKM */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tingkat Ketuntasan
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-800">
                {loading ? '...' : passRateAvg}%
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Peserta mencapai nilai &ge; {kkm}
              </p>
            </div>
          </div>

          {/* 3. Total Peserta Selesai */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Peserta Diuji
              </span>
              <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                <School className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-slate-800">
                {loading ? '...' : totalCompleted.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-400 ml-1">peserta</span>
              <p className="text-xs text-slate-500 mt-1">
                Dari {filteredSchools.length} sekolah
              </p>
            </div>
          </div>

          {/* 4. Rentang Skor */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Disparitas Skor
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-500">Tertinggi:</span>
                <span className="text-lg font-bold text-slate-800">{highestScoreOverall}</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500">Terendah:</span>
                <span className="text-lg font-bold text-slate-800">{lowestScoreOverall < 100 ? lowestScoreOverall : 0}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gap rentang nilai wilayah
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Subject Absorption (Daya Serap) & Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Subject Absorption Bars */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Daya Serap Mata Pelajaran Wilayah
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nilai rata-rata capaian kurikulum per mata pelajaran
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Garis Target KKM: <strong>{kkm}</strong>
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Memuat daya serap mata pelajaran...
              </div>
            ) : !data?.subjectAbsorption || data.subjectAbsorption.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada data nilai mata pelajaran yang tercatat.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {data.subjectAbsorption.map((sub) => {
                  const pct = Math.min(100, Math.max(0, sub.avgScore));
                  const isPass = sub.avgScore >= kkm;

                  return (
                    <div key={sub.subjectId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {sub.subjectName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {sub.subjectCode}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({sub.testedCount} peserta)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800">
                            {sub.avgScore}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              isPass
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isPass ? 'Tuntas' : 'Perlu Bimbingan'}
                          </span>
                        </div>
                      </div>

                      {/* Bar with KKM marker */}
                      <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPass ? 'bg-sky-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 1 Col: Grade Distribution Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <BarChart3 className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Proporsi Grade Nilai
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Klasifikasi standar mutu kompetensi peserta:
              </p>

              <div className="mt-4 space-y-3 text-xs">
                {/* A */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <div className="flex justify-between font-bold text-emerald-900">
                    <span>Grade A (Sangat Baik &ge; 88)</span>
                    <span>{data?.gradeDistribution.gradeA.percentage || 0}%</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    {data?.gradeDistribution.gradeA.count || 0} peserta
                  </p>
                </div>

                {/* B */}
                <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
                  <div className="flex justify-between font-bold text-sky-900">
                    <span>Grade B (Baik 75 - 87)</span>
                    <span>{data?.gradeDistribution.gradeB.percentage || 0}%</span>
                  </div>
                  <p className="text-[11px] text-sky-700 mt-0.5">
                    {data?.gradeDistribution.gradeB.count || 0} peserta
                  </p>
                </div>

                {/* C */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>Grade C (Cukup 60 - 74)</span>
                    <span>{data?.gradeDistribution.gradeC.percentage || 0}%</span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {data?.gradeDistribution.gradeC.count || 0} peserta
                  </p>
                </div>

                {/* D */}
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                  <div className="flex justify-between font-bold text-rose-900">
                    <span>Grade D (Intervensi &lt; 60)</span>
                    <span>{data?.gradeDistribution.gradeD.percentage || 0}%</span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {data?.gradeDistribution.gradeD.count || 0} peserta
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center">
              Total peserta dinilai: <strong>{data?.gradeDistribution.totalGraded || 0}</strong>
            </div>
          </div>
        </div>

        {/* Full Table: School Performance Ranking & KKM Benchmark */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Peringkat & Capaian KKM Satuan Pendidikan ({filteredSchools.length} Sekolah)
              </h3>
              <p className="text-xs text-slate-500">
                Tolok ukur performa rata-rata terhadap standar kelulusan KKM {kkm}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Memuat peringkat performa sekolah...
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada data sekolah untuk filter yang dipilih.
            </div>
          ) : (
            <>
              <div className="w-full">
                <table className="w-full text-left text-xs table-fixed">
                  <thead>
                    <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-500 border-b border-slate-200/80">
                      <th className="py-3 px-4 sm:px-6 w-[28%]">Peringkat & Satuan Pendidikan</th>
                      <th className="py-3 px-2 w-[12%]">Rayon</th>
                      <th className="py-3 px-2 w-[8%]">Jenjang</th>
                      <th className="py-3 px-2 w-[10%]">Peserta</th>
                      <th className="py-3 px-2 w-[11%]">Rata Skor</th>
                      <th className="py-3 px-2 w-[11%]">Max / Min</th>
                      <th className="py-3 px-2 w-[10%]">Kelulusan</th>
                      <th className="py-3 px-4 sm:px-6 w-[10%] text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSchools.map((s, idx) => {
                      const rankNumber = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <tr key={s.schoolId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 sm:px-6 w-[28%]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                                  rankNumber === 1
                                    ? 'bg-amber-100 text-amber-800'
                                    : rankNumber === 2
                                    ? 'bg-slate-200 text-slate-700'
                                    : rankNumber === 3
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {rankNumber}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 truncate" title={s.schoolName}>
                                  {s.schoolName}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono truncate">
                                  NPSN: {s.schoolCode}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 w-[12%] text-slate-600 truncate" title={s.rayon}>
                            {s.rayon}
                          </td>
                          <td className="py-3.5 px-2 w-[8%]">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {s.level}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 w-[10%] font-semibold text-slate-700">
                            {s.completedParticipants} siswa
                          </td>
                          <td className="py-3.5 px-2 w-[11%]">
                            <span className="text-sm font-black text-slate-900">
                              {s.avgScore}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({s.avgScore >= kkm ? `+${(s.avgScore - kkm).toFixed(1)}` : (s.avgScore - kkm).toFixed(1)})
                            </span>
                          </td>
                          <td className="py-3.5 px-2 w-[11%] text-slate-600 text-[11px]">
                            <span className="text-emerald-700 font-semibold">{s.highestScore}</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-rose-700 font-semibold">{s.lowestScore}</span>
                          </td>
                          <td className="py-3.5 px-2 w-[10%]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                <div
                                  className="h-full bg-sky-500 rounded-full"
                                  style={{ width: `${Math.min(100, s.passRate)}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {s.passRate}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 w-[10%] text-right">
                            {s.kkmStatus === 'MEMENUHI_KKM' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" />
                                Memenuhi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 whitespace-nowrap">
                                <AlertCircle className="w-3 h-3" />
                                Di Bawah
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredSchools.length / pageSize) || 1}
                totalItems={filteredSchools.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="sekolah"
              />
            </>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
