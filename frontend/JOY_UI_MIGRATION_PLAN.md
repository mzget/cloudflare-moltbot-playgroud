# Joy UI Migration Plan for Moltbot

This document outlines the step-by-step plan to migrate the existing Tailwind CSS design system to **MUI Joy UI**. This move will provide a robust, pre-built component library with advanced theming capabilities, accessibility compliance, and a cohesively modern aesthetic.

## Phase 1: Installation & Setup

### 1.1 Install Dependencies
We need to install the core Joy UI packages and the styling engine (Emotion).
```bash
npm install @mui/joy @emotion/react @emotion/styled
```

### 1.2 Setup Theme Provider (The "Island" Strategy)
Since Astro uses "Islands Architecture" (isolated React components), we cannot just wrap the entire `<body>` in a single React Provider easily without moving everything into React. We have two key options:
*   **Option A (Recommended for unified app state):** Refactor the main dashboard content in `index.astro` into a single root React component (e.g., `DashboardApp.tsx`) that contains the Header, Sidebar, and Main Content. This ensures the `CssVarsProvider` covers the entire app, sharing the theme state perfectly.
*   **Option B (Island Wrapper):** Create a wrapper component that wraps *each* individual island. This is harder to sync state with (especially theme toggling).

**Decision:** We will proceed with **Option A** for the Dashboard. We will create a `Dashboard.tsx` that serves as the main entry point for the React side of the app.

## Phase 2: Theme Configuration

### 2.1 Create Custom Theme
Create `src/styles/theme.ts` to define the "Moltbot" brand:
*   **Color Palette**: Map the existing Purple/Pink gradients to Joy UI's color scales (`primary`, `neutral`, `danger`, etc.).
*   **Typography**: Set font families (Inter/Roboto).
*   **Radius & Shadows**: configurations to match the "glass" feel (Joy UI supports transparent sheets and cards).

### 2.2 Global Styles
Use Joy UI's `<GlobalStyles />` to handle the body background pattern (the gradient mesh) that currently exists in `global.css`.

## Phase 3: Component Migration

We will rewrite components one by one to use Joy UI equivalents:

| Current Component | Joy UI Replacement | Notes |
| :--- | :--- | :--- |
| **Header** | `Sheet` (row), `Typography` | Use `level="h3"` for title, specific `IconButton` for actions. |
| **ThemeToggle** | `useColorScheme` hook | Joy UI has built-in light/dark mode handling. |
| **Inputs** | `Input`, `FormControl`, `FormLabel` | Replace standard HTML inputs. |
| **Buttons** | `Button` | Use `variant="solid"`, `variant="soft"`, `variant="outlined"`. |
| **Cards (News/Watchlist)** | `Card`, `CardContent` | Use `variant="soft"` or customized glass variant. |
| **Lists** | `List`, `ListItem`, `ListItemButton` | Great for the Sidebar and Watchlist. |
| **Icons** | `lucide-react` | Can still be used or swapped for `@mui/icons-material`. Keeping `lucide` is fine for now. |

## Phase 4: Implementation Steps

1.  **Install Packages**: Execute npm install commands.
2.  **Create `Dashboard.tsx`**: Move the layout structure (Header, Grid, Sidebar, Feed) from `index.astro` into this React component.
3.  **Wrap with Provider**: Wrap `Dashboard.tsx` content with:
    ```tsx
    <CssVarsProvider theme={customTheme}>
      <CssBaseline />
      {/* App Content */}
    </CssVarsProvider>
    ```
4.  **Refactor Sub-Components**:
    *   **Header.tsx**: Refactor to use Joy UI `Sheet`.
    *   **ThemeToggle.tsx**: Refactor to use `useColorScheme()`.
    *   **Watchlist.tsx**: Refactor list and inputs.
    *   **SourceManager.tsx**: Refactor forms and tables.
    *   **NewsFeed.tsx**: Refactor cards and typography.
5.  **Clean Up**: Remove `@tailwind` directives from `global.css` (or delete the file entirely if fully migrated) and remove Tailwind config.

## Phase 5: Verification
*   Verify Light/Dark mode toggling works instantly via Joy UI's engine.
*   Ensure the "Glassmorphism" aesthetic is preserved using Joy UI's alpha colors and backdrop-filter support.
