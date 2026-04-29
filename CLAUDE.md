# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

This is the **Sharayu Dental Clinic admin frontend** — an Angular 18 SPA for doctors and receptionists. It is built as `clinic2.0` and calls a separate Node.js backend at `https://api.sharayudental.com/v1` (locally: `http://localhost:3000/v1`).

This repo is **frontend only**. It never touches the database directly. The companion backend repo (`sharayu-backend/`) is hosted and deployed separately.

---

## Commands

```bash
# Development server
npm start              # ng serve — http://localhost:4200

# Production build (output: dist/clinic2.0/)
npm run build          # ng build

# Watch mode (dev)
npm run watch

# Tests
npm test               # Karma + Jasmine
```

Run a single spec file:
```bash
npx ng test --include='src/app/auth/**/*.spec.ts'
```

---

## Architecture

### Angular version and style

Angular 18, **standalone components** throughout. No NgModules except for third-party library bootstrapping in `app.config.ts`. Use functional guards (`CanActivateFn`), functional interceptors (`HttpInterceptorFn`), and `inject()` instead of constructor injection.

### Layouts

Two root layouts defined in `src/app/layouts/`:

| Layout | Component | Used for |
|--------|-----------|----------|
| `FullComponent` | `layouts/full/` | All authenticated pages — vertical/horizontal sidebar + router-outlet |
| `BlankComponent` | `layouts/blank/` | Auth pages (login, register, error) |

`FullComponent` supports both vertical and horizontal nav modes. Theme settings (light/dark, color scheme, boxed layout, nav position) are managed by `CoreService` via `AppSettings` stored in `config.ts`. The customizer panel at runtime writes back to `CoreService`.

### Routing

`app.routes.ts` — two top-level route groups:
- `FullComponent` (authenticated): protected by `authGuard` via `canActivateChild`. Contains all feature page routes, each lazy-loaded with `loadChildren`.
- `BlankComponent` (public): `/authentication/**` and `/landingpage`.

Feature page routes live in `src/app/pages/` with individual `*.routes.ts` files per section:
- `dashboards/` — dashboard1, dashboard2
- `apps/` — chat, email, calendar, invoice, contacts, notes, employee, courses, task, todo, tickets, blogs
- `ui-components/`, `forms/`, `charts/`, `tables/`, `datatable/`, `widgets/`, `theme-pages/`

### Auth layer (`src/app/auth/`)

| File | Role |
|------|------|
| `auth.service.ts` | `POST /auth/login` → stores session via `AuthStorageService` |
| `auth-storage.service.ts` | Stores `access_token`, `refresh_token`, `user` in `localStorage` under `dentaflow_*` keys |
| `auth.interceptor.ts` | Functional interceptor — attaches `Authorization: Bearer` header to every request |
| `auth.guard.ts` | Functional guard — redirects to `/authentication/login` if no access token |
| `auth.models.ts` | `LoginRequest`, `LoginResponse`, `AuthUser` interfaces |
| `auth.config.ts` | `authApiConfig.baseUrl` — change this to switch API environments |

The backend API base URL is configured in `src/app/auth/auth.config.ts`:
```ts
export const authApiConfig = {
  baseUrl: 'http://localhost:3000/v1',
  loginEndpoint: '/auth/login',
};
```

### Theme/settings system

`CoreService` holds an `AppSettings` object (from `config.ts`) in a `BehaviorSubject`. `FullComponent` calls `receiveOptions()` and applies `dark-theme` / `light-theme` CSS class on `<html>`. The runtime customizer panel reads/writes these settings. Do not bypass `CoreService.setOptions()` for theme changes.

### Key third-party libraries

| Library | Use |
|---------|-----|
| Angular Material (`MaterialModule`) | All UI components — single barrel in `material.module.ts` |
| `angular-tabler-icons` | Icons — all icons imported globally via `TablerIconsModule.pick(TablerIcons)` in `app.config.ts` |
| `ngx-permissions` | Role-based UI visibility |
| `angular-calendar` + `date-fns` | Calendar app page |
| `ngx-echarts` / `apexcharts` | Charts |
| `@ngx-translate` | i18n — translation files in `src/assets/i18n/` |
| `ngx-scrollbar` | Custom scrollbars in sidebar |

Import icons via `angular-tabler-icons/icons` — they are all pre-registered globally.

---

## Broader Project Context

The admin app is part of a two-repo dental practice management system:

- **This repo** (admin frontend) → `https://admin.sharayudental.com` — deployed to S3 + CloudFront
- **`sharayu-backend/`** (Node.js) → `https://api.sharayudental.com/v1` — runs on EC2 + PM2

`POST /appointments` on the backend is **public** (no auth). All other API calls require a Bearer token, which `authInterceptor` adds automatically.

Full project rules, critical flows, and the database schema are documented in `CLAUDE_CODE_INSTRUCTIONS.md` and `project-context.md` in this directory. Read those before making backend-facing changes.
