'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { AccordionItem } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { faqItems, siteConfig } from '@/lib/content/publicContent';

export default function FaqPage() {
  return (
    <PublicLayout>
      {/* Header Banner */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant="primary">Pusat Tanya Jawab</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Pertanyaan yang Sering Diajukan (FAQ)
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Temukan jawaban cepat mengenai mekanisme pengerjaan ujian, token akses,
            kendala teknis peramban, dan pengelolaan sistem evaluasi.
          </p>
        </div>
      </section>

      {/* Accordion Categories */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        {faqItems.map((cat, cIdx) => (
          <div key={cIdx} className="space-y-3">
            <h2 className="text-base font-bold text-text-primary border-b border-divider pb-2 uppercase tracking-wider">
              {cat.category}
            </h2>
            <div className="space-y-2.5">
              {cat.questions.map((item, qIdx) => (
                <AccordionItem
                  key={qIdx}
                  title={item.q}
                  defaultOpen={cIdx === 0 && qIdx === 0}
                >
                  <p className="text-xs sm:text-sm leading-relaxed text-text-secondary">
                    {item.a}
                  </p>
                </AccordionItem>
              ))}
            </div>
          </div>
        ))}

        {/* Still need help */}
        <div className="p-6 rounded-lg bg-surface-subtle border border-border text-center space-y-3 mt-12">
          <h3 className="text-base font-bold text-text-primary">
            Masih Mengalami Kendala yang Belum Terjawab?
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
            Silakan hubungi pengawas ruangan jika Anda sedang di ruang ujian, atau hubungi
            administrator sekolah Anda.
          </p>
          <Link href="/kontak">
            <Button variant="secondary" size="sm">
              Hubungi Bantuan Sekolah
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
