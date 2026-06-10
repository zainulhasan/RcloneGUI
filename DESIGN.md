# RcloneGUI Design System

This document is the single source of truth for visual design in RcloneGUI. Every screen is
built from the tokens and primitives described here. **No one-off styles** — if a screen needs
something new, extend the design system first, then use it.

## Architecture

- **Tokens** live in `src/theme/tokens.css` as CSS variables on `:root` (light) and `.dark` (dark).
- `src/index.css` maps tokens into Tailwind v4 via `@theme inline`, so utilities like
  `bg-primary` or `text-muted-foreground` resolve to the semantic variables.
- **Primitives** live in `src/components/ui/` (shadcn/ui, new-york style, Radix under the hood).
- **Layout** components live in `src/components/layout/`.
- Theme switching toggles the `dark` class on `<html>` — see `src/store/theme.ts`
  (`light` / `dark` / `system`, persisted to localStorage, follows OS changes in `system` mode).

## Color Tokens

All colors are `oklch`. Components reference semantic tokens only, never raw values.

| Token                                        | Tailwind utility                    | Use for                               |
| -------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `--background` / `--foreground`              | `bg-background`, `text-foreground`  | App canvas and default text           |
| `--card` / `--card-foreground`               | `bg-card`                           | Elevated surfaces (cards, panels)     |
| `--popover` / `--popover-foreground`         | `bg-popover`                        | Menus, dialogs, tooltips, toasts      |
| `--primary` / `--primary-foreground`         | `bg-primary`                        | Primary actions, active states, links |
| `--secondary` / `--secondary-foreground`     | `bg-secondary`                      | Secondary buttons and chips           |
| `--muted` / `--muted-foreground`             | `bg-muted`, `text-muted-foreground` | Subdued backgrounds, helper text      |
| `--accent` / `--accent-foreground`           | `bg-accent`                         | Hover/selected backgrounds            |
| `--destructive` / `--destructive-foreground` | `bg-destructive`                    | Dangerous actions (delete, purge)     |
| `--success` / `--success-foreground`         | `bg-success`                        | Completed transfers, healthy status   |
| `--warning` / `--warning-foreground`         | `bg-warning`                        | Disk-space warnings, dry-run notices  |
| `--border`, `--input`, `--ring`              | `border-border`, `ring-ring`        | Hairlines, input borders, focus rings |
| `--sidebar-*`                                | `bg-sidebar`, …                     | Sidebar-specific surfaces             |
| `--chart-1` … `--chart-5`                    | `text-chart-1`, …                   | Bandwidth chart series                |

Rules:

- **Danger requires `destructive`**, never raw red. Success/warning likewise.
- Text on a colored surface always uses the matching `*-foreground` token.
- Hover states use the same hue at reduced opacity (e.g. `hover:bg-primary/90`) — no new colors.

## Radius Scale

`--radius` is `0.5rem`. Tailwind maps: `rounded-sm` (radius − 4px), `rounded-md` (radius − 2px),
`rounded-lg` (radius), `rounded-xl` (radius + 4px). Buttons/inputs use `md`, cards/dialogs `lg`.

## Spacing & Density

Tailwind's default 4px spacing scale. The app is _slightly dense_:

- Page padding: `p-6`. Section gaps: `gap-4` / `space-y-4`.
- Within cards: `gap-2` / `gap-3`. Table cells: `px-3 py-2`.
- Control heights: default `h-9`, compact contexts (toolbars, table rows) `h-8`.

## Typography

System font stack (Tailwind default `font-sans`).

| Role               | Classes                                     |
| ------------------ | ------------------------------------------- |
| Page title         | `text-xl font-semibold`                     |
| Section/card title | `text-sm font-semibold` (CardTitle default) |
| Body               | `text-sm`                                   |
| Helper/meta        | `text-xs text-muted-foreground`             |
| Code/paths         | `font-mono text-xs`                         |

## Shadows

`--shadow-xs` … `--shadow-lg` are theme-aware (deeper in dark mode). Cards use `shadow-sm`,
popovers/dialogs `shadow-md`/`shadow-lg`. Never use Tailwind's raw shadow palette directly.

## Primitives (`src/components/ui/`)

Button, Card, Dialog, Table, Tabs, Input, Textarea, Select, Toast (sonner), Tooltip, Badge,
Progress, Switch, Checkbox, Label, Alert, Separator, ScrollArea, DropdownMenu.

Usage rules:

- **Button**: `default` for the primary action of a view (max one visible), `outline`/`secondary`
  for everything else, `destructive` for deletions, `ghost` for icon/toolbar buttons.
- **Dialog**: all confirmations and wizards. Destructive confirmations state exactly what will be
  deleted and use a `destructive` confirm button.
- **Toast** (`sonner`): outcome feedback only (job finished, deletion done, update failed).
  Never use toasts for validation errors — show those inline.
- **Badge**: statuses (`watched`, transfer state, mount state). Secondary variant by default.
- **Tooltip**: every icon-only button must have a tooltip and an `aria-label`.
- **Progress**: determinate progress only; use a spinner (`Loader2` icon) when indeterminate.

## Layout

`AppShell` (`src/components/layout/app-shell.tsx`): fixed 13rem sidebar (`bg-sidebar`) with main
navigation, Settings + theme toggle pinned at the bottom, scrollable `<main>` content area.
Views render inside `<main>` with `p-6` padding and a `text-xl font-semibold` page title.

## Icons

`lucide-react` only, default size `size-4` (16px) inside controls, `size-5` for nav/brand.
