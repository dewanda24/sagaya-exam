'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Layers,
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  X,
  FileText,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { QuestionType, DifficultyLevel } from '@/lib/core/types';

export default function GuruQuestionCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSubject = searchParams?.get('subjectId') || '';

  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState(preselectedSubject);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [type, setType] = useState<QuestionType>('PILIHAN_GANDA');

  // Stimulus
  const [hasStimulus, setHasStimulus] = useState(false);
  const [stimulusTitle, setStimulusTitle] = useState('');
  const [stimulusText, setStimulusText] = useState('');

  // Main Question
  const [questionText, setQuestionText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE'>('NONE');
  const [explanation, setExplanation] = useState('');
  const [weight, setWeight] = useState(1.0);

  // PILIHAN_GANDA / PG_KOMPLEKS Options
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ]);

  // Answer Keys
  const [mcAnswerKey, setMcAnswerKey] = useState('A');
  const [complexKeys, setComplexKeys] = useState<string[]>(['A']);
  const [tfKey, setTfKey] = useState<'TRUE' | 'FALSE'>('TRUE');
  const [shortAnswerKey, setShortAnswerKey] = useState('');
  const [matchingPairs, setMatchingPairs] = useState<{ premise: string; target: string }[]>([
    { premise: '', target: '' },
    { premise: '', target: '' },
  ]);
  const [essayRubric, setEssayRubric] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/guru/subjects');
        const json = await res.json();
        if (json.success && json.data) {
          setSubjects(json.data);
          if (json.data.length > 0 && !subjectId) {
            setSubjectId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSubjects();
  }, []);

  const handleAddOption = () => {
    const nextKey = String.fromCharCode(65 + options.length);
    setOptions([...options, { id: nextKey, text: '' }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) {
      alert('Pilihan ganda minimal memiliki 2 opsi.');
      return;
    }
    const filtered = options.filter((_, i) => i !== idx);
    const reindexed = filtered.map((opt, i) => ({
      id: String.fromCharCode(65 + i),
      text: opt.text,
    }));
    setOptions(reindexed);
  };

  const handleOptionTextChange = (idx: number, text: string) => {
    const updated = [...options];
    updated[idx].text = text;
    setOptions(updated);
  };

  const handleToggleComplexKey = (optId: string) => {
    if (complexKeys.includes(optId)) {
      if (complexKeys.length <= 1) {
        alert('Pilihan ganda kompleks harus memiliki minimal satu kunci benar.');
        return;
      }
      setComplexKeys(complexKeys.filter((k) => k !== optId));
    } else {
      setComplexKeys([...complexKeys, optId]);
    }
  };

  const handleAddMatchingPair = () => {
    setMatchingPairs([...matchingPairs, { premise: '', target: '' }]);
  };

  const handleRemoveMatchingPair = (idx: number) => {
    if (matchingPairs.length <= 1) return;
    setMatchingPairs(matchingPairs.filter((_, i) => i !== idx));
  };

  const handleMatchingChange = (idx: number, field: 'premise' | 'target', value: string) => {
    const updated = [...matchingPairs];
    updated[idx][field] = value;
    setMatchingPairs(updated);
  };

  const handleSave = async (submitForReview = false) => {
    setError(null);
    if (!subjectId) {
      setError('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    if (!topic.trim()) {
      setError('Topik / Kompetensi Dasar (KD) butir soal wajib diisi.');
      return;
    }
    if (!questionText.trim()) {
      setError('Deskripsi pertanyaan butir soal wajib diisi.');
      return;
    }

    let calculatedAnswerKey: any = null;
    let payloadOptions: any = null;

    if (type === 'PILIHAN_GANDA') {
      if (options.some((o) => !o.text.trim())) {
        setError('Semua teks pilihan jawaban harus diisi.');
        return;
      }
      payloadOptions = options;
      calculatedAnswerKey = mcAnswerKey;
    } else if (type === 'PG_KOMPLEKS') {
      if (options.some((o) => !o.text.trim())) {
        setError('Semua teks pilihan ganda kompleks harus diisi.');
        return;
      }
      if (complexKeys.length === 0) {
        setError('Pilih minimal satu kunci jawaban yang benar.');
        return;
      }
      payloadOptions = options;
      calculatedAnswerKey = complexKeys;
    } else if (type === 'TRUE_FALSE') {
      calculatedAnswerKey = tfKey;
    } else if (type === 'MATCHING') {
      if (matchingPairs.some((p) => !p.premise.trim() || !p.target.trim())) {
        setError('Semua pasangan premis dan target pencocokan wajib diisi.');
        return;
      }
      calculatedAnswerKey = matchingPairs;
    } else if (type === 'ISIAN_SINGKAT') {
      if (!shortAnswerKey.trim()) {
        setError('Kunci jawaban isian singkat wajib diisi.');
        return;
      }
      calculatedAnswerKey = shortAnswerKey.trim();
    } else if (type === 'ESSAY') {
      if (!essayRubric.trim()) {
        setError('Rubrik penilaian uraian / essay wajib diisi untuk panduan koreksi.');
        return;
      }
      calculatedAnswerKey = null;
    }

    setSaving(true);
    try {
      const payload: any = {
        subjectId,
        topic: topic.trim(),
        difficulty,
        type,
        questionText: questionText.trim(),
        mediaUrl: mediaUrl.trim() || null,
        mediaType: mediaType !== 'NONE' ? mediaType : null,
        options: payloadOptions,
        answerKey: calculatedAnswerKey,
        explanation: explanation.trim() || null,
        rubric: type === 'ESSAY' ? essayRubric.trim() : null,
        weight: Number(weight) || 1.0,
        stimulusTitle: hasStimulus && stimulusTitle.trim() ? stimulusTitle.trim() : null,
        stimulusText: hasStimulus && stimulusText.trim() ? stimulusText.trim() : null,
      };

      const res = await fetch('/api/guru/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Gagal menyimpan butir soal.');
        setSaving(false);
        return;
      }

      const createdId = json.data?.id;

      if (submitForReview && createdId) {
        // Automatically submit for review
        await fetch(`/api/guru/questions/${createdId}/submit`, { method: 'POST' });
      }

      router.push('/guru/question-bank');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
      setSaving(false);
    }
  };

  return (
    <GuruLayout
      title="Editor Butir Soal"
      subtitle="Penyusunan naskah soal asesmen terstandar dengan dukungan 6 tipe soal dan multimedia stimulus"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Bank Soal', href: '/guru/question-bank' },
        { label: 'Buat Soal Baru' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            Pratinjau Soal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSave(false)}
            isLoading={saving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Simpan Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(true)}
            isLoading={saving}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Simpan & Ajukan Review
          </Button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Section 1: Metadata Taksonomi & Tipe Soal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary-600" />
              Taksonomi & Spesifikasi Butir Soal
            </CardTitle>
            <CardDescription>
              Tentukan mata pelajaran, materi pokok, dan karakteristik psikometrik butir soal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mata Pelajaran <span className="text-danger-500">*</span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Topik / Pokok Bahasan / KD <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Termodinamika, Aljabar Linier..."
                  className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tingkat Kesulitan
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="EASY">Mudah (LOTS)</option>
                  <option value="MEDIUM">Sedang (MOTS)</option>
                  <option value="HARD">Sukar (HOTS)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipe Format Soal <span className="text-danger-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType)}
                  className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-primary-700"
                >
                  <option value="PILIHAN_GANDA">1. Pilihan Ganda (Single Choice)</option>
                  <option value="PG_KOMPLEKS">2. Pilihan Ganda Kompleks (Multi Choice)</option>
                  <option value="TRUE_FALSE">3. Benar / Salah (True / False)</option>
                  <option value="MATCHING">4. Menjodohkan (Matching Pairs)</option>
                  <option value="ISIAN_SINGKAT">5. Isian Singkat (Short Answer)</option>
                  <option value="ESSAY">6. Uraian / Essay (Rubric Evaluation)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bobot Butir Soal (Skor)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="100"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
                  className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Stimulus (Bacaan / Kasus) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                Stimulus Bacaan / Teks Kasus (Opsional)
              </CardTitle>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={hasStimulus}
                  onChange={(e) => setHasStimulus(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Sertakan Stimulus Teks
              </label>
            </div>
            <CardDescription>
              Wacana atau kutipan teks pendukung yang dianalisis oleh peserta didik sebelum menjawab soal
            </CardDescription>
          </CardHeader>
          {hasStimulus && (
            <CardContent className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul Stimulus (Opsional)
                </label>
                <input
                  type="text"
                  value={stimulusTitle}
                  onChange={(e) => setStimulusTitle(e.target.value)}
                  placeholder="Contoh: Wacana 1 — Fenomena Efek Rumah Kaca..."
                  className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Isi Teks Stimulus / Wacana
                </label>
                <textarea
                  rows={4}
                  value={stimulusText}
                  onChange={(e) => setStimulusText(e.target.value)}
                  placeholder="Tuliskan isi wacana, artikel, atau data bacaan..."
                  className="w-full p-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Section 3: Question Text & Multimedia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600" />
              Naskah Pertanyaan & Multimedia
            </CardTitle>
            <CardDescription>
              Tuliskan pertanyaan utama dan lampirkan gambar/audio/video jika diperlukan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pertanyaan Soal <span className="text-danger-500">*</span>
              </label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Tuliskan rumusan pertanyaan butir soal di sini..."
                className="w-full p-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed font-medium"
              />
            </div>

            {/* Media Attachment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipe Media Lampiran
                </label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as any)}
                  className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="NONE">Tidak Ada Media</option>
                  <option value="IMAGE">Gambar (Image URL)</option>
                  <option value="AUDIO">Audio (Audio URL)</option>
                  <option value="VIDEO">Video (Video URL)</option>
                </select>
              </div>

              {mediaType !== 'NONE' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    URL Media / Gambar
                  </label>
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://... atau /uploads/..."
                    className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>

            {mediaUrl && mediaType === 'IMAGE' && (
              <div className="pt-2">
                <p className="text-xs text-slate-500 mb-2 font-medium">Pratinjau Gambar:</p>
                <div className="max-w-sm rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <img src={mediaUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-slate-50" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Dynamic Options & Answer Keys based on Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
              Pilihan Jawaban & Kunci Resmi
            </CardTitle>
            <CardDescription>
              Konfigurasi kunci jawaban dan opsi sesuai tipe format soal yang dipilih
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 1. PILIHAN GANDA */}
            {type === 'PILIHAN_GANDA' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Tentukan opsi dan klik bulatan radio pada opsi yang merupakan <strong>kunci jawaban benar</strong>:
                </p>
                {options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMcAnswerKey(opt.id)}
                      className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                        mcAnswerKey === opt.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {opt.id}
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      placeholder={`Teks pilihan ${opt.id}...`}
                      className="flex-1 py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Tambah Pilihan Opsi ({String.fromCharCode(65 + options.length)})
                  </Button>
                )}
              </div>
            )}

            {/* 2. PILIHAN GANDA KOMPLEKS */}
            {type === 'PG_KOMPLEKS' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Centang semua opsi yang merupakan <strong>kunci jawaban benar</strong> (mendukung lebih dari satu kunci):
                </p>
                {options.map((opt, idx) => {
                  const isChecked = complexKeys.includes(opt.id);
                  return (
                    <div key={opt.id} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleComplexKey(opt.id)}
                        className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                          isChecked
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {isChecked ? '✓' : opt.id}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                        placeholder={`Teks pilihan ${opt.id}...`}
                        className="flex-1 py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {options.length < 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Tambah Opsi Baru ({String.fromCharCode(65 + options.length)})
                  </Button>
                )}
              </div>
            )}

            {/* 3. BENAR / SALAH */}
            {type === 'TRUE_FALSE' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Pilih pernyataan yang dinilai benar atau salah:
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <label
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      tfKey === 'TRUE'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tf"
                      checked={tfKey === 'TRUE'}
                      onChange={() => setTfKey('TRUE')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>BENAR (TRUE)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      tfKey === 'FALSE'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tf"
                      checked={tfKey === 'FALSE'}
                      onChange={() => setTfKey('FALSE')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>SALAH (FALSE)</span>
                  </label>
                </div>
              </div>
            )}

            {/* 4. MENJODOHKAN */}
            {type === 'MATCHING' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Definisikan pasangan premis (kiri) dan target pasangannya (kanan):
                </p>
                {matchingPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 w-6 text-center">{idx + 1}.</span>
                    <input
                      type="text"
                      value={pair.premise}
                      onChange={(e) => handleMatchingChange(idx, 'premise', e.target.value)}
                      placeholder="Premis / Pernyataan Kiri..."
                      className="flex-1 py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-slate-400 font-bold text-sm">→</span>
                    <input
                      type="text"
                      value={pair.target}
                      onChange={(e) => handleMatchingChange(idx, 'target', e.target.value)}
                      placeholder="Target Pasangan Kanan..."
                      className="flex-1 py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {matchingPairs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMatchingPair(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMatchingPair}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Tambah Pasangan Menjodohkan
                </Button>
              </div>
            )}

            {/* 5. ISIAN SINGKAT */}
            {type === 'ISIAN_SINGKAT' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Tuliskan teks kunci jawaban yang tepat (sistem akan mencocokkan teks jawaban siswa secara otomatis):
                </p>
                <input
                  type="text"
                  value={shortAnswerKey}
                  onChange={(e) => setShortAnswerKey(e.target.value)}
                  placeholder="Kunci teks jawaban isian singkat..."
                  className="w-full max-w-md py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono font-semibold"
                />
              </div>
            )}

            {/* 6. ESSAY / URAIAN */}
            {type === 'ESSAY' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Jawaban tipe essay dinilai secara manual oleh guru pada menu Koreksi Essay. Tuliskan kriteria dan rubrik penilaian di bawah ini sebagai panduan skoring.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rubrik Penilaian & Indikator Kunci <span className="text-danger-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={essayRubric}
                    onChange={(e) => setEssayRubric(e.target.value)}
                    placeholder="Contoh:&#10;- Skor 100: Menyebutkan 3 hukum termodinamika lengkap dengan rumus.&#10;- Skor 60: Menyebutkan 2 hukum tanpa penjelasan rumus.&#10;- Skor 20: Hanya menyebutkan nama hukum tanpa uraian."
                    className="w-full p-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Pembahasan & Penjelasan Soal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary-600" />
              Pembahasan & Keterangan Tambahan
            </CardTitle>
            <CardDescription>
              Penjelasan rasional ilmiah di balik jawaban benar untuk umpan balik pembelajaran
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Tuliskan pembahasan atau langkah penyelesaian soal..."
              className="w-full p-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Link href="/guru/question-bank">
            <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Kembali ke Bank Soal
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleSave(false)}
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Simpan Draft
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSave(true)}
              isLoading={saving}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Simpan & Ajukan Review
            </Button>
          </div>
        </div>
      </div>

      {/* PREVIEW MODAL */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Pratinjau Butir Soal"
        size="lg"
      >
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
            <Badge variant="primary" size="sm">
              Topik: {topic || 'Belum diisi'}
            </Badge>
            <Badge variant="neutral" size="sm">
              Tipe: {type}
            </Badge>
            <Badge variant="info" size="sm">
              Kesulitan: {difficulty}
            </Badge>
            <span className="text-xs text-slate-500 ml-auto font-mono">Bobot: {weight}</span>
          </div>

          {hasStimulus && stimulusText && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              {stimulusTitle && (
                <h4 className="font-bold text-xs uppercase text-slate-600">{stimulusTitle}</h4>
              )}
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {stimulusText}
              </p>
            </div>
          )}

          {mediaUrl && mediaType === 'IMAGE' && (
            <div className="max-w-xs mx-auto rounded-xl overflow-hidden border border-slate-200">
              <img src={mediaUrl} alt="Media" className="w-full h-auto" />
            </div>
          )}

          <div className="text-slate-900 font-semibold text-base leading-relaxed whitespace-pre-wrap">
            {questionText || '(Deskripsi pertanyaan belum diisi)'}
          </div>

          {/* Type-based Preview */}
          {type === 'PILIHAN_GANDA' && (
            <div className="space-y-2 pt-2">
              {options.map((opt) => (
                <div
                  key={opt.id}
                  className={`p-3 rounded-xl border text-sm flex items-center gap-3 ${
                    mcAnswerKey === opt.id
                      ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-950'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">
                    {opt.id}
                  </span>
                  <span>{opt.text || `(Pilihan ${opt.id})`}</span>
                  {mcAnswerKey === opt.id && (
                    <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold ml-auto">
                      Kunci Jawaban
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {explanation && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 mt-4 space-y-1">
              <span className="font-bold uppercase tracking-wider block">Pembahasan:</span>
              <p className="leading-relaxed">{explanation}</p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Tutup Pratinjau
            </Button>
          </div>
        </div>
      </Modal>
    </GuruLayout>
  );
}
