'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BookOpen,
  PlusCircle,
  Layers,
  ArrowRight,
  AlertCircle,
  RotateCw,
  Search,
} from 'lucide-react';

export default function GuruSubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guru/subjects');
      const json = await res.json();
      if (json.success) {
        setSubjects(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat daftar mata pelajaran.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const filteredSubjects = subjects.filter((s) => {
    const q = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  return (
    <GuruLayout
      title="Mata Pelajaran Diampu"
      subtitle="Daftar mata pelajaran resmi yang Anda ampu dan kelola butir soalnya di satuan pendidikan"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Mata Pelajaran' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubjects}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Link href="/guru/question-bank/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Buat Soal Mapel
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
            <Button variant="danger" size="sm" onClick={loadSubjects}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari mata pelajaran atau kode..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Total <span className="font-bold text-slate-800">{filteredSubjects.length}</span> mata pelajaran diampu
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Memuat daftar mata pelajaran Anda...
          </div>
        ) : filteredSubjects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-800">
                {searchTerm ? 'Tidak ada mata pelajaran yang cocok dengan pencarian.' : 'Belum ada mata pelajaran yang ditugaskan.'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm
                  ? 'Silakan coba kata kunci pencarian yang berbeda.'
                  : 'Penugasan mata pelajaran diatur oleh Administrator Sekolah. Silakan hubungi admin sekolah jika penugasan belum sesuai.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSubjects.map((s) => (
              <Card
                key={s.id}
                className="hover:border-primary-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 font-mono text-xs font-bold border border-primary-200">
                      {s.code}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {s.category || 'UMUM'}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-3">{s.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">Jenjang: {s.level || 'Semua Tingkat'}</p>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Layers className="w-4 h-4 text-primary-500" />
                      <span>{s.questionCount} butir soal dibuat</span>
                    </div>
                    <Link
                      href={`/guru/question-bank?subjectId=${s.id}`}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      Buka Soal <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </GuruLayout>
  );
}
