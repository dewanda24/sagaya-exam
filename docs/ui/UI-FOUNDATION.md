# SAGAYA EXAM — UI FOUNDATION ARCHITECTURE

**Stage**: UI-01 — Design System & UI Foundation  
**Audience**: Frontend Engineers, Fullstack Developers, QA Engineers  

---

## 1. Architectural Principles

The UI Foundation of Sagaya Exam operates on the following foundational tenets:

1. **Zero Domain Logic Tampering**: The UI layer consumes APIs and DTOs produced by Sprint 00–11 without modifying schemas, security rules, RBAC, scoring routines, or tenant isolation boundaries.
2. **Centralized Tokens**: Hardcoded Tailwind classes and raw hex color values are eradicated in favor of semantic CSS variables (`var(--color-primary)`, `var(--color-surface)`, etc.) defined in `src/styles/globals.css` and bound to Tailwind in `tailwind.config.js`.
3. **WCAG 2.2 AA Compliance**:
   - Touch targets are strictly calibrated to at least 44×44px on mobile viewports for all interactive buttons and inputs (`min-h-touch`).
   - High contrast ratio (7:1+ for slate-900 text on white/slate-50 background).
   - Visible keyboard focus rings using `focus-visible:ring-2 focus-visible:ring-primary-500`.
   - Modals and drawers include keyboard focus trapping and escape-key handling.
4. **Resilient Data State Handling**: Every data-driven view provides explicit UI representations for:
   - `Loading`: via `Skeleton` or `LoadingState` spinner
   - `Empty`: via `EmptyState` with descriptive copy and CTA
   - `Error`: via `ErrorState` with safe error descriptions and retry action
   - `Success`: via `Toast` or localized notification
5. **Security UX**:
   - Error messages presented to the user never expose database column names, raw SQL exceptions, or stack traces.
   - Authentication errors avoid user enumeration (e.g. "Username atau kata sandi tidak valid").
   - Sensitive operations (session termination, user suspension, exam deletion, score voiding) enforce confirmation modals with explicit context.

---

## 2. Directory Structure

```
src/
├── components/
│   ├── ui/                    # Centralized Atomic & Composite UI System
│   │   ├── Alert.tsx          # Contextual banner alerts (info, warning, danger, success)
│   │   ├── Avatar.tsx         # User avatar & UserMenu dropdown
│   │   ├── Badge.tsx          # Badges & comprehensive Sagaya StatusBadge
│   │   ├── Breadcrumb.tsx     # Semantic accessible breadcrumbs
│   │   ├── Button.tsx         # Button & IconButton with variants & sizes
│   │   ├── Card.tsx           # Card compound components & StatCard
│   │   ├── Checkbox.tsx       # Checkbox with indeterminate state
│   │   ├── DashboardShell.tsx # Unified application shell with responsive sidebar & topbar
│   │   ├── DataTable.tsx      # Table with sorting, pagination, and mobile card fallback
│   │   ├── DatePicker.tsx     # Standard date & datetime-local picker
│   │   ├── Drawer.tsx         # Accessible slide-out drawer
│   │   ├── Dropdown.tsx       # Dropdown menu & Tooltip
│   │   ├── EmptyState.tsx     # EmptyState, ErrorState, LoadingState
│   │   ├── FormField.tsx      # FormField, FormSection, FormActions
│   │   ├── Input.tsx          # Input & SearchInput with validation states
│   │   ├── Modal.tsx          # Accessible Modal & ConfirmDialog
│   │   ├── PageHeader.tsx     # PageHeader & SectionHeader
│   │   ├── Pagination.tsx     # Pagination controls
│   │   ├── Radio.tsx          # RadioGroup & Switch controls
│   │   ├── Select.tsx         # Select dropdown with chevron
│   │   ├── Skeleton.tsx       # Skeleton loaders (text, card, table)
│   │   ├── Table.tsx          # Table compound elements
│   │   ├── Tabs.tsx           # Tabs & Accordion
│   │   ├── Textarea.tsx       # Accessible multiline textarea
│   │   ├── Toast.tsx          # Global ToastProvider and useToast hook
│   │   └── index.ts           # Unified barrel export
│   ├── admin/                 # Admin specific domain components
│   ├── guru/                  # Teacher specific domain components
│   ├── pengawas/              # Proctor specific domain components
│   └── common/                # Common domain helpers
```

---

## 3. Responsive Breakpoint Rules

Sagaya Exam utilizes a content-driven responsive grid:
- **Mobile (< 640px)**:
  - Sidebar collapses into an off-canvas drawer opened via topbar menu button.
  - Tables automatically fall back to responsive cards via `DataTable`'s `renderMobileCard`.
  - Touch targets maintain at least 44×44px.
  - Page header actions stack vertically or wrap cleanly.
- **Tablet (640px – 1024px)**:
  - Sidebar toggles between icon-only (72px / 80px) and expanded (256px).
  - Stat cards display in a 2-column grid.
- **Desktop (>= 1024px)**:
  - Persistent sidebar with smooth expansion toggle.
  - Tables show complete column sets.
  - Stat cards display in 3 or 4 columns.

---

## 4. Integration Guidelines for Subsequent Sprints

When implementing pages in subsequent sprints (UI-02 Public Pages, UI-03 Auth, UI-04 Admin, etc.):
1. Import all primitives from `@/components/ui`.
2. Do not define new colors or arbitrary font classes inline.
3. Replace all instances of `window.confirm()` with `<ConfirmDialog />`.
4. Replace raw `alert()` calls with `const { success, error } = useToast()`.
5. Wrap data tables with `<DataTable />` or `<TableSkeleton />`.
6. Use `<StatusBadge status={...} />` for any entity status rendering.
