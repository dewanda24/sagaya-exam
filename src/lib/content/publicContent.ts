// Centralized Public Content Configuration for Sagaya Exam

export const siteConfig = {
  name: 'Sagaya Exam',
  tagline: 'Platform Ujian Digital Sekolah yang Aman, Terstruktur, dan Terstandarisasi',
  description:
    'Sistem evaluasi akademik digital berbasis token unik dengan pemantauan pengawas real-time, penilaian server-side, dan analisis butir soal mendalam.',
  url: 'https://exam.sagaya.id',
  institutionDefault: 'Platform CBT Nasional Terintegrasi',
  supportEmail: 'bantuan@sagaya.id',
  supportNote: 'Silakan hubungi administrator sekolah atau pengawas ruang Anda untuk bantuan teknis ujian.',
};

export const publicNavItems = [
  { label: 'Beranda', href: '/' },
  { label: 'Fitur', href: '/fitur' },
  { label: 'Panduan', href: '/panduan' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Status Sistem', href: '/status' },
  { label: 'Bantuan', href: '/kontak' },
];

export const valueProps = [
  {
    title: 'Manajemen Ujian Terstruktur',
    description:
      'Kelola bank soal, jadwal sesi, ruang kelas, dan rombongan belajar dalam satu portal terintegrasi tanpa redundansi data.',
    icon: 'Layers',
  },
  {
    title: 'Monitoring Pengawas Real-Time',
    description:
      'Pantau kehadiran peserta, status koneksi, durasi sisa waktu, dan log peringatan secara langsung per ruang ujian.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Penilaian Server-Side Akurat',
    description:
      'Komputasi skor otomatis dengan bobot butir soal, penalti jawaban salah, dan toleransi desimal presisi tinggi.',
    icon: 'CheckCircle2',
  },
  {
    title: 'Analitik & Laporan Standar',
    description:
      'Distribusi frekuensi nilai, daya pembeda, tingkat kesukaran soal, serta ekspor resmi PDF berita acara dan XLSX.',
    icon: 'BarChart3',
  },
];

export const examSteps = [
  {
    step: '01',
    title: 'Penyusunan Bank Soal',
    description:
      'Guru menyusun kisi-kisi dan butir soal (Pilihan Ganda, PG Kompleks, Benar/Salah, Menjodohkan, Isian, Essay) dengan formula matematika KaTeX.',
  },
  {
    step: '02',
    title: 'Penjadwalan & Sesi Ruang',
    description:
      'Admin sekolah mendistribusikan siswa ke dalam ruang ujian dan sesi waktu pelaksanaan dengan kuota terukur.',
  },
  {
    step: '03',
    title: 'Penerbitan Token Unik',
    description:
      'Sistem meng-generate token ujian unik per peserta yang aman, terikat sesi, dan tervalidasi kriptografis.',
  },
  {
    step: '04',
    title: 'Pelaksanaan Ujian Aman',
    description:
      'Siswa mengerjakan ujian dengan autosave real-time, proteksi kehilangan fokus, dan timer server-authoritative.',
  },
  {
    step: '05',
    title: 'Koreksi & Verifikasi',
    description:
      'Koreksi otomatis instan untuk soal objektif dan antarmuka koreksi essay berblind-grading bagi dewan guru.',
  },
  {
    step: '06',
    title: 'Publikasi Hasil & Rekap',
    description:
      'Penerbitan nilai resmi, analisis reliabilitas soal, dan pencetakan leger nilai siap pakai untuk pelaporan sekolah.',
  },
];

export const platformFeatures = [
  {
    category: 'Bank Soal & Kurikulum',
    items: [
      {
        title: '6 Tipe Soal Berstandar Asesmen',
        desc: 'Mendukung PG Biasa, PG Kompleks, Benar/Salah, Menjodohkan, Isian Singkat, dan Essay.',
        icon: 'BookOpen',
      },
      {
        title: 'Dukungan Formula Matematika & Sains',
        desc: 'Render formula LaTeX/KaTeX cepat dan toolbar simbol sains yang ramah pengguna.',
        icon: 'Sparkles',
      },
      {
        title: 'Snapshot Immutability',
        desc: 'Soal dibekukan dalam snapshot kekal saat ujian dimulai, kebal terhadap perubahan draf soal berikutnya.',
        icon: 'Lock',
      },
    ],
  },
  {
    category: 'Pelaksanaan & Pengawasan',
    items: [
      {
        title: 'Akses Tanpa Akun Siswa Kompleks',
        desc: 'Siswa masuk menggunakan token unik tanpa kerumitan lupa password akun.',
        icon: 'KeyRound',
      },
      {
        title: 'Autosave & Concurrency Lock',
        desc: 'Setiap jawaban disimpan otomatis dengan versioning untuk mencegah overwrite data.',
        icon: 'RotateCw',
      },
      {
        title: 'Pusat Kendali Pengawas Ruang',
        desc: 'Broadcast pesan ke peserta, reset status terputus, dan monitoring token dinamis.',
        icon: 'Eye',
      },
    ],
  },
  {
    category: 'Penilaian & Pelaporan',
    items: [
      {
        title: 'Scoring Engine Server-Side',
        desc: 'Komputasi nilai dilakukan murni di server, bebas manipulasi client-side.',
        icon: 'Calculator',
      },
      {
        title: 'Analisis Butir Soal Pedagogis',
        desc: 'Tingkat kesukaran, daya pembeda butir soal, dan korelasi capaian KKM.',
        icon: 'BarChart3',
      },
      {
        title: 'Ekspor Dokumen Terlindungi',
        desc: 'Cetak berita acara, daftar hadir, dan kartu peserta dengan sanitasi formula injection.',
        icon: 'FileSpreadsheet',
      },
    ],
  },
];

export const securityHighlights = [
  'Autentikasi terpusat berbasis session cookie HTTP-only yang aman',
  'Role-Based Access Control (RBAC) ketat untuk Super Admin, Admin, Guru, dan Pengawas',
  'Isolasi data antar sekolah (Tenant Isolation) terverifikasi di level basis data',
  'Perhitungan skor server-side (Zero Client Leakage)',
  'Snapshot butir soal beku (Immutable Question Snapshot)',
  'Audit trail komprehensif mencatat setiap aktivitas sensitif',
  'Proteksi Formula Injection pada ekspor berkas spreadsheet',
];

export const roleBenefits = [
  {
    role: 'Admin Sekolah',
    badge: 'Administrasi',
    points: [
      'Manajemen data rombel, kelas, mata pelajaran, dan profil pendidik',
      'Pengaturan jadwal, alokasi ruang ujian, dan pembagian sesi',
      'Pencetakan kartu peserta ujian dan berita acara pelaksanaan',
      'Rekapitulasi nilai dan pengawasan audit trail operasional sekolah',
    ],
  },
  {
    role: 'Guru Mata Pelajaran',
    badge: 'Pendidik',
    points: [
      'Penyusunan butir soal kaya format dengan gambar dan rumus sains',
      'Koreksi jawaban essay siswa secara terstruktur dengan rubrik',
      'Analisis daya pembeda dan indeks kesukaran butir soal',
      'Pengelolaan bank soal mandiri yang dapat digunakan lintas tahun',
    ],
  },
  {
    role: 'Pengawas Ruangan',
    badge: 'Operasional',
    points: [
      'Dasbor live monitoring status ujian seluruh peserta di ruangan',
      'Pemulihan sesi siswa saat terjadi gangguan perangkat / koneksi',
      'Penyampaian pengumuman broadcast langsung ke layar siswa',
      'Verifikasi daftar hadir dan berita acara ruangan resmi',
    ],
  },
  {
    role: 'Peserta Didik (Siswa)',
    badge: 'Peserta',
    points: [
      'Masuk ujian praktis menggunakan token ujian yang diberikan panitia',
      'Antarmuka pengerjaan soal yang jernih, tenang, dan minim distraksi',
      'Penyimpanan jawaban otomatis real-time ke server',
      'Akses lembar hasil ujian resmi setelah dipublikasikan sekolah',
    ],
  },
];

export const faqItems = [
  {
    category: 'Umum',
    questions: [
      {
        q: 'Apa itu platform Sagaya Exam?',
        a: 'Sagaya Exam adalah platform sistem evaluasi ujian digital (Computer-Based Test) yang dirancang khusus untuk memenuhi standar ujian sekolah, asesmen sumatif, dan evaluasi berkala secara aman, tertib, dan transparan.',
      },
      {
        q: 'Apakah sekolah kami dapat menggunakan Sagaya Exam?',
        a: 'Ya, Sagaya Exam mendukung arsitektur multi-sekolah dengan isolasi data antar sekolah yang terjamin keamanannya.',
      },
      {
        q: 'Apakah Sagaya Exam memerlukan instalasi aplikasi khusus di komputer siswa?',
        a: 'Tidak. Siswa dapat mengakses ujian secara langsung melalui browser web modern (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari) di laptop, PC, tablet, maupun smartphone.',
      },
    ],
  },
  {
    category: 'Peserta Ujian (Siswa)',
    questions: [
      {
        q: 'Bagaimana cara siswa mendapatkan token ujian?',
        a: 'Token ujian dibagikan secara resmi oleh panitia ujian atau pengawas ruangan pada kartu peserta ujian atau sesaat sebelum jadwal sesi ujian dimulai.',
      },
      {
        q: 'Apa yang harus dilakukan jika token dinyatakan tidak dapat digunakan?',
        a: 'Pastikan format token sudah sesuai (contoh: ABCD-1234). Jika pesan kesalahan tetap muncul, segera hubungi pengawas ruang untuk memverifikasi jadwal sesi dan status token Anda.',
      },
      {
        q: 'Apakah jawaban saya hilang jika koneksi internet terputus di tengah ujian?',
        a: 'Tidak. Setiap jawaban yang Anda klik disimpan secara instan ke server. Jika koneksi terputus, sistem akan menyimpan jawaban lokal dan menyinkronkannya kembali begitu jaringan pulih.',
      },
      {
        q: 'Bagaimana jika browser tertutup atau laptop restart tanpa sengaja?',
        a: 'Anda dapat membuka kembali halaman ujian dengan memasukkan token yang sama pada perangkat yang sama. Timer server tetap menghitung waktu ujian secara berkesinambungan.',
      },
    ],
  },
  {
    category: 'Guru & Admin Sekolah',
    questions: [
      {
        q: 'Bagaimana cara guru menyusun soal dengan formula matematika?',
        a: 'Guru dapat menggunakan editor soal terintegrasi yang telah dilengkapi toolbar formula matematika LaTeX/KaTeX cepat untuk simbol akar, pecahan, integral, matriks, dan huruf Yunani.',
      },
      {
        q: 'Apakah hasil ujian langsung diketahui siswa?',
        a: 'Hasil ujian hanya dapat dilihat oleh siswa apabila dewan guru atau admin sekolah telah menyelesaikan penilaian dan menetapkan status hasil ke mode PUBLISHED.',
      },
    ],
  },
];
