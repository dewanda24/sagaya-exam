'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import MathRenderer from '@/components/common/MathRenderer';
import {
  Printer,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Filter,
  Sparkles,
  Calendar,
  Layers,
  Award,
  FileText,
  UserCheck,
} from 'lucide-react';
import { QuestionBankItem } from '@/lib/core/types';

interface Question {
  id: string;
  type: string;
  topic?: string;
  cognitiveLevel?: string;
  competenceCode?: string;
  questionText: string;
  weight: number;
  options?: { key: string; text: string }[];
  answerKey?: any;
  rubric?: string;
  mediaUrl?: string;
  stimulusId?: string;
  stimulusTitle?: string;
  stimulusText?: string;
  stimulusMediaUrl?: string;
}

interface ExamDetail {
  id: string;
  title: string;
  subjectName: string;
  schoolName: string;
  headerTitle1?: string;
  headerTitle2?: string;
  logoUrl?: string;
  principalName?: string;
  principalNip?: string;
  durationMinutes: number;
  passingGrade: number;
  totalQuestions: number;
  questions: Question[];
}

function CetakSoalContent() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get('examId') || '';

  // Mode: Dari Ujian Terjadwal atau Langsung dari Bank Soal
  const [sourceMode, setSourceMode] = useState<'EXAM' | 'BANK'>('EXAM');

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [currentExamId, setCurrentExamId] = useState(initialExamId);

  // Bank Soal Mode State
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [allBankQuestions, setAllBankQuestions] = useState<QuestionBankItem[]>([]);

  // School branding
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    headerTitle1: string;
    headerTitle2: string;
    logoUrl?: string;
    principalName?: string;
    principalNip?: string;
  }>({
    name: 'SMA Negeri Sagaya',
    headerTitle1: 'PEMERINTAH DAERAH PROVINSI / DAERAH',
    headerTitle2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  });

  const [loading, setLoading] = useState(true);

  // Print options
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [includeRubric, setIncludeRubric] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'compact'>('normal');

  // Load School Info & Master Data
  useEffect(() => {
    async function loadMasterData() {
      try {
        // Load active school
        const scRes = await fetch('/api/admin/active-school');
        const scJson = await scRes.json();
        if (scJson.success && scJson.data) {
          setSchoolInfo({
            name: scJson.data.name || 'SMA Negeri Sagaya',
            headerTitle1: scJson.data.header_title_1 || 'PEMERINTAH DAERAH PROVINSI / DAERAH',
            headerTitle2: scJson.data.header_title_2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
            logoUrl: scJson.data.logo_url,
            principalName: scJson.data.principal_name,
            principalNip: scJson.data.principal_nip,
          });
        }

        // Load subjects
        const subRes = await fetch('/api/admin/subjects');
        const subJson = await subRes.json();
        if (subJson.success) {
          const list = Array.isArray(subJson.data.subjects)
            ? subJson.data.subjects
            : Array.isArray(subJson.data)
            ? subJson.data
            : [];
          setSubjects(list);
          if (list.length > 0) {
            setSelectedSubjectId(list[0].id);
          }
        }

        // Load exams list
        const exRes = await fetch('/api/admin/exams');
        const exJson = await exRes.json();
        if (exJson.success && exJson.data?.exams) {
          const examsList = exJson.data.exams;
          setAvailableExams(examsList);

          // Select initial or first exam
          const target = initialExamId
            ? examsList.find((e: any) => e.id === initialExamId)
            : examsList[0];

          if (target) {
            setCurrentExamId(target.id);
            buildExamDetailFromExam(target);
          }
        }

        // Load question bank for BANK mode
        const qRes = await fetch('/api/admin/questions');
        const qJson = await qRes.json();
        if (qJson.success && Array.isArray(qJson.data)) {
          setAllBankQuestions(qJson.data);
        }
      } catch (err) {
        console.error('Failed to load cetak soal master data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();
  }, [initialExamId]);

  // Helper to construct ExamDetail from an exam object
  const buildExamDetailFromExam = (targetExam: any) => {
    const rawQuestions: any[] = targetExam.questions || [];
    const formattedQuestions: Question[] = rawQuestions.map((q: any) => {
      let opts: { key: string; text: string }[] = [];
      if (Array.isArray(q.options)) {
        opts = q.options.map((o: any) => ({
          key: o.key || o.id || '',
          text: o.text || '',
        }));
      }

      return {
        id: q.id,
        type: q.type,
        topic: q.topic,
        cognitiveLevel: q.cognitiveLevel,
        competenceCode: q.competenceCode,
        questionText: q.questionText,
        weight: q.weight || 10,
        options: opts,
        answerKey: q.answerKey,
        rubric: q.rubric,
        mediaUrl: q.mediaUrl,
        stimulusId: q.stimulusId,
        stimulusTitle: q.stimulusTitle,
        stimulusText: q.stimulusText,
        stimulusMediaUrl: q.stimulusMediaUrl,
      };
    });

    setExam({
      id: targetExam.id,
      title: targetExam.title,
      subjectName: targetExam.subjectName || 'Mata Pelajaran',
      schoolName: targetExam.schoolName || schoolInfo.name,
      headerTitle1: schoolInfo.headerTitle1,
      headerTitle2: schoolInfo.headerTitle2,
      logoUrl: schoolInfo.logoUrl,
      principalName: schoolInfo.principalName,
      principalNip: schoolInfo.principalNip,
      durationMinutes: targetExam.durationMinutes || 90,
      passingGrade: targetExam.passingGrade || 75,
      totalQuestions: formattedQuestions.length,
      questions: formattedQuestions,
    });
  };

  // Helper to construct ExamDetail from bank questions
  const buildExamDetailFromBank = (subjectId: string, topic: string) => {
    const targetSubject = subjects.find((s) => s.id === subjectId);
    let filtered = allBankQuestions.filter((q) => q.subjectId === subjectId);

    if (topic && topic !== 'ALL') {
      filtered = filtered.filter((q) => q.topic === topic);
    }

    const formattedQuestions: Question[] = filtered.map((q: any) => {
      let opts: { key: string; text: string }[] = [];
      if (Array.isArray(q.options)) {
        opts = q.options.map((o: any) => ({
          key: o.id || o.key || '',
          text: o.text || '',
        }));
      }

      return {
        id: q.id,
        type: q.type,
        topic: q.topic,
        cognitiveLevel: q.cognitiveLevel,
        competenceCode: q.competenceCode,
        questionText: q.questionText,
        weight: q.weight || 10,
        options: opts,
        answerKey: q.answerKey,
        rubric: q.rubric,
        mediaUrl: q.mediaUrl,
        stimulusId: q.stimulusId,
        stimulusTitle: q.stimulusTitle,
        stimulusText: q.stimulusText,
        stimulusMediaUrl: q.stimulusMediaUrl,
      };
    });

    setExam({
      id: 'bank-preview',
      title: `Naskah Bank Soal: ${targetSubject?.name || 'Mata Pelajaran'}${topic !== 'ALL' ? ` (${topic})` : ''}`,
      subjectName: targetSubject?.name || 'Mata Pelajaran',
      schoolName: schoolInfo.name,
      headerTitle1: schoolInfo.headerTitle1,
      headerTitle2: schoolInfo.headerTitle2,
      logoUrl: schoolInfo.logoUrl,
      principalName: schoolInfo.principalName,
      principalNip: schoolInfo.principalNip,
      durationMinutes: 90,
      passingGrade: 75,
      totalQuestions: formattedQuestions.length,
      questions: formattedQuestions,
    });
  };

  // Handle Exam Selection Change
  const handleSelectExam = (examId: string) => {
    setCurrentExamId(examId);
    const target = availableExams.find((e) => e.id === examId);
    if (target) {
      buildExamDetailFromExam(target);
    }
  };

  // Handle Bank Filters Change
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    // update available topics for subject
    const subjectQuestions = allBankQuestions.filter((q) => q.subjectId === subjectId);
    const topics = Array.from(new Set(subjectQuestions.map((q) => q.topic).filter(Boolean)));
    setAvailableTopics(topics);
    setSelectedTopic('ALL');
    buildExamDetailFromBank(subjectId, 'ALL');
  };

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    buildExamDetailFromBank(selectedSubjectId, topic);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <GuruLayout
      title="Cetak Naskah Soal & Lembar Ujian"
      subtitle="Format naskah ujian standar cetak kertas kedinasan dengan kop surat sekolah"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Bank Soal', href: '/guru/question-bank' },
        { label: 'Cetak Naskah' },
      ]}
    >
      {/* Print CSS Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          nav, aside, header, footer, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .page-break {
            page-break-before: always;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Screen Toolbar (Hidden when printing) */}
      <div className="no-print space-y-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Cetak Naskah Soal &amp; Arsip Guru
              </h1>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                Format Fisik A4
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Cetak naskah butir soal lengkap ber-kop resmi dinas/sekolah untuk telaah naskah, arsip kurikulum, ujian cadangan kertas, atau lembar pembahasan.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/guru/bank-soal"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Bank Soal</span>
            </Link>

            <button
              onClick={handlePrint}
              disabled={!exam || (exam.questions || []).length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Naskah / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
          {/* Source Tabs: Ujian Terjadwal vs Bank Soal */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-500">Sumber Naskah:</span>
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('EXAM');
                  if (availableExams.length > 0) {
                    const target = availableExams.find((e) => e.id === currentExamId) || availableExams[0];
                    if (target) {
                      setCurrentExamId(target.id);
                      buildExamDetailFromExam(target);
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  sourceMode === 'EXAM'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Naskah Ujian Terjadwal ({availableExams.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('BANK');
                  if (subjects.length > 0) {
                    handleSubjectChange(selectedSubjectId || subjects[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  sourceMode === 'BANK'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Koleksi Bank Soal Langsung</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Mode-Specific Selectors */}
            {sourceMode === 'EXAM' ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Pilih Jadwal Ujian:</span>
                <select
                  value={currentExamId}
                  onChange={(e) => handleSelectExam(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                >
                  {availableExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} {e.subjectName ? `(${e.subjectName})` : ''} - [{e.totalQuestions} Soal]
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Mata Pelajaran:</span>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Topik / Materi:</span>
                  <select
                    value={selectedTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">Semua Topik</option>
                    {availableTopics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Toggle Print Options */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnswerKey}
                  onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Sertakan Kunci Jawaban</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRubric}
                  onChange={(e) => setIncludeRubric(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Sertakan Rubrik Penilaian Essay</span>
              </label>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    fontSize === 'normal' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Font Normal
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('compact')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    fontSize === 'compact' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Font Rapat
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Paper Preview (A4 Form) */}
      <div className="print-container max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/90 shadow-lg text-slate-900">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">Menyiapkan format cetak naskah soal...</div>
        ) : !exam || (exam.questions || []).length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Tidak ada butir soal yang ditemukan untuk naskah ini. Silakan buat soal di Bank Soal terlebih dahulu.
          </div>
        ) : (
          <div className={`space-y-6 ${fontSize === 'compact' ? 'text-xs' : 'text-sm'}`}>
            {/* Kop Resmi Satuan Pendidikan */}
            <div className="border-b-[3px] border-double border-black pb-4 text-center space-y-1 relative">
              {exam.logoUrl && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden sm:block">
                  <img
                    src={exam.logoUrl}
                    alt="Logo Sekolah"
                    className="w-16 h-16 object-contain"
                  />
                </div>
              )}
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                {exam.headerTitle1 || 'PEMERINTAH DAERAH PROVINSI / DAERAH'}
              </h2>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {exam.headerTitle2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
              </h3>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                {exam.schoolName}
              </h1>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                NASKAH SOAL ASESMEN STANDAR KOMPETENSI / PENILAIAN AKADEMIK CBT
              </p>
            </div>

            {/* Identitas Ujian */}
            <div className="border border-black/80 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs font-semibold bg-slate-50/50">
              <div>
                <span className="text-slate-500">Mata Pelajaran:</span>{' '}
                <strong className="text-black uppercase">{exam.subjectName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Alokasi Waktu:</span>{' '}
                <strong className="text-black">{exam.durationMinutes} Menit</strong>
              </div>
              <div>
                <span className="text-slate-500">Naskah / Judul:</span>{' '}
                <strong className="text-black">{exam.title}</strong>
              </div>
              <div>
                <span className="text-slate-500">Jumlah Soal:</span>{' '}
                <strong className="text-black">{exam.totalQuestions} Butir</strong>
              </div>
            </div>

            {/* Petunjuk Pengerjaan */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] leading-relaxed text-slate-700 space-y-0.5">
              <span className="font-bold text-black uppercase block">Petunjuk Umum:</span>
              <p>1. Periksa dan bacalah setiap butir soal dengan teliti sebelum Anda menjawab.</p>
              <p>2. Kerjakan butir yang dianggap mudah terlebih dahulu.</p>
              <p>3. Jawablah butir uraian dengan jelas, runtut, dan terstruktur sesuai kaidah.</p>
            </div>

            {/* Daftar Butir Soal */}
            <div className="space-y-6 pt-2">
              {exam.questions.map((q, idx) => (
                <div key={q.id} className="avoid-break space-y-2 pb-4 border-b border-slate-200/60 last:border-none">
                  {/* Nomor & Format */}
                  <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-black text-white font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="uppercase text-[11px]">
                        [{q.type.replace(/_/g, ' ')}]
                      </span>
                      {q.competenceCode && (
                        <span className="text-[10px] font-mono text-slate-500">
                          ({q.competenceCode})
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      Bobot: {q.weight} Poin
                    </span>
                  </div>

                  {/* Shared Stimulus Wacana / Teks Cerita Rujukan */}
                  {(q.stimulusTitle || q.stimulusText) && (
                    idx > 0 &&
                    (exam.questions[idx - 1].stimulusId === q.stimulusId ||
                      (q.stimulusTitle && exam.questions[idx - 1].stimulusTitle === q.stimulusTitle)) ? (
                      <div className="my-1.5 px-3 py-1 bg-amber-50/90 border border-amber-200 rounded-md text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                        <span>📖</span>
                        <span>Soal ini mengacu pada <strong>{q.stimulusTitle || 'Wacana Cerita'}</strong> di atas.</span>
                      </div>
                    ) : (
                      <div className="my-2 p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-1.5 break-inside-avoid">
                        <div className="text-xs font-black text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                          <span>📖 {q.stimulusTitle || 'Wacana / Teks Cerita Rujukan'}</span>
                          <span className="text-[10px] font-semibold text-slate-600 italic">
                            Bacalah wacana berikut dengan saksama untuk menjawab soal:
                          </span>
                        </div>
                        {q.stimulusText && (
                          <div className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap">
                            <MathRenderer text={q.stimulusText} />
                          </div>
                        )}
                        {q.stimulusMediaUrl && (
                          <div className="my-1.5 max-w-sm mx-auto text-center">
                            <img
                              src={q.stimulusMediaUrl}
                              alt="Infografis Wacana"
                              className="max-h-48 object-contain mx-auto rounded border border-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Stimulus Media Gambar (Jika ada) */}
                  {q.mediaUrl && (
                    <div className="my-2 max-w-md mx-auto text-center">
                      <img
                        src={q.mediaUrl}
                        alt="Stimulus Soal"
                        className="max-h-56 object-contain mx-auto rounded border border-slate-200"
                      />
                    </div>
                  )}

                  {/* Question Text with KaTeX Formula */}
                  <div className="leading-relaxed font-medium text-black whitespace-pre-wrap">
                    <MathRenderer text={q.questionText} />
                  </div>

                  {/* Pilihan Ganda / PG Kompleks Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-2">
                      {q.options.map((opt) => (
                        <div key={opt.key} className="flex items-start gap-2">
                          <span className="font-black text-black w-4 text-center shrink-0">
                            {opt.key}.
                          </span>
                          <span className="text-slate-800">
                            <MathRenderer text={opt.text} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matching Pairs Table Preview */}
                  {q.type === 'MENJODOHKAN' && q.answerKey && typeof q.answerKey === 'object' && (
                    <div className="mt-2 pl-2">
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">
                        Daftar Pasangan / Premis:
                      </span>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                        <div>
                          <strong className="block border-b border-slate-200 pb-1 mb-1">Kolom Pernyataan:</strong>
                          <ul className="list-disc pl-4 space-y-1">
                            {Object.keys(q.answerKey).map((k, i) => (
                              <li key={i}>{k}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong className="block border-b border-slate-200 pb-1 mb-1">Pilihan Pasangan:</strong>
                          <ul className="list-circle pl-4 space-y-1">
                            {Object.values(q.answerKey).map((v: any, i) => (
                              <li key={i}>{String(v)}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Essay Blank Answer Area */}
                  {q.type === 'ESSAY' && (
                    <div className="mt-3 border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[90px] bg-slate-50/40 text-[11px] text-slate-400 italic">
                      Lembar jawaban uraian / coretan pengerjaan peserta didik:
                    </div>
                  )}

                  {/* Optional: Answer Key & Rubric (For Teacher Archive) */}
                  {(includeAnswerKey || includeRubric) && (
                    <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs space-y-1">
                      {includeAnswerKey && (
                        <div>
                          <strong className="text-amber-900">Kunci Jawaban:</strong>{' '}
                          <span className="font-mono font-bold text-amber-950">
                            {typeof q.answerKey === 'object'
                              ? JSON.stringify(q.answerKey)
                              : String(q.answerKey || '-')}
                          </span>
                        </div>
                      )}
                      {includeRubric && q.rubric && (
                        <div className="pt-1 text-slate-700">
                          <strong className="text-amber-900 block">Rubrik Penskoran:</strong>
                          <span className="italic">{q.rubric}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Lembar Cetak & Tanda Tangan Guru */}
            <div className="avoid-break pt-8 mt-8 border-t border-black grid grid-cols-2 text-center text-xs">
              <div>
                <p>Mengetahui,</p>
                <p className="font-bold">Kepala Sekolah</p>
                <div className="h-16" />
                <p className="font-bold underline">
                  ( {exam.principalName || '........................................'} )
                </p>
                <p className="text-slate-500 text-[11px]">
                  NIP. {exam.principalNip || '........................................'}
                </p>
              </div>

              <div>
                <p>Guru Mata Pelajaran,</p>
                <p className="font-bold uppercase">{exam.subjectName}</p>
                <div className="h-16" />
                <p className="font-bold underline">( ........................................ )</p>
                <p className="text-slate-500 text-[11px]">NIP. ........................................</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </GuruLayout>
  );
}

export default function CetakSoalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Menyiapkan lembar cetak...</div>}>
      <CetakSoalContent />
    </Suspense>
  );
}
