---
name: oaktree-frontend
description: MUI Joy UI component guidelines, glassmorphism styling, layout structure, table standardization, modal dialogs, and button loading spinners. Load when writing or editing frontend UI code.
---

# Oaktree Frontend Guidelines

Guidelines and standards for building the frontend of the Oaktree Agent application using Astro, React, and MUI Joy UI.

---

## 🎨 Antigravity UI Style (Adapted for MUI Joy UI)

Apply these design principles using MUI Joy UI `sx` props (do not load the `@antigravity-design-expert` skill to avoid Tailwind/GSAP stack conflicts):
- **Glassmorphism**: Use translucent backgrounds (`rgba`), blur effects (`backdropFilter: 'blur(12px)'`), and thin subtle borders.
- **Weightlessness**: Add soft, layered, and diffused shadows.
- **Motion**: Ensure all hover/focus/active state changes have smooth transitions (`transition: 'all 0.3s ease-out'`).
- **React Entrypoint**: `src/components/App.tsx` **MUST** remain directly under `src/components/` to integrate with Astro.
- **Component Folder Structure**:
  - `src/components/layout/` – Shell components (`Header.tsx`, `Sidebar.tsx`).
  - `src/components/common/` – Reusable contexts/helpers (`AuthContext.tsx`, `ThemeToggle.tsx`).
  - `src/components/features/` – Domain-specific views in subfolders (e.g., `agent/`, `portfolio/`).
- **Relative Paths**: Always use relative paths (e.g., `../../common/`) rather than flat imports when crossing folder boundaries.

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
