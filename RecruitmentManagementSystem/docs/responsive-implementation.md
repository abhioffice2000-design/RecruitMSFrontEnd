# Responsive UI — implementation notes

## Global

- **`src/styles/responsive-global.scss`** (imported from `styles.scss`): overflow control, `.min-w-0`, fluid spacing on `.card` / `.app-page-shell`, table tweaks, safe modal width on small screens.
- **`src/styles.scss`**: fluid `h1`–`h3` with `clamp()` for all pages.
- **`src/app/app.scss`**: `:host` on `app-root` — `min-width: 0`, `max-width: 100vw` to reduce horizontal bleed.

## Shell layouts (sidebar + main)

- **`src/app/hr-dashboard/hr-dashboard.scss`**: shared dashboard rules + **mobile drawer** (≤992px): fixed off-canvas sidebar, backdrop, menu button.
- **HR** (`hr-dashboard.html` / `.ts`): floating menu button + backdrop; closes on route change.
- **Candidate** (`candidate-portal.html`): `has-mobile-nav-inbar` when header is visible (button in top bar); floating button when header is hidden (e.g. Browse Jobs).
- **Manager** (`manager-layout.html` / `.ts`): top bar in-bar button + drawer.
- **Interviewer** (`interviewer-portal.html` / `.ts`): top bar button; `setView()` closes the drawer (SPA-style nav).
- **Admin** (`admin-layout.*`): hamburger + backdrop; `.menu-open` slides sidebar in; fixed positioning for `sidebar-wrapper` on small screens.

## Header

- **`src/app/layout/header/header.component.css`**: flexible search width (`min()` / `flex`), wrapping, small-screen column layout and text ellipsis on user labels.

## What to refine next (optional)

- Large inline-template tabs (e.g. HR **candidates**) may still need per-section media queries or card grids.
- Run **`ng build`** and test at 320px, 375px, 768px, 1024px breakpoints.
- Consider **component-level** `@defer` for heavy subtrees (see `docs/lazy-loading-analysis.md`).
