'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Printer,
  ArrowLeft,
  GraduationCap,
  Building2,
  Sparkles,
  QrCode,
  Filter,
  CheckCircle2,
  DoorOpen,
  Clock,
} from 'lucide-react';
import QRCode from 'qrcode';

interface StudentCardItem {
  id: string;
  name: string;
  nis: string;
  nisn: string;
  className: string;
  cardCode: string;
  examTitle: string;
  subject: string;
  date: string;
  token: string;
  assignedPackage?: string;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  sessionNumber?: number;
  seatNumber?: string;
  qrUrl?: string;
}

interface ExamHeaderInfo {
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

export default function CetakKartuMassalPage() {
  const [cards, setCards] = useState<StudentCardItem[]>([]);
  const [examInfo, setExamInfo] = useState<ExamHeaderInfo | null>(null);
  const [availableExams, setAvailableExams] = useState<{ id: string; title: string }[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [availableRooms, setAvailableRooms] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCards = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/print-cards';
      const params = new URLSearchParams();
      if (selectedExamId) params.set('examId', selectedExamId);
      if (selectedClassId) params.set('classId', selectedClassId);
      if (selectedRoomId) params.set('roomId', selectedRoomId);
      if (selectedSession) params.set('sessionNumber', selectedSession);

      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setExamInfo(json.data.exam);
        setAvailableExams(json.data.availableExams || []);
        setAvailableClasses(json.data.availableClasses || []);
        setAvailableRooms(json.data.availableRooms || []);

        // Generate QR Codes
        const withQr = await Promise.all(
          (json.data.cards || []).map(async (c: any) => {
            const qr = await QRCode.toDataURL(
              `SAGAYA:${c.nisn}:${c.token || c.cardCode || 'PIN'}`,
              {
                width: 96,
                margin: 1,
                color: { dark: '#0f172a', light: '#ffffff' },
              }
            );
            return { ...c, qrUrl: qr };
          })
        );
        setCards(withQr);
      }
    } catch (err) {
      console.error('Gagal memuat kartu cetak:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [selectedExamId, selectedClassId, selectedRoomId, selectedSession]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, header, aside, button, nav {
            display: none !important;
          }
          .print-grid-a4 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .exam-card-wrapper {
            border: 1.5px dashed #64748b !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
            padding: 12px !important;
          }
        }
      `}</style>

      {/* Header Toolbar (Hidden during print) */}
      <div className="no-print mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/ujian"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <span>Cetak Kartu Peserta A4 Massal</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  4 - 8 Kartu / Lembar
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Dilengkapi Logo, Kop Resmi Sekolah, QR-Code Scan, Ruang Lab, Sesi, dan Nomor Meja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={cards.length === 0 || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak ke Printer / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Exam */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Ujian:</span>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                {availableExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Class */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Kelas:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                <option value="">Semua Kelas</option>
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Room */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Ruangan:</span>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                <option value="">Semua Ruang / Lab</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Session */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Sesi:</span>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
              >
                <option value="">Semua Sesi</option>
                <option value="1">Sesi 1</option>
                <option value="2">Sesi 2</option>
                <option value="3">Sesi 3</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Total Kartu: <strong className="text-slate-900">{cards.length}</strong> (± {Math.ceil(cards.length / 4)} Lembar A4)
          </div>
        </div>
      </div>

      {/* Printable Sheet (Grid 2x2 for standard A4) */}
      <div className="max-w-[850px] mx-auto">
        {loading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-500 text-sm border border-slate-200">
            Menyiapkan kartu ujian massal & QR Code...
          </div>
        ) : cards.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-500 border border-slate-200">
            <Printer className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-800 text-base">Tidak Ada Peserta Ujian</div>
            <p className="text-xs text-slate-400 mt-1">
              Pastikan jadwal ujian telah dialokasikan ke siswa di satuan pendidikan ini.
            </p>
          </div>
        ) : (
          <div className="print-grid-a4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((c) => (
              <div
                key={c.id}
                className="exam-card-wrapper bg-white border border-slate-300 rounded-xl p-4 flex flex-col justify-between shadow-2xs relative print:shadow-none print:border-dashed print:border-slate-400"
                style={{ breakInside: 'avoid' }}
              >
                {/* Kop Surat Resmi Lembaga */}
                <div className="flex items-center gap-2.5 pb-2.5 mb-2.5 border-b-2 border-slate-800">
                  <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shrink-0">
                    {examInfo?.schoolLogo ? (
                      <img src={examInfo.schoolLogo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <GraduationCap className="w-6 h-6 text-slate-700" />
                    )}
                  </div>
                  <div className="text-center flex-1 leading-tight">
                    {examInfo?.headerTitle1 ? (
                      <div className="text-[9px] font-extrabold text-slate-600 uppercase tracking-tight">
                        {examInfo.headerTitle1}
                      </div>
                    ) : null}
                    {examInfo?.headerTitle2 ? (
                      <div className="text-[9px] font-bold text-slate-700 uppercase tracking-tight">
                        {examInfo.headerTitle2}
                      </div>
                    ) : null}
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight mt-0.5">
                      {examInfo?.schoolName || 'SMA NEGERI 1 SAGAYA'}
                    </div>
                    <div className="text-[8px] text-slate-500 line-clamp-1 mt-0.5">
                      {examInfo?.schoolAddress || 'KARTU RESMI PESERTA UJIAN ONLINE BERBASIS KOMPUTER (CBT)'}
                    </div>
                  </div>
                </div>

                {/* Subheader: Judul Kartu + Room / Seat Badge */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-black text-slate-800 uppercase px-2 py-0.5 bg-slate-100 rounded tracking-wider border border-slate-200">
                    KARTU PESERTA UJIAN
                  </span>

                  <span className="text-[10px] font-black text-blue-700 uppercase px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                    {c.roomCode || 'LAB'} • MEJA {c.seatNumber || '01'}
                  </span>
                </div>

                {/* Main Card Content */}
                <div className="flex items-start justify-between gap-3 text-[11px] leading-relaxed mb-3">
                  {/* Left: Student particulars */}
                  <table className="flex-1">
                    <tbody>
                      <tr>
                        <td className="text-slate-500 font-medium w-24 py-0.5">Nama Siswa</td>
                        <td className="text-slate-500 font-bold px-1">:</td>
                        <td className="font-black text-slate-900 truncate max-w-[160px] py-0.5">
                          {c.name}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-medium py-0.5">NISN / NIS</td>
                        <td className="text-slate-500 font-bold px-1">:</td>
                        <td className="font-mono font-bold text-slate-800 py-0.5">
                          {c.nisn} / {c.nis}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-medium py-0.5">Rombel / Kelas</td>
                        <td className="text-slate-500 font-bold px-1">:</td>
                        <td className="font-bold text-blue-700 py-0.5">
                          {c.className}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-medium py-0.5">Ruang & Sesi</td>
                        <td className="text-slate-500 font-bold px-1">:</td>
                        <td className="font-bold text-slate-900 py-0.5">
                          {c.roomName || 'Lab Komputer'} (Sesi {c.sessionNumber || 1})
                        </td>
                      </tr>
                      <tr>
                        <td className="text-slate-500 font-medium py-0.5">Mata Ujian</td>
                        <td className="text-slate-500 font-bold px-1">:</td>
                        <td className="font-bold text-slate-900 py-0.5">
                          {c.subject}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Right: QR Code */}
                  <div className="text-center shrink-0">
                    <div className="w-20 h-20 bg-white border border-slate-300 rounded-lg p-0.5 flex items-center justify-center">
                      {c.qrUrl ? (
                        <img src={c.qrUrl} alt="QR Token" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="w-12 h-12 text-slate-400" />
                      )}
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Scan QR Masuk</div>
                  </div>
                </div>

                {/* Token Box Highlight */}
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">PIN Akses Kartu</div>
                    <div className="font-mono font-black text-xs text-slate-800">{c.cardCode}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-[9px] font-bold text-blue-600 uppercase">Token Ujian (8-Digit)</div>
                    <div className="font-mono font-black text-sm text-blue-700 tracking-wider">
                      {c.token}
                    </div>
                  </div>
                </div>

                {/* Footer Validation Signature */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500">
                  <span>Wajib dibawa saat memasuki ruang ujian.</span>
                  <span className="font-semibold text-slate-700">Kepala Sekolah: {examInfo?.principalName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
