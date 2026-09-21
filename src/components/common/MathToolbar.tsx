'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  ChevronDown, 
  ChevronUp, 
  Sigma, 
  Sparkles,
  Layers,
  HelpCircle
} from 'lucide-react';

interface MathToolbarProps {
  onInsert: (snippet: string) => void;
  className?: string;
}

interface MathCategory {
  id: string;
  name: string;
  items: {
    label: string;
    latex: string;
    desc: string;
  }[];
}

const MATH_CATEGORIES: MathCategory[] = [
  {
    id: 'dasar',
    name: 'Dasar & Pecahan',
    items: [
      { label: 'a/b', latex: '$\\frac{a}{b}$', desc: 'Pecahan biasa' },
      { label: 'x²', latex: '$x^{2}$', desc: 'Pangkat dua' },
      { label: 'xⁿ', latex: '$x^{n}$', desc: 'Pangkat n' },
      { label: 'x₁', latex: '$x_{1}$', desc: 'Subskrip (indeks)' },
      { label: '√x', latex: '$\\sqrt{x}$', desc: 'Akar kuadrat' },
      { label: 'ⁿ√x', latex: '$\\sqrt[n]{x}$', desc: 'Akar pangkat n' },
      { label: '×', latex: '$\\times$', desc: 'Tanda kali' },
      { label: '÷', latex: '$\\div$', desc: 'Tanda bagi' },
      { label: '±', latex: '$\\pm$', desc: 'Plus minus' },
      { label: '·', latex: '$\\cdot$', desc: 'Titik perkalian' },
      { label: '%', latex: '\\%', desc: 'Persentase' },
      { label: '30°', latex: '$30^\\circ$', desc: 'Derajat sudut/suhu' },
    ],
  },
  {
    id: 'relasi',
    name: 'Relasi & Himpunan',
    items: [
      { label: '≤', latex: '$\\le$', desc: 'Kurang dari sama dengan' },
      { label: '≥', latex: '$\\ge$', desc: 'Lebih dari sama dengan' },
      { label: '≠', latex: '$\\ne$', desc: 'Tidak sama dengan' },
      { label: '≈', latex: '$\\approx$', desc: 'Mendekati / kira-kira' },
      { label: '∈', latex: '$\\in$', desc: 'Elemen anggota' },
      { label: '∉', latex: '$\\notin$', desc: 'Bukan anggota' },
      { label: '⊂', latex: '$\\subset$', desc: 'Himpunan bagian' },
      { label: '∅', latex: '$\\emptyset$', desc: 'Himpunan kosong' },
      { label: '∪', latex: '$\\cup$', desc: 'Gabungan (Union)' },
      { label: '∩', latex: '$\\cap$', desc: 'Irisan (Intersection)' },
      { label: '∞', latex: '$\\infty$', desc: 'Tak terhingga' },
    ],
  },
  {
    id: 'sains',
    name: 'Yunani & Sains',
    items: [
      { label: 'π', latex: '$\\pi$', desc: 'Pi (3.14)' },
      { label: 'α', latex: '$\\alpha$', desc: 'Alpha' },
      { label: 'β', latex: '$\\beta$', desc: 'Beta' },
      { label: 'θ', latex: '$\\theta$', desc: 'Theta (sudut)' },
      { label: 'Δ', latex: '$\\Delta$', desc: 'Delta (perubahan)' },
      { label: 'λ', latex: '$\\lambda$', desc: 'Lambda (panjang gelombang)' },
      { label: 'μ', latex: '$\\mu$', desc: 'Mu (mikro)' },
      { label: 'Ω', latex: '$\\Omega$', desc: 'Ohm (hambatan)' },
      { label: 'ρ', latex: '$\\rho$', desc: 'Rho (massa jenis)' },
      { label: '→', latex: '$\\rightarrow$', desc: 'Panah reaksi kimia / arah' },
      { label: '⇌', latex: '$\\rightleftharpoons$', desc: 'Kesetimbangan kimia' },
    ],
  },
  {
    id: 'kalkulus',
    name: 'Aljabar & Matriks',
    items: [
      { label: '∑', latex: '$\\sum_{i=1}^{n} x_i$', desc: 'Notasi Sigma (Penjumlahan)' },
      { label: '∫', latex: '$\\int_{a}^{b} f(x) \\, dx$', desc: 'Integral tentu' },
      { label: 'lim', latex: '$\\lim_{x \\to 0} f(x)$', desc: 'Limit fungsi' },
      { label: 'v⃗', latex: '$\\vec{v}$', desc: 'Notasi vektor' },
      { label: 'Matriks 2×2', latex: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$', desc: 'Matriks 2x2' },
      { label: 'Sistem {', latex: '$\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}$', desc: 'Sistem Persamaan Linier' },
    ],
  },
];

export default function MathToolbar({ onInsert, className = '' }: MathToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dasar');

  const currentCategory = MATH_CATEGORIES.find((c) => c.id === activeTab) || MATH_CATEGORIES[0];

  return (
    <div className={`border border-indigo-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm ${className}`}>
      {/* Header Toggle */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 dark:from-indigo-950/30 dark:to-slate-900 border-b border-indigo-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 tracking-wide">
            Toolbar Rumus Matematika & Sains (1-Klik Insert)
          </span>
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-medium">
            LaTeX KaTeX
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-slate-800 transition"
        >
          <span>{isOpen ? 'Tutup Toolbar' : 'Buka Tombol Rumus'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Palette */}
      {isOpen && (
        <div className="p-3 bg-slate-50/60 dark:bg-slate-900/70">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            {MATH_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                  activeTab === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Buttons Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
            {currentCategory.items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onInsert(item.latex)}
                title={item.desc}
                className="group relative flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition shadow-2xs text-center"
              >
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {item.label}
                </span>
                <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate w-full mt-0.5">
                  {item.desc}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Klik tombol di atas untuk otomatis menyisipkan kode rumus ke dalam teks soal.
            </span>
            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
              Format: $rumus$ (inline) atau $$rumus$$ (baris baru)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
