# Lazy loading — analysis (RMS Angular app)

**Status:** Analysis only — no implementation in this change.

This document describes how lazy loading works in this project today, what “more lazy loading” could mean, and practical options if you optimize later.

---

## 1. Current state (what you already have)

### Route-level lazy loading (already implemented)

In `src/app/app.routes.ts`, routes use **`loadComponent`** with **dynamic `import()`**:

```ts
loadComponent: () =>
  import('./hr-dashboard/jobs/jobs').then((m) => m.JobsTab),
```

That pattern tells the Angular CLI bundler (esbuild/webpack under the hood) to:

- Put each imported component (and its **static** dependency tree) into a **separate JavaScript chunk**.
- Download that chunk **only when the user navigates** to that route (first time).

So for this app:

- **Admin**, **candidate**, **HR**, **manager**, **interviewer** areas are **not** all loaded on first paint; each child route’s component is split into its own async chunk.
- **Shell** components (e.g. `HrDashboard`, `CandidatePortal`, `ManagerLayout`) load when entering that area; **tabs/pages** load when their path is activated.

**Conclusion:** You are already using Angular’s standard **lazy loading at the route level** (standalone `loadComponent` style). There is no separate “turn lazy loading on” switch missing for routes that already use `import()`.

---

## 2. What “implement lazy loading” might mean next

People often mean one or more of the following — they are **different** optimizations:

| Goal | Meaning | Relevant to this codebase? |
|------|-----------|----------------------------|
| **A. Smaller first bundle** | User downloads less JS before seeing `/home` or `/login` | Partly done via `loadComponent`; further gains need **shared code** and **heavy libraries** review. |
| **B. Lazy feature modules** | `loadChildren` loading a route array or `NgModule` | Optional; project is **standalone** — you typically keep **`loadComponent`** or use **`loadChildren`** with standalone route configs. |
| **C. Preloading** | Load lazy chunks in the background after first navigation | **Not** lazy loading per se; it **prefetches** chunks to make later navigation faster. |
| **D. Lazy JS inside a component** | `import()` inside a method (e.g. charts, PDF, big editor) | Reduces **that** route’s chunk size if the heavy lib is only loaded on demand. |
| **E. Template deferral** | `@defer` in templates to defer rendering of heavy subtrees | Angular 17+; reduces **work** and sometimes **dependencies** loaded for initial paint of that view. |

---

## 3. Gaps / improvements to consider (if you optimize later)

### 3.1 Shared services and “fat” imports

Lazy routes still **share** the same singleton services from `providedIn: 'root'` and anything **statically imported** from `main.ts`, `app.config.ts`, or widely used barrels.

**If** `SoapService`, Cordys wrappers, or large utilities are pulled into the **main** bundle because of static imports, every user pays that cost up front.

**How to analyze (when you implement):**

- Run a **production** build with stats:  
  `ng build --configuration=production --stats-json`  
  Then inspect with **webpack-bundle-analyzer** (or Angular’s built-in budget warnings).
- Look for large chunks named `vendor`, `common`, or a huge `main` — trace which modules pull them in.

**Possible follow-ups:**

- Split rarely used features behind **dynamic `import()`** inside components (not only in routes).
- Avoid importing entire libraries when only a small API is needed (tree-shaking friendly imports).

### 3.2 HR / large dashboard components

Files like `hr-dashboard/candidates/candidates.ts` are very large. Route lazy loading loads that file **when the user opens that route**, not on app start — good — but the **single chunk** for that route can still be big.

**Possible follow-ups:**

- Break UI into **smaller standalone components** with their own lazy routes or `@defer`.
- Move rarely used dialogs/tabs behind **dynamic import** or `@defer (on viewport)` / `on interaction`.

### 3.3 `loadChildren` for grouped routes (optional structural change)

Instead of one big `app.routes.ts`, you can define:

- `hr.routes.ts` exporting `Routes`
- In `app.routes.ts`:  
  `loadChildren: () => import('./hr-dashboard/hr.routes').then(m => m.HR_ROUTES)`

**Benefit:** Cleaner organization and sometimes clearer chunk naming; **behavior** is similar to many `loadComponent` entries if each child still uses `import()`.

**Note:** You must align with **standalone** + `provideRouter` — use the pattern supported by your Angular version (route arrays with `loadComponent` children).

### 3.4 Preloading strategies

After lazy chunks exist, you can add **preloading** so that chunks are fetched after bootstrap (e.g. `PreloadAllModules` or a custom strategy that only preloads certain paths).

**Benefit:** Faster clicks after first load.  
**Cost:** More network use right after login.

This does **not** replace lazy loading; it **changes when** chunks download.

### 3.5 Auth guards and lazy loading

Guards run **before** activating a route and **before** loading lazy components (depending on configuration). Your `authGuard` / `roleGuard` / `guestGuard` are compatible with `loadComponent`.

**Watch for:** Guards that inject very heavy services with static side effects — those services can still inflate the initial bundle if imported from a core module loaded at bootstrap.

---

## 4. What you do **not** need for “basic” lazy routes

- You do **not** have to convert standalone components back to `NgModule` to get lazy loading — `loadComponent` + `import()` is the modern approach.
- You do **not** need a separate `LazyModule` per area unless you explicitly want module boundaries for DI or legacy reasons.

---

## 5. Suggested order of work (when you choose to implement)

1. **Measure:** Production build + bundle analyzer; identify top 5 files/chunks by size.  
2. **Confirm route chunks:** Verify `dist/.../*.js` contains separate chunks per major feature (HR jobs, HR candidates, etc.).  
3. **Reduce hot paths:** Dynamic import for heavy third-party libs used in one feature only.  
4. **Optional:** `@defer` for heavy template sections.  
5. **Optional:** Preloading strategy after login for the user’s primary portal only.

---

## 6. References (Angular concepts)

- **Route lazy loading (standalone):** `loadComponent` / `loadChildren` with dynamic `import()`.
- **Bundle analysis:** Angular CLI budgets (`angular.json`) + `--stats-json`.
- **Deferrable views:** `@defer` in component templates (Angular 17+).

---

*Document generated as analysis-only; no routing or build configuration was changed for this file.*
