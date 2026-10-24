---
name: oaktree-frontend
description: MUI Joy UI component guidelines, Stitch and Antigravity Design integration, theme-first token rules, glassmorphism styling, layout structure, table standardization, modal dialogs, and button loading spinners. Load when writing or editing frontend UI code.
---

# Oaktree Frontend Guidelines

Guidelines and standards for building the frontend of the Oaktree Agent application using Astro, React, and MUI Joy UI.

---

## 🎨 Mandatory UI/UX Skills Trio (Stitch + Antigravity Design + Oaktree Frontend)

When creating, reviewing, or modifying any UX/UI interfaces, components, or layouts, **ALWAYS** integrate the principles of:
1. **`stitch`**: Use for screen structure, user journeys, responsive density, information layout, and component hierarchy.
2. **`@antigravity-design-expert`**: Use for spatial depth, layered Z-axis planes, weightless elevation, glassmorphism, and buttery-smooth transitions (`transition: 'all 0.3s ease-out'`).
3. **Stack Adaptation**: Implement all concepts exclusively through **MUI Joy UI** components and `sx` props (Strictly **NO Tailwind CSS**). The project stack constraints take absolute precedence over external skill defaults.
4. **React Entrypoint**: `src/components/App.tsx` **MUST** remain directly under `src/components/` to integrate with Astro.
5. **Component Folder Structure**:
   - `src/components/layout/` – Shell components (`Header.tsx`, `Sidebar.tsx`).
   - `src/components/common/` – Reusable contexts/helpers (`AuthContext.tsx`, `ThemeToggle.tsx`).
   - `src/components/features/` – Domain-specific views in subfolders (e.g., `agent/`, `portfolio/`).
6. **Relative Paths**: Always use relative paths (e.g., `../../common/`) rather than flat imports when crossing folder boundaries.

---

## 🚫 Strict Invariant: No Hardcoded Styles — Use Theme Tokens as Primary Source

Strictly **FORBID** hardcoding static colors, borders, or shadows in component `sx` props (e.g. `rgba(255, 255, 255, 0.05)`, `#ffffff`, `#111827`, `border: '1px solid rgba(255,255,255,0.1)'`). Hardcoded values break theme switching between Light and Dark modes.

Always use MUI Joy UI Theme tokens and variables:
- **Surfaces & Hierarchy (Spatial Planes)**:
  - Base Page / Canvas: `background.body`
  - Level 1 Outer Glass Container: `...glassStyle` or `background.surface` (frosted glass)
  - Level 2 Inner Cards / Telemetry Boxes: `background.level1` (`#f1f5f9` in Light / Slate in Dark)
  - Level 3 Sub-containers / Controls: `background.level2`
- **Borders & Dividers**:
  - Use `border: '1px solid', borderColor: 'neutral.outlinedBorder'` or `divider`.
  - **Never override** `glassStyle` with white-only borders (e.g. `rgba(255,255,255,0.08)`). Let `glassStyle.border` dynamically resolve via `neutral.outlinedBorder`.
- **Semantic Typography & Status Colors**:
  - Always use theme-aware color tokens: `color: 'danger.plainColor'`, `color: 'success.plainColor'`, `color: 'primary.plainColor'`, or `color: 'text.secondary'`.
  - **Never use fixed pastel text** like `danger.300` or `success.300` on light background cards as they become unreadable in Light Theme.
- **Elevation & Shadows**:
  - Use Joy UI shadow tokens: `boxShadow: 'sm'`, `boxShadow: 'md'`, or `boxShadow: 'var(--joy-shadow-md)'`.

---

## 🚫 No Native Browser Dialogs — Use MUI Joy UI Modals

Never use `window.confirm()`, `window.alert()`, `window.prompt()`, or the bare `confirm()` / `alert()` / `prompt()` globals for user-facing interactions in the frontend.
- **Reasoning**: Native browser dialogs are visually inconsistent with the project's glassmorphism design system and cannot be styled or animated.
- **Solution**: Always implement confirmation dialogs using MUI Joy UI components:
  - `<Modal>` + `<ModalDialog role="alertdialog">` for destructive actions (delete, remove).
  - `<DialogTitle>`, `<DialogContent>`, and `<Stack>` for layout inside the modal.
  - Use `color="danger"` buttons with a relevant Lucide icon (`<Trash2>`) for destructive confirms.
  - Control visibility with a dedicated `useState` boolean (e.g., `isDeleteConfirmOpen`).

---

## 📊 Mandatory MUI Joy UI Table Standardisation

All data tables across the frontend application **MUST** be implemented using MUI Joy UI components (`<Table>`, `<Sheet>`, `<Typography>`, `<Link>`, `<Chip>`, `<IconButton>`) wrapped in a glassmorphic `<Sheet>`.
- **No Raw HTML Tables**: Strictly **avoid using bare HTML `<table>`**, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` elements with custom CSS table classes (e.g. `.yf-table`).
- **Consistent Layout & Theme Support**:
  - Always wrap `<Table>` in `<Sheet>` with `borderAxis="xBetween"`, `hoverRow`, `stripe="odd"`, and proper `--TableCell-paddingX` / `--TableCell-paddingY` density configurations.
  - Sticky headers and fixed columns must use MUI Joy UI theme variables (e.g. `[data-joy-color-scheme="dark"]` / `var(--joy-palette-divider)`) to ensure perfect light/dark theme switching.

---

## ⏳ Mandatory Loading Spinner on Submit/Save Buttons

All buttons that trigger asynchronous operations (e.g., Save, Submit, Create, Delete, Post) **MUST** incorporate a visible loading spinner state to inform the user of the ongoing action.
- **MUI Joy UI Implementation**: Use the `loading={isSubmitting}` prop on MUI Joy UI `<Button>` or `<IconButton>`.
- **User Feedback**: Never leave a submit or save button in a static state without a visual loading indicator during API calls or asynchronous actions.

---

## 📐 Default Grid Layout System

Always use MUI Joy UI `<Grid container spacing={2}>` as the default layout mechanism for arranging card components, dashboards, and summary metrics.
- **Responsive Grid Breakpoints**: Explicitly define responsive column spans across screen breakpoints (`xs`, `sm`, `md`, `lg`, `xl`):
  - **`xl` (Extra Large >= 1536px)**: Use `xl={4}` for 3 cards per row, or `xl={8}` / `xl={12}` for wider cards/tables.
  - **`lg` & `md` (Medium / Large 900px - 1535px)**: Use `lg={6} md={6}` for 2 cards per row.
  - **`sm` & `xs` (Mobile / Small < 900px)**: Use `xs={12} sm={12}` for 1 card per row.
- **Visual Harmony**: Combine Grid items with glassmorphic `<Sheet sx={{ ...glassStyle, p: 3, height: '100%' }}>` to ensure uniform card height and alignment across rows.