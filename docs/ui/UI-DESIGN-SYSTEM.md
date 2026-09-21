# SAGAYA EXAM — DESIGN SYSTEM SPECIFICATION

**Stage**: UI-01 — Design System & UI Foundation  
**Version**: 1.0.0  
**Theme**: Academic Calm & High-Contrast Light Mode (Indonesian EdTech CBT)  
**Accessibility Target**: WCAG 2.2 AA Compliant

---

## 1. Design Philosophy

Sagaya Exam delivers a modern, professional, academic, fast, secure, and calm testing interface. The design system is optimized for long reading sessions by teachers, students, and proctors under high-stakes conditions:

1. **Hierarchy & Clarity**: Strict visual hierarchy between page title, section containers, metadata, and actions.
2. **Readability & Contrast**: High-contrast slate typography (`#0f172a` primary text) on pure white and subtle slate surfaces (`#f8fafc`).
3. **Restraint over Decoration**: No excessive gradients, no heavy glassmorphism, no neon accents, no extreme rounded corners (`rounded-3xl` removed from operational UI).
4. **WCAG 2.2 AA Accessibility**: Strict keyboard navigation, visible focus indicators, screen-reader semantic HTML, and minimum 44×44px touch targets.
5. **Security UX**: Safe presentation of states, strict absence of enumeration leaks in error messages, and explicit confirmation modals for sensitive operations.

---

## 2. Color System & Semantic Tokens

All color tokens are exposed via CSS variables (`src/styles/globals.css`) and mapped cleanly into Tailwind CSS theme (`tailwind.config.js`).

### 2.1 Brand / Primary Palette
- `primary-50`: `#eff6ff` (Subtle active backgrounds, table active row indicator)
- `primary-100`: `#dbeafe` (Soft badges, light borders)
- `primary-200`: `#bfdbfe` (Input focus ring tint)
- `primary-500`: `#3b82f6` (Secondary brand elements)
- `primary-600`: `#2563eb` (Default primary action, buttons, links)
- `primary-700`: `#1d4ed8` (Button hover state)
- `primary-800`: `#1e40af` (Button active state)
- `primary-foreground`: `#ffffff`

### 2.2 Neutral & Surface Tokens
- `background`: `#f8fafc` (Canvas background)
- `surface`: `#ffffff` (Card, modal, table row surface)
- `surface-subtle`: `#f8fafc` (Table header, form field background)
- `surface-elevated`: `#ffffff` (Dropdowns, modals, popovers with shadow)
- `divider`: `#f1f5f9` (Subtle separator lines)
- `border`: `#e2e8f0` (Default element border)
- `border-hover`: `#cbd5e1` (Hovered input / button border)
- `border-focus`: `#2563eb` (Active keyboard focus ring)

### 2.3 Typography Colors
- `text-primary`: `#0f172a` (Slate 900 — Maximum contrast for questions & data)
- `text-secondary`: `#475569` (Slate 600 — Form labels, table headers)
- `text-muted`: `#64748b` (Slate 500 — Helper texts, captions, metadata)
- `text-inverse`: `#ffffff`

### 2.4 Semantic Feedback Statuses
| Role | Background | Border | Text | Solid Action |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#ecfdf5` | `#a7f3d0` | `#047857` | `#10b981` |
| **Warning** | `#fffbeb` | `#fde68a` | `#b45309` | `#f59e0b` |
| **Danger** | `#fef2f2` | `#fecaca` | `#b91c1c` | `#ef4444` |
| **Info** | `#eff6ff` | `#bfdbfe` | `#1d4ed8` | `#3b82f6` |

---

## 3. Typography Scale

Fonts are optimized for zero layout shift and local caching via Next.js:
- **Interface / Body Font**: `Plus Jakarta Sans` (weights 400, 500, 600, 700, 800)
- **Code / Token / Math Font**: `JetBrains Mono` (weights 500, 600, 700)

| Token | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | 32px / 36px | 1.2 | 800 | Landing Hero, Public Token Entry |
| `text-h1` | 24px (1.5rem) | 2rem | 700 | Dashboard Page Title |
| `text-h2` | 20px (1.25rem) | 1.75rem | 700 | Section & Card Title |
| `text-h3` | 16px (1.0rem) | 1.5rem | 600 | Sub-section Header, Modal Title |
| `text-h4` | 14px (0.875rem) | 1.25rem | 600 | Panel Title, Form Group Header |
| `text-body-lg`| 16px (1.0rem) | 1.5rem | 400/500 | Exam Question Prompt |
| `text-body` | 14px (0.875rem) | 1.25rem | 400/500 | Default UI text, Table cells |
| `text-body-sm`| 12px (0.75rem) | 1.0rem | 400/500 | Secondary list items, metadata |
| `text-caption`| 11px (0.6875rem)| 0.875rem | 400/500 | Footnotes, timestamps, hints |
| `text-label` | 12px (0.75rem) | 1.0rem | 600 | Form field labels |
| `text-overline`| 11px (0.6875rem)| 0.875rem | 700 Uppercase | Sidebar category labels, tags |

---

## 4. Spacing Scale

Strict 4px baseline grid implemented consistently:
- `4px` (`space-1`): Micro gaps (between icon and text)
- `8px` (`space-2`): Button internal padding, small list item spacing
- `12px` (`space-3`): Input vertical padding, badge spacing
- `16px` (`space-4`): Default content padding, form field gap
- `20px` (`space-5`): Card internal padding
- `24px` (`space-6`): Card desktop padding, section margin
- `32px` (`space-8`): Page header bottom margin, layout column gaps
- `48px` (`space-12`): Major module separation

Arbitrary irregular pixel values (e.g. `17px`, `23px`, `31px`) are strictly prohibited.

---

## 5. Border Radii

- `radius-sm` (6px): Inputs, badges, small buttons, table rows
- `radius-md` (10px): Primary action buttons, dropdown menus, alert boxes
- `radius-lg` (14px): Cards, panels, modals
- `radius-full` (9999px): Status pills, avatars, circular indicators

---

## 6. Shadow Hierarchy

- `none`: Flat operational surfaces, tables, borders
- `subtle`: Standard buttons, inputs (`0 1px 2px 0 rgba(0, 0, 0, 0.04)`)
- `sm`: Default card shadow (`0 1px 3px 0 rgba(0, 0, 0, 0.06)`)
- `md`: Hovered card, active state (`0 4px 6px -1px rgba(0, 0, 0, 0.07)`)
- `elevated`: Dropdown menus, modals, toasts (`0 10px 15px -3px rgba(0, 0, 0, 0.08)`)

---

## 7. Status Presentation Matrix

The Sagaya Exam status presentation system covers all 22+ lifecycle states across the platform:

| Domain | Status Code | Visual Badge | Meaning |
| :--- | :--- | :--- | :--- |
| **Users** | `ACTIVE` | Green Pill | User account is active and verified |
| | `INACTIVE` | Slate Pill | Account inactive / pending activation |
| | `SUSPENDED` | Amber Pill | Account temporarily suspended |
| | `LOCKED` | Red Pill | Account locked due to security policy |
| **Exam** | `DRAFT` | Neutral Pill | Exam draft under composition |
| | `SUBMITTED` | Blue Pill | Submitted for curriculum review |
| | `REVIEW` | Amber Pill | Currently under pedagogical review |
| | `APPROVED` | Green Pill | Approved by curriculum team |
| | `PUBLISHED` | Brand Pill | Published and ready for scheduling |
| | `ARCHIVED` | Neutral Pill | Archived exam for historical record |
| **Session**| `SCHEDULED` | Blue Pill | Session planned on calendar |
| | `ONGOING` | Pulsing Green | Session currently running live |
| | `COMPLETED` | Emerald Pill | Session finished and closed |
| | `CANCELLED` | Red Pill | Session cancelled |
| **Student**| `NOT_STARTED`| Slate Pill | Token issued, student not yet entered |
| | `IN_PROGRESS`| Pulsing Blue | Student currently answering questions |
| | `DISCONNECTED`| Rose Pill | Student connection dropped |
| | `EXPIRED` | Amber Pill | Allocated test time has elapsed |
| | `TERMINATED` | Red Pill | Terminated by proctor for violation |
| | `BLOCKED` | Red Pill | Device mismatch or security block |
| **Grading**| `PENDING` | Amber Pill | Awaiting automated or manual grading |
| | `PARTIALLY_GRADED` | Amber Pill | Auto-graded, awaiting essay review |
| | `GRADED` | Green Pill | All questions scored |
| | `REVIEWED` | Blue Pill | Teacher review and verification done |
| | `VOID` | Red Pill | Score invalidated / annulled |
| **Jobs** | `QUEUED` | Slate Pill | Async export task queued |
| | `PROCESSING` | Blue Spinner | Export generating (PDF, XLSX, CSV) |
| | `FAILED` | Red Pill | Export generation error |
