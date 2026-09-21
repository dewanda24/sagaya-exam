# SAGAYA EXAM — PUBLIC PAGES ARCHITECTURE & USER EXPERIENCE

**Stage**: UI-02 — Public Pages  
**Audience**: Frontend Engineers, UX Designers, Security Auditors  
**Theme**: Modern, Professional, Clean, Academic, Trustworthy, Fast, Secure  

---

## 1. Overview & Objective

The public experience of Sagaya Exam serves as the gateway for students, educators, proctors, school administrators, and the public. In accordance with the UI-02 specification, the public surface communicates immediately:
1. **What is Sagaya Exam?** A secure, structured, and standardized digital examination platform for Indonesian schools.
2. **Who is it for?** Schools, teachers, students, and exam proctors.
3. **What can it do?** Bank question creation with KaTeX math rendering, real-time proctor monitoring, server-side scoring, essay blind-grading, and official report exports.
4. **How to enter?** Direct login for staff and a dedicated token entrance for students without requiring account passwords.

---

## 2. Public Route Matrix

| Route | Purpose | Component / File | Indexing Policy |
| :--- | :--- | :--- | :--- |
| `/` | Landing Page (Hero, Values, Stepper, Features, Security, Roles, CTA) | `src/app/page.tsx` | Indexable |
| `/tentang` | Institutional overview, mission, approach, and core principles | `src/app/tentang/page.tsx` | Indexable |
| `/fitur` | Detailed categorized feature catalog across 4 pillars | `src/app/fitur/page.tsx` | Indexable |
| `/panduan` | Role-based operational guidelines (Siswa, Guru, Pengawas, Admin) | `src/app/panduan/page.tsx` | Indexable |
| `/faq` | Categorized interactive accordions answering operational questions | `src/app/faq/page.tsx` | Indexable |
| `/kontak` | Authentic assistance guidance and school admin contacts | `src/app/kontak/page.tsx` | Indexable |
| `/status` | Real-time public service availability & latency monitor | `src/app/status/page.tsx` | Disallowed |
| `/ujian` | Student token entrance with validation & rate limit state | `src/app/ujian/page.tsx` | Disallowed |
| `/ujian/token` | Dedicated student token entrance route | `src/app/ujian/token/page.tsx`| Disallowed |
| `/403` | Access Forbidden state (no permission leaks) | `src/app/403/page.tsx` | Disallowed |
| `/429` | Rate limit notice with live countdown and Retry-After | `src/app/429/page.tsx` | Disallowed |
| `/maintenance` | Scheduled maintenance notice | `src/app/maintenance/page.tsx`| Disallowed |
| 404 | Custom Not Found handler | `src/app/not-found.tsx` | Disallowed |
| 500 | Global Error Boundary | `src/app/error.tsx` | Disallowed |

---

## 3. Shared Public Layout

The layout (`src/components/public/PublicLayout.tsx`) consists of:

### 3.1 Header (`PublicHeader.tsx`)
- **Brand Identity**: Clean logo mark with bold "Sagaya Exam" typography and subtitle "Sistem Ujian Digital Terstandarisasi". No hardcoded school names.
- **Desktop Navigation**: Links to Beranda, Fitur, Panduan, FAQ, Status Sistem, Bantuan.
- **Primary CTAs**:
  - `Mulai Ujian` (Outline button leading to `/ujian`)
  - `Masuk` (Primary button leading to `/login`)
- **Mobile Navigation**: Off-canvas drawer (`Drawer.tsx`) triggered via hamburger menu, preserving full keyboard navigation and escape-key handling.

### 3.2 Footer (`PublicFooter.tsx`)
- Multi-column grid containing:
  - Platform mission and verification statement
  - Navigation links
  - Technical support guidance without fake personal phone numbers
  - Multi-tenant data segregation assurance
  - Dynamic copyright year

---

## 4. Student Token Entry Architecture (`/ujian` & `/ujian/token`)

The student exam entrance experience adheres to high-stakes testing requirements:
1. **Format Normalization**: Automatically transforms input to `XXXX-XXXX` (8 characters uppercase, stripping non-alphanumeric characters).
2. **One-Tap Paste**: Native clipboard paste button for rapid entry from digital invitations.
3. **No Credential Leaks**:
   - Token is **never** appended as a URL query parameter during navigation.
   - Token is **never** persisted in browser `localStorage`.
   - Rate limit responses include an accessible countdown timer based on the `Retry-After` header.
4. **Pre-flight Device Check**: Displays live network connectivity (Online/Offline) and detects client device context.
5. **Backend Authentication**: Calls the authoritative `/api/exam/authenticate` route from Sprint 06, creating an HttpOnly cookie session and routing the student to `/exam/lobby`.

---

## 5. Security & Privacy Safeguards

- **Zero Enumeration**: Error messages never state whether an exam ID or school ID exists. Generic messages ("Token tidak dapat digunakan. Periksa kembali token Anda atau hubungi pengawas ruangan.") prevent timing and token scanning attacks.
- **Safe Robots Configuration (`src/app/robots.ts`)**: Explicitly disallows search engine crawlers from indexing exam sessions, token entry endpoints, admin dashboards, proctor consoles, and internal APIs.
- **No Marketing Fabrication**: All claims reflect actual platform capabilities verified by the Sprint 00–11 test suites. No inflated statistics or fake certificates.
