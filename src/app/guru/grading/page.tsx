'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  User,
  Sparkles,
  BookOpen,
  RotateCw,
  Layers,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export default function GuruGradingPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grading form state
  const [manualScore, setManualScore] = useState<number>(0);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [teacherInternalNote, setTeacherInternalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const loadPendingEssays = async (targetIdToPreserve?: string) => {
    setLoading(true);
    setError(null);
    setConflictWarning(null);
    try {
      const res = await fetch('/api/guru/grading');
      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
        if (targetIdToPreserve) {
          const match = json.items?.find((it: any) => it.answerId === targetIdToPreserve);
          if (match) selectAnswer(match);
        } else if (json.items && json.items.length > 0 && !selectedItem) {
          selectAnswer(json.items[0]);
        }
      } else {
        setError(json.error || 'Gagal memuat antrean essay.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingEssays();
  }, []);

  const selectAnswer = (item: any) => {
    setSelectedItem(item);
    setManualScore(item.manualScore !== null ? item.manualScore : 0);
    setRubricScores(item.rubricScores || {});
    setFeedback(item.feedback || '');
    setTeacherInternalNote(item.teacherInternalNote || '');
    setSaveMsg(null);
    setConflictWarning(null);
  };

  const handleRubricScoreChange = (criterionKey: string, scoreVal: number, criterionMax: number) => {
    const clamped = Math.max(0, Math.min(criterionMax, scoreVal));
    const nextScores = { ...rubricScores, [criterionKey]: clamped };
    setRubricScores(nextScores);

    // Sum all rubric criteria scores to set manualScore
    const total = Object.values(nextScores).reduce((acc, v) => acc + (Number(v) || 0), 0);
    setManualScore(Math.round(total * 100) / 100);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (manualScore < 0 || manualScore > selectedItem.maxScore) {
      alert(`Nilai harus berada di antara 0 dan nilai maksimal (${selectedItem.maxScore}).`);
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    setConflictWarning(null);

    try {
      const res = await fetch(`/api/guru/grading/${selectedItem.answerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualScore: Number(manualScore),
          rubricScores: Object.keys(rubricScores).length > 0 ? rubricScores : undefined,
          feedback: feedback.trim() || undefined,
          teacherInternalNote: teacherInternalNote.trim() || undefined,
          clientVersion: selectedItem.version, // Optimistic Concurrency Control
        }),
      });

      const json = await res.json();
      if (res.status === 409 || json.code === 'REVIEW_CONFLICT') {
        setConflictWarning(
          json.error ||
            'Konflik Koreksi: Korektor lain baru saja memperbarui lembar jawaban ini. Silakan muat ulang data terbaru.'
        );
      } else if (json.success) {
        setSaveMsg('Nilai essay berhasil disimpan secara aman.');
        const newVersion = json.data?.version || (selectedItem.version || 1) + 1;

        // Update local list
        setItems((prev) =>
          prev.map((it) =>
            it.answerId === selectedItem.answerId
              ? {
                  ...it,
                  manualScore: Number(manualScore),
                  isGraded: true,
                  version: newVersion,
                  rubricScores,
                  feedback,
                  teacherInternalNote,
                }
              : it
          )
        );
        setSelectedItem((prev: any) => ({
          ...prev,
          manualScore: Number(manualScore),
          isGraded: true,
          version: newVersion,
        }));
      } else {
        alert(json.error || 'Gagal menyimpan skor essay.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GuruLayout
      title="Penilaian & Koreksi Essay"
      subtitle="Pemeriksaan lembar jawaban uraian siswa dengan rubrik panduan skoring dan audit concurrency"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Penilaian', href: '/guru/grading' },
        { label: 'Koreksi Uraian' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadPendingEssays(selectedItem?.answerId)}
          isLoading={loading}
          leftIcon={<RotateCw className="w-3.5 h-3.5" />}
        >
          Segarkan Antrean
        </Button>
      }
    >
      <div className="space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Pending Queue List (col-span-4) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Antrean Jawaban Siswa
              </span>
              <Badge variant="primary" size="sm">
                {items.length} Lembar
              </Badge>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Memuat antrean jawaban...
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-xs text-slate-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-800">Semua Essay Telah Dinilai!</p>
                  <p className="text-slate-400">Tidak ada lembar jawaban uraian yang menunggu koreksi saat ini.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {items.map((it) => {
                  const isSelected = selectedItem?.answerId === it.answerId;
                  return (
                    <button
                      key={it.answerId}
                      onClick={() => selectAnswer(it)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-primary-50/80 border-primary-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 truncate max-w-[170px]">
                          {it.studentName}
                        </span>
                        {it.isGraded ? (
                          <Badge variant="success" size="sm">
                            Skor: {it.manualScore}
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Perlu Dinilai
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{it.examTitle}</span>
                        <span className="font-mono">{it.className}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2 line-clamp-1 italic bg-slate-50 p-1.5 rounded">
                        &ldquo;{it.studentAnswerText || '(Jawaban kosong)'}&rdquo;
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Grading Workspace (col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedItem ? (
              <form onSubmit={handleSaveGrade} className="space-y-6">
                {conflictWarning && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 text-xs leading-relaxed">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Peringatan Konflik Data:</span>
                      <span>{conflictWarning}</span>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadPendingEssays(selectedItem.answerId)}
                          className="border-amber-400 bg-white text-amber-800"
                        >
                          Muat Ulang Versi Terbaru
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {saveMsg && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{saveMsg}</span>
                  </div>
                )}

                {/* Student Info & Exam Header */}
                <Card>
                  <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary-600" />
                        <span className="font-bold text-slate-900 text-sm">{selectedItem.studentName}</span>
                        <span className="text-xs text-slate-500">({selectedItem.nis || '-'})</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {selectedItem.examTitle} • Rombel: {selectedItem.className}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Nilai Maksimal Soal:</span>
                      <span className="text-sm font-bold font-mono bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-200">
                        {selectedItem.maxScore} Poin
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Question & Stimulus */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Soal & Pertanyaan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedItem.stimulusText && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {selectedItem.stimulusText}
                      </div>
                    )}
                    <div className="text-slate-900 font-semibold leading-relaxed">
                      {selectedItem.questionText}
                    </div>
                  </CardContent>
                </Card>

                {/* Student Answer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Jawaban Siswa
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedItem.studentAnswerText || '(Siswa tidak mengisikan jawaban)'}
                    </div>
                  </CardContent>
                </Card>

                {/* Rubric Guide if available */}
                {selectedItem.rubric && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Panduan Rubrik Penilaian
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 font-mono leading-relaxed whitespace-pre-wrap">
                        {selectedItem.rubric}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Score Input & Feedback */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Skoring & Umpan Balik Pengajar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nilai / Skor Akhir (0 - {selectedItem.maxScore}) <span className="text-danger-500">*</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={selectedItem.maxScore}
                          required
                          value={manualScore}
                          onChange={(e) => setManualScore(parseFloat(e.target.value) || 0)}
                          className="w-36 py-2 px-3.5 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold text-primary-700"
                        />
                        <span className="text-xs text-slate-500">
                          dari total {selectedItem.maxScore} bobot poin
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Catatan Umpan Balik untuk Siswa (Dapat Dilihat Siswa)
                      </label>
                      <textarea
                        rows={3}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Tuliskan apresiasi atau saran perbaikan untuk pemahaman materi siswa..."
                        className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Catatan Internal Pengajar (Hanya untuk Guru / Rekan Korektor)
                      </label>
                      <input
                        type="text"
                        value={teacherInternalNote}
                        onChange={(e) => setTeacherInternalNote(e.target.value)}
                        placeholder="Contoh: Jawaban mirip konsep referensi modul bab 3..."
                        className="w-full py-2 px-3.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={saving}
                        leftIcon={<Save className="w-4 h-4" />}
                      >
                        Simpan Nilai Essay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            ) : (
              <Card>
                <CardContent className="p-16 text-center text-slate-400 text-sm">
                  Pilih lembar jawaban siswa pada daftar di samping untuk memulai koreksi.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </GuruLayout>
  );
}
