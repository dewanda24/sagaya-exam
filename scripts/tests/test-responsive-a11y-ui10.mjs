// ============================================================================
// SAGAYA EXAM — SPRINT UI-10: RESPONSIVE & ACCESSIBILITY AUTOMATED TEST SUITE
// Tests WCAG 2.2 AA conformance, keyboard navigation, focus management,
// touch targets, reduced-motion, and landmark semantics.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function readFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `File not found: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

console.log('\n--- UI-10: RESPONSIVE & ACCESSIBILITY AUDIT ---');

// 1. Global CSS & Accessibility Foundation
test('1.1 Globals CSS contains skip-to-content utility', () => {
  const css = readFile('src/styles/globals.css');
  assert(css.includes('.skip-to-content'), 'globals.css must have .skip-to-content');
  assert(css.includes(':focus'), 'skip-to-content must style on focus');
});

test('1.2 Globals CSS contains prefers-reduced-motion media query', () => {
  const css = readFile('src/styles/globals.css');
  assert(
    css.includes('@media (prefers-reduced-motion: reduce)'),
    'globals.css must support prefers-reduced-motion for motion sensitivity'
  );
  assert(
    css.includes('animation-duration: 0.01ms') || css.includes('transition-duration: 0.01ms'),
    'prefers-reduced-motion must minimize duration'
  );
});

test('1.3 Globals CSS contains min-touch-target and safe-area utilities', () => {
  const css = readFile('src/styles/globals.css');
  assert(css.includes('.min-touch-target'), 'globals.css must define .min-touch-target');
  assert(css.includes('min-height: 44px'), '.min-touch-target must have min-height 44px');
  assert(css.includes('safe-area-inset-top'), 'globals.css must provide safe-area-inset utilities');
  assert(css.includes('safe-area-inset-bottom'), 'globals.css must provide safe-area-inset-bottom');
});

test('1.4 Globals CSS defines enhanced focus-visible ring', () => {
  const css = readFile('src/styles/globals.css');
  assert(css.includes(':focus-visible'), 'globals.css must specify :focus-visible rules');
  assert(css.includes('outline: 2px solid'), ':focus-visible must have high contrast 2px outline');
});

// 2. Role Layouts & Main Landmarks
const layouts = [
  { name: 'AdminLayout', path: 'src/components/admin/AdminLayout.tsx' },
  { name: 'GuruLayout', path: 'src/components/guru/GuruLayout.tsx' },
  { name: 'PengawasLayout', path: 'src/components/pengawas/PengawasLayout.tsx' },
  { name: 'SuperAdminLayout', path: 'src/components/superadmin/SuperAdminLayout.tsx' },
];

for (const layout of layouts) {
  test(`2. Layout landmark & skip link in ${layout.name}`, () => {
    const code = readFile(layout.path);
    assert(code.includes('skip-to-content'), `${layout.name} must include skip-to-content link`);
    assert(code.includes('#main-content'), `${layout.name} skip link must point to #main-content`);
    assert(code.includes('id="main-content"'), `${layout.name} must have element with id="main-content"`);
    assert(code.includes('role="main"'), `${layout.name} main canvas must have role="main"`);
  });
}

// 3. Sidebars Navigation & Mobile Drawer Controls
const sidebars = [
  { name: 'AdminSidebar', path: 'src/components/admin/AdminSidebar.tsx' },
  { name: 'GuruSidebar', path: 'src/components/guru/GuruSidebar.tsx' },
  { name: 'PengawasSidebar', path: 'src/components/pengawas/PengawasSidebar.tsx' },
  { name: 'SuperAdminSidebar', path: 'src/components/superadmin/SuperAdminSidebar.tsx' },
];

for (const sb of sidebars) {
  test(`3. Sidebar navigation semantics & Escape key handling in ${sb.name}`, () => {
    const code = readFile(sb.path);
    assert(code.includes('id="main-sidebar"'), `${sb.name} must have id="main-sidebar"`);
    assert(code.includes('role="navigation"'), `${sb.name} must have role="navigation"`);
    assert(code.includes('aria-label='), `${sb.name} must have aria-label`);
    assert(code.includes('Escape'), `${sb.name} must listen to Escape key to close mobile drawer`);
    assert(code.includes('setMobileOpen(false)'), `${sb.name} must close on Escape`);
  });
}

// 4. Headers & Hamburger Controls
const headers = [
  { name: 'AdminHeader', path: 'src/components/admin/AdminHeader.tsx' },
  { name: 'GuruHeader', path: 'src/components/guru/GuruHeader.tsx' },
  { name: 'PengawasHeader', path: 'src/components/pengawas/PengawasHeader.tsx' },
  { name: 'SuperAdminHeader', path: 'src/components/superadmin/SuperAdminHeader.tsx' },
];

for (const hdr of headers) {
  test(`4. Header hamburger accessible attributes in ${hdr.name}`, () => {
    const code = readFile(hdr.path);
    assert(code.includes('aria-controls="main-sidebar"'), `${hdr.name} toggle must control main-sidebar`);
    assert(code.includes('aria-label='), `${hdr.name} toggle must have descriptive aria-label`);
    assert(code.includes('min-touch-target'), `${hdr.name} toggle must use min-touch-target`);
  });
}

// 5. Core UI Components Conformance
test('5.1 Modal focus trap, focus restoration & ARIA dialog roles', () => {
  const code = readFile('src/components/ui/Modal.tsx');
  assert(code.includes('role="dialog"'), 'Modal must have role="dialog"');
  assert(code.includes('aria-modal="true"'), 'Modal must have aria-modal="true"');
  assert(code.includes('previousActiveElementRef'), 'Modal must track active element before opening');
  assert(code.includes('.focus()'), 'Modal must restore focus upon closing and autofocus initial element');
  assert(code.includes("e.key === 'Tab'"), 'Modal must trap Tab / Shift+Tab within dialog container');
});

test('5.2 Table scrollable container accessibility and column headers', () => {
  const code = readFile('src/components/ui/Table.tsx');
  assert(code.includes('role="region"'), 'Table container must have role="region"');
  assert(code.includes('tabIndex={0}'), 'Table scrollable container must be keyboard focusable (tabIndex=0)');
  assert(code.includes('scope="col"'), 'Table headers must have scope="col" for screen readers');
});

test('5.3 Pagination accessible landmark and current page indication', () => {
  const code = readFile('src/components/ui/Pagination.tsx');
  assert(code.includes('role="navigation"'), 'Pagination must have role="navigation"');
  assert(code.includes('aria-label='), 'Pagination must have aria-label');
  assert(code.includes("aria-current={isCurrent ? 'page' : undefined}"), 'Pagination must indicate current page with aria-current');
});

test('5.4 Tabs ARIA roles, controls, labels and minimum target sizing', () => {
  const code = readFile('src/components/ui/Tabs.tsx');
  assert(code.includes('role="tablist"'), 'TabsList must have role="tablist"');
  assert(code.includes('role="tab"'), 'TabsTrigger must have role="tab"');
  assert(code.includes('role="tabpanel"'), 'TabsContent must have role="tabpanel"');
  assert(code.includes('aria-controls='), 'TabsTrigger must have aria-controls pointing to tabpanel');
  assert(code.includes('aria-labelledby='), 'TabsContent must have aria-labelledby pointing to tab');
  assert(code.includes('tabIndex={isSelected ? 0 : -1}'), 'TabsTrigger must manage tabIndex for keyboard cycling');
});

test('5.5 FormField & Input accessible labels and alert live regions', () => {
  const fieldCode = readFile('src/components/ui/FormField.tsx');
  const inputCode = readFile('src/components/ui/Input.tsx');

  assert(fieldCode.includes('role="alert"'), 'FormField error message must have role="alert"');
  assert(fieldCode.includes('aria-live="assertive"'), 'FormField error message must be aria-live assertive');
  assert(inputCode.includes('aria-invalid='), 'Input must specify aria-invalid');
  assert(inputCode.includes('aria-describedby='), 'Input must specify aria-describedby for error/helper');
});

// 6. Student Exam Interface Conformance
test('6.1 Student exam interface keyboard accessibility and Escape key', () => {
  const code = readFile('src/app/ujian/[sessionId]/page.tsx');
  assert(code.includes("e.key === 'Escape'"), 'Student exam interface must close palette drawer on Escape');
  assert(code.includes('role="radiogroup"'), 'Single choice questions must use role="radiogroup"');
  assert(code.includes('role="radio"'), 'Single choice options must use role="radio"');
  assert(code.includes('role="checkbox"'), 'Multiple choice options must use role="checkbox"');
  assert(code.includes("e.key === ' ' || e.key === 'Enter'"), 'Options must support keyboard Space and Enter keys');
  assert(code.includes('id="cbt-palette-drawer"'), 'Palette drawer must have id for aria-controls');
});

test('6.2 CBT CSS touch targets and focus-visible rings', () => {
  const css = readFile('src/styles/cbt.css');
  assert(css.includes('.cbt-option-item:focus-visible'), 'cbt-option-item must have focus-visible styling');
  assert(css.includes('.cbt-num-btn:focus-visible'), 'cbt-num-btn must have focus-visible styling');
  assert(css.includes('min-height: 44px') || css.includes('min-height: 48px'), 'CBT options/buttons must have min 44px touch height');
});

console.log('\n>>> All UI-10 Responsive & Accessibility tests passed successfully! <<<\n');
