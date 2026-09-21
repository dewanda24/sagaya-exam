'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import {
  Layers,
  ArrowLeft,
  Save,
  AlertCircle,
  Lock,
  Clock,
  Send,
  Plus,
  Trash2,
  Copy,
  BookOpen,
  X,
} from 'lucide-react';
import { QuestionType, DifficultyLevel } from '@/lib/core/types';

export default function GuruQuestionEditPage() {
  const params = useParams();
  const router = useRouter();
  const questionId = params?.id as string;

  const [question, setQuestion] = useState<any>(null);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [type, setType] = useState<QuestionType>('PILIHAN_GANDA');
  const [questionText, setQuestionText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE'>('NONE');
  const [explanation, setExplanation] = useState('');
  const [weight, setWeight] = useState(1.0);
  const [options, setOptions] = useState<any[]>([]);
  const [answerKey, setAnswerKey] = useState<any>('');
  const [rubric, setRubric] = useState('');
  const [expectedVersion, setExpectedVersion] = useState<number>(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      if (!questionId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/guru/questions/${questionId}`);
        const json = await res.json();
        if (json.success && json.data) {
          const q = json.data;
          setQuestion(q);
          setTopic(q.topic);
          setDifficulty(q.difficulty);
          setType(q.type);
          setQuestionText(q.questionText);
          setMediaUrl(q.mediaUrl || '');
          setMediaType(q.mediaType || 'NONE');
          setExplanation(q.explanation || '');
          setWeight(q.weight || 1.0);
          setOptions(q.options || []);
          setAnswerKey(q.answerKey);
          setRubric(q.rubric || '');
          setExpectedVersion(q.currentRevisionNumber || q.version || 1);
        } else {
          setError(json.error || 'Gagal memuat detail soal.');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [questionId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/guru/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          difficulty,
          type,
          questionText,
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType,
          options,
          answerKey,
          explanation,
          rubric,
          weight: Number(weight),
          expectedVersion,
        }),
      });

      const json = await res.json();
      if (json.success) {
        router.push('/guru/question-bank');
        router.refresh();
      } else {
        setError(json.error || 'Gagal memperbarui butir soal.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/guru/questions/${questionId}/duplicate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        router.push('/guru/question-bank');
      } else {
        alert(json.error || 'Gagal menduplikasi butir soal.');
      }
    } catch {
      alert('Gagal menduplikasi.');
    }
  };

  const isLocked = question?.lifecycleStatus === 'LOCKED';

  return (
    <GuruLayout
      title="Edit Butir Soal"
      subtitle={`Pembaruan naskah soal dan kunci jawaban • Versi aktif: v${expectedVersion}`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Bank Soal', href: '/guru/question-bank' },
        { label: `Edit Soal #${questionId.slice(0, 8)}` },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Duplikasi Sebagai Versi Baru
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpdate}
            isLoading={saving}
            disabled={isLocked}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Simpan Perubahan
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
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

        {isLocked && (
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between text-xs leading-relaxed">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Soal ini berstatus <strong>LOCKED</strong> karena sudah digunakan dalam snapshot naskah ujian.
                Untuk menjaga integritas hasil asesmen siswa, butir soal ini tidak dapat dimodifikasi langsung.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              className="border-purple-300 text-purple-700 bg-white shrink-0 ml-4"
            >
              Buat Salinan Baru
            </Button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">Memuat data butir soal...</div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary-600" />
                    Spesifikasi Materi & Tingkat Kesulitan
                  </CardTitle>
                  <StatusBadge status={question?.lifecycleStatus || 'DRAFT'} size="sm" />
                </div>
                <CardDescription>
                  Mapel: {question?.subjectName || '-'} ({question?.subjectCode || '-'})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Topik / Pokok Bahasan
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tingkat Kesulitan
                    </label>
                    <select
                      disabled={isLocked}
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="EASY">Mudah (LOTS)</option>
                      <option value="MEDIUM">Sedang (MOTS)</option>
                      <option value="HARD">Sukar (HOTS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Bobot Soal
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={weight}
                      onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
                      className="w-full py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Naskah Pertanyaan
                  </label>
                  <textarea
                    rows={4}
                    disabled={isLocked}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed font-medium disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    URL Media / Lampiran Gambar
                  </label>
                  <input
                    type="url"
                    disabled={isLocked}
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://... atau /uploads/..."
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-600" />
                  Kunci Jawaban & Rubrik Penilaian
                </CardTitle>
                <CardDescription>Format: {type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {type === 'PILIHAN_GANDA' && Array.isArray(options) && (
                  <div className="space-y-3">
                    {options.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => setAnswerKey(opt.id)}
                          className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                            answerKey === opt.id
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {opt.id}
                        </button>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...options];
                            updated[idx].text = e.target.value;
                            setOptions(updated);
                          }}
                          className="flex-1 py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {type === 'TRUE_FALSE' && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="radio"
                        disabled={isLocked}
                        name="tf"
                        checked={answerKey === 'TRUE'}
                        onChange={() => setAnswerKey('TRUE')}
                        className="text-emerald-600"
                      />
                      <span>BENAR (TRUE)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="radio"
                        disabled={isLocked}
                        name="tf"
                        checked={answerKey === 'FALSE'}
                        onChange={() => setAnswerKey('FALSE')}
                        className="text-rose-600"
                      />
                      <span>SALAH (FALSE)</span>
                    </label>
                  </div>
                )}

                {type === 'ISIAN_SINGKAT' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Kunci Jawaban Singkat
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={typeof answerKey === 'string' ? answerKey : ''}
                      onChange={(e) => setAnswerKey(e.target.value)}
                      className="w-full max-w-md py-2 px-3 text-sm rounded-xl border border-slate-300 font-mono font-bold"
                    />
                  </div>
                )}

                {type === 'ESSAY' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Rubrik Penilaian
                    </label>
                    <textarea
                      rows={4}
                      disabled={isLocked}
                      value={rubric}
                      onChange={(e) => setRubric(e.target.value)}
                      className="w-full p-3 text-sm rounded-xl border border-slate-300 font-mono text-xs leading-relaxed"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pembahasan / Penjelasan
                  </label>
                  <textarea
                    rows={3}
                    disabled={isLocked}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-300 leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Link href="/guru/question-bank">
                <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali
                </Button>
              </Link>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={saving}
                disabled={isLocked}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
      </div>
    </GuruLayout>
  );
}
