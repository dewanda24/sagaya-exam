# SAGAYA EXAM — UI-09 RESULTS, ANALYTICS & REPORTS SPECIFICATION

## 1. Overview & Architecture

Sprint UI-09 delivers a secure, multi-tenant, and role-scoped **Results, Analytics & Reports** experience across Superadmin, Admin Sekolah, Guru, and Siswa roles.

### Core Workflow
```
Exam Finalization -> Result Generation -> Score Breakdown -> Teacher Review -> Publication -> Analytics & Reports -> Multi-format Export
```

### Security & Privacy Non-Negotiables
1. **Zero Client Authority**: All scores, grading statuses, pass/fail determinations, and publication controls are evaluated exclusively server-side.
2. **Strict Anti-IDOR & Tenant Isolation**: Every admin/guru result endpoint verifies tenant ownership (`school_id`). School A cannot access or manipulate School B's results.
3. **Teacher Scoping**: Guru users can only view results, analytics, and reports for exams and classes they are formally assigned to.
4. **Student Privacy & Zero Answer Key Leakage**:
   - Students can only view their own results (`student_id` matching authenticated session).
   - Unpublished results remain completely inaccessible (HTTP 403) unless `show_score_policy = 'IMMEDIATELY'`.
   - **Zero Answer Key Leakage**: Response payloads to students contain strictly sanitized numbers, earned points, and teacher pedagogical feedback. `answerKey`, internal rubrics, and internal teacher notes are irrevocably stripped.
5. **Score Correction & Voiding Audit Trails**:
   - Any manual score adjustment mandates an explicit reason string.
   - An immutable audit trail is logged to `audit_logs`.
   - Result voiding (`VOID`) prevents publication and records who, when, and why.
6. **Formula Injection Protection**:
   - CSV and spreadsheet exports automatically sanitize cells beginning with `=`, `+`, `-`, or `@` by prefixing a single quote `'` to prevent remote command execution in desktop spreadsheet software.

---

## 2. Role-by-Role Workspace Matrix

| Role | Results View | Result Detail | Score Correction / Void | Analytics | Reports & Exports |
|---|---|---|---|---|---|
| **Superadmin** | `/superadmin/results` (cross-school) | — | — | `/superadmin/analytics` & `/superadmin/analitik` (regional radar, benchmarks) | `/superadmin/reports` (master CSV export, audit logs) |
| **Admin Sekolah** | `/admin/results` (full school) | `/admin/results/[resultId]` | Modals with mandatory reason | `/admin/analytics` (scores, distribution, item analysis, violations, snapshots) | `/admin/reports` (CSV/XLSX/PDF, summary, recap per class/student/room) |
| **Guru** | `/guru/results` (scoped to assigned subjects) | `/guru/results/[resultId]` | — | `/guru/analytics` (item difficulty, discrimination index, format composition) | `/guru/reports` (rekap nilai, Buku Nilai XLSX, print PDF) |
| **Siswa** | `/exam/result` & `/siswa/results` | `/exam/result/[resultId]` & `/siswa/results/[resultId]` | — (read-only) | — | Print score card |

---

## 3. API Surface

### 1. Admin Endpoints
- `GET /api/admin/results`: List participant results by exam with filters.
- `GET /api/admin/results/[resultId]`: Comprehensive result metadata and per-question score breakdown.
- `POST /api/admin/results/[resultId]/correct`: Correct score with mandatory audit reason.
- `POST /api/admin/results/[resultId]/void`: Mark result as VOID with mandatory audit reason.
- `POST /api/admin/results/[resultId]/publish`: Publish individual result to student.
- `POST /api/admin/results/regrade`: Trigger mass regrading for an exam.

### 2. Guru Endpoints
- `GET /api/guru/results`: List results for teacher's assigned subjects and classes.
- `GET /api/guru/results/[resultId]`: Scoped result detail with per-question scoring and feedback.
- `GET /api/guru/results/export`: Export teacher-scoped exam results to CSV.
- `GET /api/guru/analytics`: Psychometric item analysis for teacher's exams.

### 3. Student Endpoints
- `GET /api/student/results`: List published results for current authenticated student.
- `GET /api/student/results/[resultId]`: Fetch student-sanitized result details (zero answer key leakage).
- `GET /api/exam/results/[resultId]`: Public/token student result view with passing status and breakdown.

### 4. Superadmin Endpoints
- `GET /api/superadmin/results`: Cross-school results overview with school, status, and search filters.
- `GET /api/superadmin/reports/master-export`: Master CSV export filtered by level, rayon, and exam.
- `GET /api/superadmin/regional-analytics`: Regional benchmark analytics.

---

## 4. Verification & Testing

Automated verification suite `scripts/tests/test-results-analytics-ui09.mjs` verifies:
- Group 1: Tenant isolation & anti-IDOR for Admin
- Group 2: Teacher scope enforcement
- Group 3: Student privacy & zero answer key leakage
- Group 4: Score correction with audit log
- Group 5: Result voiding mutation
- Group 6: Formula injection protection in CSV exports

Result: **21/21 tests PASSED, 0 FAILED**.
TypeScript compilation (`tsc --noEmit`): **0 errors**.
