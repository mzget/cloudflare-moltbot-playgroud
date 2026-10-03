# Design System: Oaktree Agent

Editorial and technical design system specification for Oaktree Agent — an AI-powered financial intelligence terminal and market summarizer.

## 1. Visual Theme & Atmosphere

Modern, high-performance financial intelligence terminal blending dark glassmorphism with crisp data density. Translucent frosted glass surfaces (`backdrop-filter: blur(20px)`) sit over deep obsidian backdrops (`#050505` to `#0d1117`), illuminated by subtle ambient radial glows in violet and magenta. The interface emphasizes calm clarity for quantitative metrics, financial ratios, and real-time market intelligence feeds.

## 2. Color Palette & Roles

### Primary Foundation
- **Obsidian Dark Canvas (`#050505`)**: Root application background for deep dark mode.
- **Surface Elevation (`#121214` / `rgba(18, 18, 20, 0.7)`)**: Glassmorphic sheet surface for cards, navigation drawers, and floating panels.
- **Hairline Border (`rgba(255, 255, 255, 0.15)`)**: 1px structural separator dividing spatial sections and framing interactive containers.

### Accent & Interactive
- **Emerald Green (`#10b981`)**: Primary brand color, primary calls-to-action, active sidebar states, and positive financial returns.
- **Electric Violet (`#7c3aed`)**: Background ambient gradient glow and AI Agent intelligence telemetry.
- **Rose Pink (`#db2777`)**: Secondary ambient lighting and warm interactive highlights.

### Typography & Text Hierarchy
- **Primary Text (`#ffffff` / `#e6edf3`)**: Crisp high-contrast readout for display titles, metrics, and data values.
- **Secondary Metadata (`#8b949e`)**: Column headers, timestamps, and supporting analytical descriptions.
- **Tertiary Labels (`#484f58`)**: Section group headers, uppercase category tags, and subtle captions.

### Functional States & Financial Telemetry
- **Bullish / Success (`#10b981`)**: Positive market performance, active crawler status, and completed tasks.
- **Bearish / Danger (`#f43f5e`)**: Negative returns, stock decline indicators, and destructive confirmation modals.
- **Warning / Pending (`#f59e0b`)**: Cautionary stock signals, rate-limit cooldowns, and waiting states.
- **Gaming HUD Accents (`dotaTheme`)**: Gold (`#ffd700`), Health Green (`#388e3c`), and Mana Blue (`#1976d2`) for gamified analyst badges.

## 3. Typography Rules

- **Outfit**: Headlines and Section Display Titles (`700` display at `32px/40px`; `600` card headers at `20px/28px`). Geometric sans character imparting modern authority.
- **Inter**: Body copy and dense financial data readouts (`400` body at `14px/20px`; `600` table headers and chips at `12px/16px`). High legibility with large x-height and clear numeric distinctions.
- **Cinzel & Almendra**: Specialized display typography reserved exclusively for gamified hero titles and ancient wisdom badges.

## 4. Component Stylings

- **Buttons & Actions**:
  - Primary Action: Solid Emerald Green fill (`#10b981`) or soft tinted background with `12px` border radius (`--ListItem-radius: 12px`), smooth `0.2s` transition.
  - Asynchronous Buttons: Mandatory visual loading spinner (`loading={isSubmitting}`) for any ongoing mutation, crawl, or submit action.
- **Glassmorphic Cards & Sheets**:
  - Surface: `24px` border radius (`borderRadius: 24px`), `backdrop-filter: blur(20px) saturate(180%)`, 1px subtle hairline border, and diffused shadow `0 8px 32px rgba(0, 0, 0, 0.05)`.
- **Standardized Data Tables**:
  - MUI Joy UI `<Table>` wrapped inside a glassmorphic `<Sheet>` with `borderAxis="xBetween"`, `hoverRow`, and `stripe="odd"`.
  - Configurable density via `--TableCell-paddingX` and `--TableCell-paddingY`.
  - Sticky headers with solid backdrop surface tokens (`var(--joy-palette-background-surface)`). No raw HTML `<table>` elements.
- **Modals & Dialogs**:
  - Strictly no native browser dialogs (`window.alert`, `window.confirm`).
  - Standard implementation: MUI Joy UI `<Modal>` with `<ModalDialog role="alertdialog">`, structured with `<DialogTitle>`, `<DialogContent>`, and `<Stack>`. Destructive confirms require `color="danger"`.

## 5. Layout Principles

- **Grid & Spacing**:
  - Baseline spacing scale on a `4px` / `8px` rhythm (`spacing={2}` = 16px default grid gap).
  - Responsive Grid System: MUI Joy UI `<Grid container spacing={2}>` with standard breakpoint column spans:
    - `xl={4}` (>=1536px: 3 cards per row) or `xl={8}` / `xl={12}` (wide analytical tables and charts).
    - `lg={6} md={6}` (900px - 1535px: 2 cards per row).
    - `xs={12} sm={12}` (<900px: 1 single-column card per row).
- **Viewport Canvas**: Standard `1280px` centered desktop viewport with smooth adaptive scaling for mobile breakpoints.

## 6. Design System Notes for Stitch Generation

- **Atmosphere keywords**: Dark glassmorphic financial terminal, Emerald Green `#10b981` accents, frosted translucent cards with `blur(20px)` backdrop filter, subtle ambient violet/pink radial lighting, clean Outfit headings, and dense Inter tabular data.
- **Component prompts**:
  - "A dark glassmorphic stock market dashboard card with `borderRadius: 24px`, subtle 1px border, 20px backdrop blur, displaying ticker symbols, percentage gainers in Emerald Green `#10b981`, and crisp Inter typography."
  - "A quantitative financial analysis table in MUI Joy UI style with sticky headers, striped rows, 12px pill chips for status badges, and action buttons with rounded corners and loading states."
  - "An AI market intelligence chat feed featuring glassmorphic message bubbles, smooth elevation, an Emerald Green send button with loading state, and clear typography hierarchy using Outfit for headers and Inter for responses."
