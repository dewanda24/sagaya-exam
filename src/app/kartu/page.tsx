'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  CreditCard,
  Search,
  Printer,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { ExamCardData } from '@/lib/core/types';

function KartuUjianContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('query') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardData, setCardData] = useState<ExamCardData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<string>('');

  const fetchCard = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/student/check-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Data siswa tidak ditemukan.');
        setCardData(null);
      } else {
        setCardData(data.data);
        // Generate QR code for student credential verification
        const qrContent = `SAGAYA-EXAM:${data.data.student.nisn}:${data.data.student.cardAccessCode}`;
        const qrDataUri = await QRCode.toDataURL(qrContent, { width: 140, margin: 1 });
        setQrCodeUrl(qrDataUri);
      }
    } catch (err: any) {
      setError('Gagal menghubungi server.');
      setCardData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      fetchCard(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCard(searchQuery);
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(''), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem 0 3.5rem' }}>
        <div className="container">
          {/* Header Search Section (Hidden on Print) */}
          <div className="no-print" style={{ maxWidth: '680px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Cek Kartu Ujian Digital
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Masukkan NISN atau Kode Akses Kartu siswa yang telah dibagikan sekolah untuk melihat kartu dan token ujian.
            </p>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={18}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Masukkan NISN (e.g. 0061234567) atau PIN (e.g. SG-9921)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.75rem' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0 1.5rem' }}>
                {loading ? 'Memuat...' : 'Cari Kartu'}
              </button>
            </form>


            {error && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#dc2626', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid #fecaca' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Render Card if Found */}
          {cardData && (
            <div>
              {/* Action Toolbar on Top of Card (Hidden on Print) */}
              <div
                className="no-print"
                style={{
                  maxWidth: '750px',
                  margin: '0 auto 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Kartu terverifikasi valid</span>
                </div>

                <button type="button" onClick={handlePrint} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  <Printer size={16} />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>

              {/* The Official Printable Exam Card */}
              <div className="exam-card-wrapper">
                <div className="exam-card-header">
                  <div className="exam-card-school-logo">
                    <GraduationCap size={32} />
                  </div>
                  <div className="exam-card-title-block">
                    <h2>KARTU PESERTA UJIAN DIGITAL</h2>
                    <p>SMA NEGERI 1 SAGAYA &bull; TAHUN AJARAN 2025/2026</p>
                  </div>
                </div>

                <div className="exam-card-body-grid">
                  <div>
                    <table className="student-info-table">
                      <tbody>
                        <tr>
                          <td className="label">Nama Siswa</td>
                          <td className="value">: {cardData.student.fullName}</td>
                        </tr>
                        <tr>
                          <td className="label">NIS / NISN</td>
                          <td className="value">: {cardData.student.nis} / {cardData.student.nisn}</td>
                        </tr>
                        <tr>
                          <td className="label">Kelas / Rombel</td>
                          <td className="value">: {cardData.student.classRoomName}</td>
                        </tr>
                        <tr>
                          <td className="label">Kode Akses Siswa</td>
                          <td className="value">: <span style={{ fontFamily: 'var(--font-mono)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{cardData.student.cardAccessCode}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="exam-card-qr-box">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Verifikasi Kartu" />
                    ) : (
                      <div style={{ width: '100px', height: '100px', background: '#e2e8f0' }} />
                    )}
                    <span className="exam-card-qr-label">QR Verifikasi Kartu</span>
                  </div>
                </div>

                {/* Exam Schedule & Token List */}
                {!(cardData as any).authenticatedViaCode && (
                  <div className="no-print" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Perlindungan Privasi Siswa:</strong> Token ujian disembunyikan. Masukkan <strong>Kode Akses Kartu</strong> siswa pada kolom pencarian di atas untuk melihat token ujian Anda secara penuh.
                    </div>
                  </div>
                )}

                <h4 style={{ fontSize: '0.925rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  Jadwal Ujian & Token Individual:
                </h4>

                <table className="exam-schedule-table">
                  <thead>
                    <tr>
                      <th>Mata Pelajaran</th>
                      <th>Jadwal / Ruang</th>
                      <th>Durasi</th>
                      <th>Token Ujian</th>
                      <th className="no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardData.exams.map((ex) => (
                      <tr key={ex.examId}>
                        <td>
                          <strong>{ex.subjectName}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ex.examTitle}</div>
                        </td>
                        <td>
                          <div>{new Date(ex.startTime).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ex.room}</div>
                        </td>
                        <td>{ex.durationMinutes} Menit</td>
                        <td>
                          <span className="token-highlight">{ex.token}</span>
                        </td>
                        <td className="no-print">
                          {(ex as any).isTokenMasked ? (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                              Terkunci
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => router.push(`/ujian?token=${ex.token}`)}
                              className="btn btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              <span>Gunakan</span>
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="exam-card-notes">
                  <strong>Tata Tertib & Petunjuk Penting:</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem' }}>
                    <li>Token ujian di atas bersifat unik untuk nama Anda dan tidak boleh dibagikan kepada peserta lain.</li>
                    <li>Token hanya dapat digunakan pada perangkat yang bersangkutan selama jam pelaksanaan ujian.</li>
                    <li>Bila laptop mati atau koneksi terputus, segera hubungi Pengawas Ruang untuk bantuan recovery.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function KartuPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Memuat Halaman Kartu...</div>}>
      <KartuUjianContent />
    </Suspense>
  );
}
