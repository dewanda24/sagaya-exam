'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  FileCheck2,
  Printer,
  Calendar,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  UserCheck,
  ClipboardList,
  Edit3,
} from 'lucide-react';

interface StudentCard {
  id: string;
  name: string;
  nis: string;
  nisn: string;
  classId: string;
  className: string;
  cardCode: string;
  examTitle: string;
  subject: string;
  date: string;
  token: string;
  assignedPackage: string;
}

interface ExamMeta {
  id: string;
  title: string;
  date: string;
  schoolName: string;
  schoolLogo: string;
  schoolAddress: string;
  headerTitle1: string;
  headerTitle2: string;
  principalName: string;
  principalNip: string;
}

function BeritaAcaraContent() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get('examId') || '';

  const [activeTab, setActiveTab] = useState<'BAPU' | 'PRESENSI'>('BAPU');
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [availableExams, setAvailableExams] = useState<{ id: string; title: string }[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [availableRooms, setAvailableRooms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [currentExamId, setCurrentExamId] = useState(initialExamId);
  const [currentClassId, setCurrentClassId] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [currentSessionNumber, setCurrentSessionNumber] = useState('');
  const [loading, setLoading] = useState(true);

  // Form states for BAPU
  const [roomName, setRoomName] = useState('Lab Komputer 1');
  const [sessionNumber, setSessionNumber] = useState('Sesi 1 (07:30 - 09:30)');
  const [examDateStr, setExamDateStr] = useState(
    new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );
  const [proctorName, setProctorName] = useState('Pengawas Ruang Ujian');
  const [proctorNip, setProctorNip] = useState('-');
  const [supervisorName, setSupervisorName] = useState('Kepala Satuan Pendidikan');
  const [supervisorNip, setSupervisorNip] = useState('-');
  const [incidentNotes, setIncidentNotes] = useState(
    'Pelaksanaan ujian berlangsung tertib, lancar, dan aman. Seluruh perangkat komputer siswa berfungsi normal tanpa gangguan jaringan yang berarti.'
  );
  const [absentNotes, setAbsentNotes] = useState('-');

  const fetchData = async (examId?: string, classId?: string, roomId?: string, session?: string) => {
    setLoading(true);
    try {
      let url = '/api/admin/print-cards';
      const params = new URLSearchParams();
      if (examId) params.append('examId', examId);
      if (classId) params.append('classId', classId);
      if (roomId) params.append('roomId', roomId);
      if (session) params.append('sessionNumber', session);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setExam(data.data.exam);
        setStudents(data.data.cards || []);
        setAvailableExams(data.data.availableExams || []);
        setAvailableClasses(data.data.availableClasses || []);
        setAvailableRooms(data.data.availableRooms || []);
        if (data.data.exam?.id) {
          setCurrentExamId(data.data.exam.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentExamId || initialExamId, currentClassId, currentRoomId, currentSessionNumber);
  }, [initialExamId, currentClassId, currentRoomId, currentSessionNumber]);

  const handlePrint = () => {
    window.print();
  };

  const totalRegistered = students.length;

  return (
    <AdminLayout>
      {/* Screen Control Panel (Hidden during Print) */}
      <div className="print:hidden space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Berita Acara & Presensi Ujian
              </h1>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Admin Sekolah
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Dokumen administrasi resmi pelaksanaan ujian CBT: Berita Acara Pelaksanaan Ujian (BAPU) dan Daftar Hadir Peserta format zig-zag.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switchers */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('BAPU')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'BAPU'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Berita Acara (BAPU)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PRESENSI')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'PRESENSI'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Hadir (Presensi)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen (A4)</span>
            </button>
          </div>
        </div>

        {/* Configuration Toolbar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Jadwal Ujian:
              </label>
              <select
                value={currentExamId}
                onChange={(e) => {
                  setCurrentExamId(e.target.value);
                  fetchData(e.target.value, currentClassId);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {availableExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Filter Rombel / Kelas:
              </label>
              <select
                value={currentClassId}
                onChange={(e) => {
                  setCurrentClassId(e.target.value);
                  fetchData(currentExamId, e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">Semua Rombel Terdaftar</option>
                {availableClasses.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Pilih Ruang / Lab:
              </label>
              <select
                value={currentRoomId}
                onChange={(e) => {
                  const rId = e.target.value;
                  setCurrentRoomId(rId);
                  const found = availableRooms.find((r) => r.id === rId);
                  if (found) setRoomName(found.name);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">Semua Ruangan</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Pilih Sesi Ujian:
              </label>
              <select
                value={currentSessionNumber}
                onChange={(e) => {
                  const sNum = e.target.value;
                  setCurrentSessionNumber(sNum);
                  if (sNum) setSessionNumber(`Sesi ${sNum}`);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="">Semua Sesi</option>
                <option value="1">Sesi 1 (07:30 - 09:30)</option>
                <option value="2">Sesi 2 (10:00 - 12:00)</option>
                <option value="3">Sesi 3 (13:00 - 15:00)</option>
              </select>
            </div>
          </div>

          {activeTab === 'BAPU' && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Nama Pengawas Ruang:
                </label>
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  NIP Pengawas:
                </label>
                <input
                  type="text"
                  value={supervisorNip}
                  onChange={(e) => setSupervisorNip(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Nama Proktor CBT:
                </label>
                <input
                  type="text"
                  value={proctorName}
                  onChange={(e) => setProctorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  NIP Proktor:
                </label>
                <input
                  type="text"
                  value={proctorNip}
                  onChange={(e) => setProctorNip(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Catatan Kejadian Penting Selama Ujian:
                </label>
                <input
                  type="text"
                  value={incidentNotes}
                  onChange={(e) => setIncidentNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Keterangan Tidak Hadir:
                </label>
                <input
                  type="text"
                  value={absentNotes}
                  onChange={(e) => setAbsentNotes(e.target.value)}
                  placeholder="Nihil (Hadir Semua)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Notification */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <span>
              <strong>Pratinjau Dokumen Cetak:</strong> Format di bawah adalah representasi persis dari kertas A4 yang akan dicetak oleh printer.
            </span>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="text-blue-700 font-bold hover:underline flex items-center gap-1"
          >
            <span>Buka Dialog Cetak</span>
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PRINTABLE A4 CANVAS (Rendered on screen & print) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-8 sm:p-12 my-6 max-w-4xl mx-auto font-sans text-black print:p-0 print:m-0 print:border-none print:shadow-none">
        {/* Kop Surat Resmi */}
        <div className="border-b-2 border-black pb-3 mb-6 text-center">
          {exam?.headerTitle1 ? (
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-gray-800">
              {exam.headerTitle1}
            </h3>
          ) : null}
          {exam?.headerTitle2 ? (
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">
              {exam.headerTitle2}
            </h2>
          ) : null}
          <h1 className="text-xl font-black uppercase tracking-wider mt-0.5">
            {exam?.schoolName || 'SMA NEGERI 1 SAGAYA'}
          </h1>
          <p className="text-[11px] text-gray-700 mt-1 italic">
            {exam?.schoolAddress || 'Jl. Pendidikan No. 45, Sagaya • Email: info@sagaya.sch.id'}
          </p>
        </div>

        {activeTab === 'BAPU' ? (
          /* ==================== BERITA ACARA (BAPU) ==================== */
          <div>
            <div className="text-center mb-6">
              <h2 className="text-base font-black uppercase underline tracking-wider">
                BERITA ACARA PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)
              </h2>
              <p className="text-xs text-gray-700 font-semibold mt-0.5">
                TAHUN AJARAN {new Date().getFullYear()} / {new Date().getFullYear() + 1}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-justify mb-4">
              Pada hari ini <strong>{examDateStr}</strong>, telah diselenggarakan Ujian Berbasis Komputer (Computer Based Test - Sagaya CBT) di <strong>{exam?.schoolName}</strong> dengan rincian data sebagai berikut:
            </p>

            <table className="w-full text-xs border-collapse border border-black mb-6">
              <tbody>
                <tr>
                  <td className="w-48 border border-black p-2 font-bold bg-gray-50">1. Mata Pelajaran</td>
                  <td className="border border-black p-2 font-semibold">
                    {students[0]?.subject || exam?.title}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">2. Judul Paket Ujian</td>
                  <td className="border border-black p-2">{exam?.title}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">3. Tempat / Ruang Ujian</td>
                  <td className="border border-black p-2 font-semibold">{roomName}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">4. Sesi & Waktu Ujian</td>
                  <td className="border border-black p-2">{sessionNumber}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">5. Jumlah Peserta Seharusnya</td>
                  <td className="border border-black p-2">
                    <strong>{totalRegistered}</strong> Orang Siswa
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">6. Jumlah Peserta Hadir</td>
                  <td className="border border-black p-2">
                    <strong>{totalRegistered}</strong> Orang Siswa
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold bg-gray-50">7. Jumlah Tidak Hadir</td>
                  <td className="border border-black p-2 font-mono">{absentNotes}</td>
                </tr>
              </tbody>
            </table>

            {/* Incident Record */}
            <div className="border border-black p-3 rounded-none mb-8 text-xs">
              <span className="font-bold block mb-1 underline">
                CATATAN KHUSUS / KEJADIAN SELAMA UJIAN:
              </span>
              <p className="italic text-gray-800 leading-relaxed min-h-[40px]">
                "{incidentNotes}"
              </p>
            </div>

            <p className="text-xs mb-10 text-justify">
              Demikian Berita Acara ini dibuat dengan sesungguhnya dan ditandatangani oleh Pengawas Ruang dan Proktor untuk dipergunakan sebagaimana mestinya.
            </p>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 text-xs text-center">
              <div>
                <p>Pengawas Ruang,</p>
                <div className="h-24" />
                <p className="font-bold underline uppercase">{supervisorName}</p>
                <p className="text-[11px]">NIP. {supervisorNip}</p>
              </div>

              <div>
                <p>Proktor Ujian,</p>
                <div className="h-24" />
                <p className="font-bold underline uppercase">{proctorName}</p>
                <p className="text-[11px]">NIP. {proctorNip}</p>
              </div>
            </div>

            <div className="text-center text-xs mt-8">
              <p>Mengetahui,</p>
              <p className="font-bold">Kepala Sekolah</p>
              <div className="h-20" />
              <p className="font-bold underline uppercase">
                {exam?.principalName || 'Drs. H. Mulyadi, M.Pd.'}
              </p>
              <p className="text-[11px]">NIP. {exam?.principalNip || '19680514 199303 1 005'}</p>
            </div>
          </div>
        ) : (
          /* ==================== DAFTAR HADIR (PRESENSI) ==================== */
          <div>
            <div className="text-center mb-6">
              <h2 className="text-base font-black uppercase underline tracking-wider">
                DAFTAR HADIR PESERTA ASESMEN / UJIAN
              </h2>
              <p className="text-xs text-gray-700 font-semibold mt-0.5">
                MATA PELAJARAN: {students[0]?.subject || exam?.title} • {sessionNumber}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
              <div>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="w-24 font-bold py-0.5">Hari / Tanggal</td>
                      <td>: {examDateStr}</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Ruang / Lab</td>
                      <td>: {roomName}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="w-28 font-bold py-0.5">Jumlah Peserta</td>
                      <td>: {students.length} Siswa Terdaftar</td>
                    </tr>
                    <tr>
                      <td className="font-bold py-0.5">Paket Ujian</td>
                      <td>: {exam?.title}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2-Column Zig-Zag Signature Table */}
            <table className="w-full border-collapse border border-black text-[11px] mb-8">
              <thead>
                <tr className="bg-gray-100 text-center font-bold">
                  <th className="border border-black px-2 py-1.5 w-10">No</th>
                  <th className="border border-black px-2 py-1.5 w-24">NISN</th>
                  <th className="border border-black px-3 py-1.5 text-left">Nama Lengkap Peserta</th>
                  <th className="border border-black px-2 py-1.5 w-20">Kelas</th>
                  <th className="border border-black px-2 py-1.5 w-44" colSpan={2}>
                    Tanda Tangan Peserta
                  </th>
                  <th className="border border-black px-2 py-1.5 w-16">Ket</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => {
                  const num = idx + 1;
                  const isOdd = num % 2 !== 0;

                  return (
                    <tr key={st.id}>
                      <td className="border border-black px-2 py-2 text-center">{num}</td>
                      <td className="border border-black px-2 py-2 text-center font-mono">{st.nisn || '-'}</td>
                      <td className="border border-black px-3 py-2 font-bold">{st.name}</td>
                      <td className="border border-black px-2 py-2 text-center">{st.className}</td>

                      {/* Zig-zag signature columns */}
                      {isOdd ? (
                        <>
                          <td className="border border-black px-2 py-2 w-24 align-top text-left">
                            <span className="text-[10px] text-gray-500 font-bold block">{num}.</span>
                            <div className="h-6" />
                          </td>
                          <td className="border border-black px-2 py-2 w-24 bg-gray-50/50" />
                        </>
                      ) : (
                        <>
                          <td className="border border-black px-2 py-2 w-24 bg-gray-50/50" />
                          <td className="border border-black px-2 py-2 w-24 align-top text-left">
                            <span className="text-[10px] text-gray-500 font-bold block">{num}.</span>
                            <div className="h-6" />
                          </td>
                        </>
                      )}

                      <td className="border border-black px-2 py-2 text-center text-[10px]" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Presensi Footer Signatures */}
            <div className="grid grid-cols-2 gap-8 text-xs text-center pt-4">
              <div>
                <p>Pengawas Ruang,</p>
                <div className="h-20" />
                <p className="font-bold underline uppercase">{supervisorName}</p>
                <p className="text-[11px]">NIP. {supervisorNip}</p>
              </div>

              <div>
                <p>Proktor CBT,</p>
                <div className="h-20" />
                <p className="font-bold underline uppercase">{proctorName}</p>
                <p className="text-[11px]">NIP. {proctorNip}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function BeritaAcaraPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Memuat Dokumen Berita Acara...</div>}>
      <BeritaAcaraContent />
    </Suspense>
  );
}
