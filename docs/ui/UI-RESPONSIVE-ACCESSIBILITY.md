# SAGAYA EXAM — RESPONSIVE & ACCESSIBILITY ARCHITECTURE (UI-10)

## 1. Overview & WCAG 2.2 AA Conformance Standards

Sprint **UI-10: Responsive + Accessibility Final Pass** establishes cross-platform compatibility and accessibility guarantees across all roles and workspaces in Sagaya Exam:
- **Public**: Portal Beranda, Login, Entry Siswa CBT
- **Superadmin**: Master Management, Tenant Control, System Health
- **Admin Sekolah**: Academics, Teachers, Classes, Rooms, Master Data
- **Guru**: Bank Soal, Matriks Ujian, Hasil & Analisis Butir Soal
- **Pengawas**: Live Monitoring Radar, Intervensi Sesi, Berita Acara, Cetak Kartu
- **Student Exam Interface**: Focus & Comfort Mode, Split Layout, Soal Drawer, Autosave Indicator

---

## 2. Accessibility Tokens & Global CSS Foundation

Located in `src/styles/globals.css`:
- **Skip Link Landmark**:
  ```css
  .skip-to-content {
    position: absolute;
    left: -9999px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    z-index: 1000;
  }
  .skip-to-content:focus {
    position: fixed;
    top: 1rem;
    left: 1rem;
    width: auto;
    height: auto;
    padding: 0.75rem 1.25rem;
    background: #0f172a;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.875rem;
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    outline: 3px solid #2563eb;
    outline-offset: 2px;
  }
  ```
- **Motion Reduction (`prefers-reduced-motion: reduce`)**:
  All decorative CSS animations and transitions are automatically collapsed to `0.01ms` when the user enables reduced motion on their OS/browser.
- **Safe Area Insets**:
  `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe` utilizing `env(safe-area-inset-*)` ensure notch and home indicator clearance on iOS and modern Android mobile browsers.
- **Enhanced Focus Rings**:
  High-contrast 2px outline with 2px offset applied globally on `:focus-visible` without intrusive outlines on regular mouse clicks.

---

## 3. Keyboard Navigation & Landmark Semantics

### 3.1 Role Layouts & Sidebars
All workspace layouts (`AdminLayout`, `GuruLayout`, `PengawasLayout`, `SuperAdminLayout`) implement:
- Universal keyboard bypass skip link: `<a href="#main-content" className="skip-to-content">Lewati ke konten utama</a>`
- Semantic `<main id="main-content" tabIndex={-1} role="main">` landmark
- Accessible sidebar with `role="navigation"`, `id="main-sidebar"`, and descriptive `aria-label`
- Mobile drawers listen to `Escape` key events to close immediately and return focus cleanly
- Mobile hamburger buttons have explicit `aria-controls="main-sidebar"`, `aria-label="Buka Menu Navigasi"`, and `min-touch-target`

### 3.2 Dialogs, Focus Traps & Restoration
- `src/components/ui/Modal.tsx`:
  - `role="dialog"` and `aria-modal="true"`
  - Traps `Tab` and `Shift+Tab` within the dialog container
  - Automatically captures `document.activeElement` prior to opening and restores focus upon dismissal
  - Automatically auto-focuses the first interactive element inside the modal on open
  - Listens to `Escape` key to close

### 3.3 Tables & Data Grids
- `src/components/ui/Table.tsx`:
  - Enclosed in a scrollable container with `tabIndex={0}`, `role="region"`, and `aria-label="Tabel data"`
  - Keyboard users can focus the table container and scroll horizontally with arrow keys
  - `<TableHead>` elements automatically emit `scope="col"` for screen readers

### 3.4 Pagination
- `src/components/ui/Pagination.tsx`:
  - Semantic `<nav role="navigation" aria-label="Navigasi Halaman">`
  - Current active page explicitly declared with `aria-current="page"`
  - Previous/Next and page number buttons have descriptive `aria-label`s and enlarged touch targets (minimum 38px/44px)

### 3.5 Tabs & Tabpanels
- `src/components/ui/Tabs.tsx`:
  - Container with `role="tablist"`
  - Tab buttons with `role="tab"`, `id="tab-[val]"`, `aria-controls="tabpanel-[val]"`, and `tabIndex={isSelected ? 0 : -1}`
  - Tab panels with `role="tabpanel"`, `id="tabpanel-[val]"`, `aria-labelledby="tab-[val]"`, and `tabIndex={0}`

### 3.6 Form Fields & Error Announcements
- `src/components/ui/FormField.tsx` & `src/components/ui/Input.tsx`:
  - Label connected via `htmlFor` matching input `id`
  - Required indicators with `<span className="text-danger">*</span>`
  - Error messages emit `role="alert"` and `aria-live="assertive"`
  - Inputs specify `aria-invalid={Boolean(error)}` and `aria-describedby` pointing to error/helper text

---

## 4. Student Exam Interface (CBT Engine)

In `src/app/ujian/[sessionId]/page.tsx` & `src/styles/cbt.css`:
- **Single Choice (`PILIHAN_GANDA`)**:
  - Container with `role="radiogroup"` and `aria-label="Pilihan Jawaban"`
  - Options with `role="radio"`, `aria-checked={isSelected}`, `tabIndex={0}`, with keyboard selection on `Space` or `Enter`
  - Minimum touch target height: 48px
- **Multiple Choice (`PG_KOMPLEKS`)**:
  - Container with `role="group"` and `aria-label="Pilihan Jawaban Majemuk"`
  - Options with `role="checkbox"`, `aria-checked={isSelected}`, `tabIndex={0}`, with toggle on `Space` or `Enter`
- **Question Palette Drawer**:
  - Palette aside container with `id="cbt-palette-drawer"`, `role="region"`, and `aria-label="Lembar Butir Soal"`
  - Drawer closes immediately upon `Escape` key
  - Each number button has a detailed accessible description: `aria-label="Soal nomor X: [Ragu-ragu / Sudah dijawab / Belum dijawab]"`
  - Palette buttons maintain a minimum 44x44px touch target with high-contrast `:focus-visible` ring
- **Safe-Area Navigation**:
  - Sticky bottom actions bar uses `env(safe-area-inset-bottom, 0px)` for comfortable thumb reach without obstruction by system gestures

---

## 5. Automated Test Suite

Executed via:
```bash
node scripts/tests/test-responsive-a11y-ui10.mjs
```
Validates 22 specific assertions across CSS foundation, landmark semantics, focus management, drawer controls, form validation alerts, and student exam interface accessibility.
