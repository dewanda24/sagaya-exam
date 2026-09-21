'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import {
  CheckCircle2,
  XCircle,
  Layers,
  Search,
  ArrowLeft,
  AlertCircle,
  RotateCw,
  Eye,
  FileCheck,
} from 'lucide-react';

export default function GuruQuestionReviewPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [inspectQuestion, setInspectQuestion] = useState<any | null>(null);

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Approve Confirm
  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const loadSubmittedQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guru/questions?status=SUBMITTED&limit=50');
      const json = await res.json();
      if (json.success) {
        setQuestions(json.questions || []);
      } else {
        setError(json.error || 'Gagal memuat antrean review soal.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmittedQuestions();
  }, []);

  const handleApprove = async () => {
    if (!approveConfirmId) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/guru/questions/${approveConfirmId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      const json = await res.json();
      if (json.success) {
        setApproveConfirmId(null);
        if (inspectQuestion?.id === approveConfirmId) setInspectQuestion(null);
        loadSubmittedQuestions();
      } else {
        alert(json.error || 'Gagal menyetujui butir soal.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) {
      alert('Alasan penolakan / revisi wajib diisi.');
      return;
    }
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/guru/questions/${rejectId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setRejectModalOpen(false);
        setRejectId(null);
        setRejectReason('');
        if (inspectQuestion?.id === rejectId) setInspectQuestion(null);
        loadSubmittedQuestions();
      } else {
        alert(json.error || 'Gagal mengembalikan butir soal.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsRejecting(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'topic',
      header: 'Topik & Butir Soal',
      cell: (row) => (
        <div className="space-y-1 max-w-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {row.topic}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">v{row.version || 1}</span>
          </div>
          <p className="text-sm font-medium text-slate-900 line-clamp-2">{row.questionText}</p>
        </div>
      ),
    },
    {
      key: 'subjectName',
      header: 'Mata Pelajaran & Tipe',
      cell: (row) => (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-800">{row.subjectName || '-'}</div>
          <Badge variant="neutral" size="sm">
            {row.type}
          </Badge>
        </div>
      ),
    },
    {
      key: 'authorName',
      header: 'Penyusun Soal',
      cell: (row) => (
        <div className="text-xs text-slate-700 font-medium">{row.authorName || 'Pengajar'}</div>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi Moderasi',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectQuestion(row)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            Periksa
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setApproveConfirmId(row.id)}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Setujui
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRejectId(row.id);
              setRejectModalOpen(true);
            }}
            className="text-rose-700 border-rose-300 hover:bg-rose-50"
            leftIcon={<XCircle className="w-3.5 h-3.5" />}
          >
            Revisi
          </Button>
        </div>
      ),
    },
  ];

  return (
    <GuruLayout
      title="Moderasi & Review Butir Soal"
      subtitle="Verifikasi standar materi, validitas pedagogik, dan keabsahan kunci jawaban butir soal yang diajukan pengajar"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Bank Soal', href: '/guru/question-bank' },
        { label: 'Antrean Review' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubmittedQuestions}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Link href="/guru/question-bank">
            <Button variant="primary" size="sm" leftIcon={<Layers className="w-4 h-4" />}>
              Buka Semua Soal
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Antrean DataTable */}
        <DataTable
          data={questions}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadSubmittedQuestions}
          emptyTitle="Tidak Ada Antrean Review"
          emptyDescription="Saat ini seluruh butir soal yang diajukan telah dimoderasi dan disetujui."
          pageSize={15}
          itemName="antrean soal"
        />
      </div>

      {/* INSPECT MODAL */}
      <Modal
        isOpen={Boolean(inspectQuestion)}
        onClose={() => setInspectQuestion(null)}
        title="Lembar Telaah Butir Soal"
        size="lg"
      >
        {inspectQuestion && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
              <Badge variant="primary" size="sm">
                Topik: {inspectQuestion.topic}
              </Badge>
              <Badge variant="neutral" size="sm">
                Tipe: {inspectQuestion.type}
              </Badge>
              <Badge variant="info" size="sm">
                Kesulitan: {inspectQuestion.difficulty}
              </Badge>
              <span className="text-xs text-slate-500 ml-auto">
                Penyusun: <strong>{inspectQuestion.authorName || 'Pengajar'}</strong>
              </span>
            </div>

            {/* Stimulus */}
            {inspectQuestion.stimulusText && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                {inspectQuestion.stimulusTitle && (
                  <h4 className="font-bold text-xs uppercase text-slate-600">
                    {inspectQuestion.stimulusTitle}
                  </h4>
                )}
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {inspectQuestion.stimulusText}
                </p>
              </div>
            )}

            {/* Question Text */}
            <div className="text-slate-900 font-semibold text-base leading-relaxed whitespace-pre-wrap">
              {inspectQuestion.questionText}
            </div>

            {/* Options */}
            {['PILIHAN_GANDA', 'PG_KOMPLEKS'].includes(inspectQuestion.type) &&
              Array.isArray(inspectQuestion.options) && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Pilihan Jawaban:
                  </span>
                  {inspectQuestion.options.map((opt: any) => {
                    const isKey =
                      inspectQuestion.type === 'PILIHAN_GANDA'
                        ? inspectQuestion.answerKey === opt.id
                        : Array.isArray(inspectQuestion.answerKey) &&
                          inspectQuestion.answerKey.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-sm flex items-start gap-3 ${
                          isKey
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isKey ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span className="flex-1 leading-relaxed">{opt.text}</span>
                        {isKey && (
                          <span className="text-[11px] font-bold text-emerald-700 shrink-0 bg-emerald-100 px-2 py-0.5 rounded">
                            Kunci Jawaban
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {/* Explanation */}
            {inspectQuestion.explanation && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <span className="font-bold uppercase tracking-wider block">Pembahasan Soal:</span>
                <p className="leading-relaxed">{inspectQuestion.explanation}</p>
              </div>
            )}

            {/* Bottom Review Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setInspectQuestion(null)}>
                Tutup Lembar Telaah
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRejectId(inspectQuestion.id);
                    setRejectModalOpen(true);
                  }}
                  className="text-rose-700 border-rose-300 hover:bg-rose-50"
                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Minta Revisi
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setApproveConfirmId(inspectQuestion.id)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Setujui Soal (APPROVED)
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* APPROVE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(approveConfirmId)}
        onClose={() => setApproveConfirmId(null)}
        onConfirm={handleApprove}
        title="Setujui Butir Soal Ini?"
        description="Soal yang disetujui akan berubah status menjadi APPROVED dan siap dimasukkan ke dalam naskah ujian resmi sekolah."
        confirmLabel="Ya, Setujui Soal"
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isApproving}
      />

      {/* REJECT MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Catatan Revisi & Penolakan Butir Soal"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Tuliskan alasan penolakan secara konstruktif agar pengajar dapat memperbaiki butir soal
            sesuai kaidah penilaian yang berlaku.
          </p>

          <textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Opsi B ambigu, mohon perjelas stimulus bacaan..."
            className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
          />

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isRejecting}
              onClick={handleReject}
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
            >
              Kirimkan Catatan Revisi
            </Button>
          </div>
        </div>
      </Modal>
    </GuruLayout>
  );
}
