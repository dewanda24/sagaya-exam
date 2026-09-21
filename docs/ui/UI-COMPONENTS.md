# SAGAYA EXAM — UI COMPONENTS DOCUMENTATION

**Directory**: `src/components/ui/`  
**Barrel Export**: `import { ... } from '@/components/ui'`  
**Icons**: `lucide-react` exclusively  

---

## 1. Action Components

### Button
Standard button with 7 semantic variants and 3 sizes. Supports loading state with automatic spinner and disabled interaction.
```tsx
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';

<Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
  Buat Ujian Baru
</Button>
<Button variant="danger" size="sm" isLoading={isDeleting}>
  Hapus
</Button>
<Button variant="secondary" size="md">
  Batal
</Button>
```

### IconButton
Accessible icon-only button requiring mandatory `aria-label`.
```tsx
import { IconButton } from '@/components/ui';
import { Edit2 } from 'lucide-react';

<IconButton
  icon={<Edit2 className="w-4 h-4" />}
  aria-label="Edit Soal"
  variant="ghost"
  size="sm"
  onClick={handleEdit}
/>
```

---

## 2. Form Components

### Input & SearchInput
Inputs with built-in label, helper text, error text, accessible `aria-invalid` / `aria-describedby`, prefix/suffix icon slots, and loading indicator.
```tsx
import { Input, SearchInput } from '@/components/ui';

<Input
  label="Nama Mata Pelajaran"
  placeholder="Contoh: Matematika Peminatan"
  required
  error={errors.subjectName}
  value={subjectName}
  onChange={(e) => setSubjectName(e.target.value)}
/>

<SearchInput
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  onClear={() => setSearch('')}
  placeholder="Cari nama siswa atau NISN..."
/>
```

### Textarea
Auto-styled multiline input with character guidelines and error validation.
```tsx
import { Textarea } from '@/components/ui';

<Textarea
  label="Petunjuk Pengerjaan Soal"
  rows={4}
  error={errors.instructions}
  value={instructions}
  onChange={(e) => setInstructions(e.target.value)}
/>
```

### Select
Standardized select control with custom dropdown chevron and accessible state.
```tsx
import { Select } from '@/components/ui';

<Select
  label="Tingkat Kelas"
  options={[
    { value: '10', label: 'Kelas 10' },
    { value: '11', label: 'Kelas 11' },
    { value: '12', label: 'Kelas 12' },
  ]}
  value={selectedGrade}
  onChange={(e) => setSelectedGrade(e.target.value)}
/>
```

### Checkbox & RadioGroup & Switch
```tsx
import { Checkbox, RadioGroup, Switch } from '@/components/ui';

<Checkbox
  label="Acak Urutan Soal (Shuffle Questions)"
  description="Setiap siswa menerima urutan butir soal yang diacak secara deterministik."
  checked={shuffleQuestions}
  onChange={(e) => setShuffleQuestions(e.target.checked)}
/>

<RadioGroup
  name="scoringMethod"
  label="Metode Penilaian Pilihan Ganda Kompleks"
  value={method}
  onChange={setMethod}
  options={[
    { value: 'ALL_OR_NOTHING', label: 'All or Nothing', description: 'Nilai penuh jika semua benar, 0 jika ada salah.' },
    { value: 'PARTIAL_CREDIT', label: 'Sebagian (Partial Credit)', description: 'Bobot proporsional dihitung per opsi benar.' },
  ]}
/>

<Switch
  label="Kunci Sesi Otomatis Saat Selesai"
  checked={autoLock}
  onChange={(e) => setAutoLock(e.target.checked)}
/>
```

### FormField, FormSection, FormActions
Structured form layouts with clear sectioning and responsive action alignment.
```tsx
import { FormSection, FormField, FormActions, Button } from '@/components/ui';

<FormSection title="Konfigurasi Jadwal Ujian" description="Atur waktu mulai, durasi, dan toleransi keterlambatan.">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField label="Waktu Mulai" required error={errors.startTime}>
      <DatePicker showTime value={startTime} onChange={(e) => setStartTime(e.target.value)} />
    </FormField>
    <FormField label="Durasi (Menit)" required>
      <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
    </FormField>
  </div>
  <FormActions align="right">
    <Button variant="secondary">Batal</Button>
    <Button variant="primary">Simpan Perubahan</Button>
  </FormActions>
</FormSection>
```

---

## 3. Feedback & Overlay Components

### Badge & StatusBadge
Unified badge component rendering all Sagaya Exam lifecycle statuses with appropriate colors, labels, and icons.
```tsx
import { Badge, StatusBadge } from '@/components/ui';

<StatusBadge status="PUBLISHED" />
<StatusBadge status="IN_PROGRESS" />
<StatusBadge status="PARTIALLY_GRADED" />
<Badge variant="primary" pulse>LIVE</Badge>
```

### Alert
Contextual alert banners for important announcements, warnings, or error summaries.
```tsx
import { Alert } from '@/components/ui';

<Alert variant="warning" title="Perhatian: Sesi Berlangsung">
  Terdapat 42 siswa yang sedang aktif mengerjakan. Mengubah durasi saat ini akan mempengaruhi hitungan mundur seluruh siswa.
</Alert>
```

### Toast (ToastProvider & useToast)
Lightweight floating toast notifications for transient confirmations.
```tsx
import { useToast } from '@/components/ui';

const { success, error } = useToast();
success('Kunci jawaban berhasil diperbarui');
error('Gagal memproses ekspor berkas');
```

### Modal & ConfirmDialog
Accessible dialogs featuring focus trapping, backdrop dismiss, and ESC listener.
```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter, ConfirmDialog, Button } from '@/components/ui';

<ConfirmDialog
  isOpen={isDeleteOpen}
  onClose={() => setIsDeleteOpen(false)}
  onConfirm={handleDelete}
  title="Hapus Sesi Ujian"
  description="Seluruh data token dan kehadiran terkait sesi ini akan dihapus secara permanen."
  targetName="Ujian Akhir Semester Fisika XII"
  confirmLabel="Ya, Hapus Sesi"
  confirmVariant="danger"
  isLoading={isDeleting}
/>
```

---

## 4. Data Display & Navigation Components

### Table, Pagination, DataTable
Feature-rich data table with sorting, filtering, responsive mobile fallback card renderer, and skeleton states.
```tsx
import { DataTable } from '@/components/ui';

<DataTable
  data={students}
  columns={[
    { key: 'nisn', header: 'NISN', sortable: true },
    { key: 'name', header: 'Nama Siswa', sortable: true },
    { key: 'className', header: 'Kelas' },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
  ]}
  pageSize={10}
  itemName="siswa"
  isLoading={loading}
  emptyTitle="Belum Ada Siswa Terdaftar"
  emptyDescription="Import data siswa melalui format Excel atau tambahkan siswa secara manual."
  renderMobileCard={(row) => (
    <div className="flex justify-between items-center">
      <div>
        <p className="font-bold text-sm">{row.name}</p>
        <p className="text-xs text-text-muted">{row.nisn} — {row.className}</p>
      </div>
      <StatusBadge status={row.status} size="sm" />
    </div>
  )}
/>
```

### DashboardShell
Standard application shell for all user roles (Super Admin, School Admin, Guru, Pengawas). Provides responsive topbar, collapsible keyboard-accessible sidebar, role-aware navigation, and drawer navigation on mobile.
```tsx
import { DashboardShell, PageHeader } from '@/components/ui';

<DashboardShell currentUser={currentUser} title="Dashboard Administrator">
  <PageHeader
    title="Data Siswa & Rombel"
    subtitle="Kelola seluruh peserta didik dan pembagian ruang kelas."
    actions={<Button variant="primary">Tambah Siswa</Button>}
  />
  {/* Page Content */}
</DashboardShell>
```
