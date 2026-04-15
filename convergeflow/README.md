# ConvergeFlow

**5 clicks to a booked call.**

ConvergeFlow is a simplified outbound cold email platform built for blue-collar SMBs. It strips away the complexity of traditional cold email tools and delivers a guided workflow -- from signup to sending -- that anyone can follow without prior email marketing experience.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + CSS custom properties
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Unit Testing**: Vitest + Testing Library + happy-dom
- **E2E Testing**: Playwright (Chromium + mobile)
- **Code Quality**: ESLint, Prettier, SonarQube
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- npm

## Quick Start

```bash
# Clone the repo
git clone <repo-url> && cd convergeflow

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

## Project Structure

```
convergeflow/
  src/
    app/                    # Next.js App Router pages
      (auth)/               # Auth route group (login)
      (dashboard)/          # Dashboard route group (main app)
        dashboard/          # Home dashboard
        emails/             # Email campaigns + detail view
        customers/          # Customer list
        styles/             # Email style editor
        analytics/          # Campaign analytics
        deliverability/     # Deliverability monitoring
        settings/           # Account + payment settings
        help/               # Help center
      (onboarding)/         # Onboarding flow route group
        onboarding/
          signup/           # Account creation
          path/             # Path selection
          domain/           # Domain setup
          inbox/            # Inbox connection
          industry/         # Industry/niche selection
          style/            # Email style setup
      layout.tsx            # Root layout (fonts, metadata)
      globals.css           # CSS custom properties + base styles
      page.tsx              # Root redirect to /dashboard
    components/
      ui/                   # Reusable UI primitives (Button, Card, Badge, etc.)
      layout/               # Layout shells (DashboardLayout, OnboardingLayout)
      charts/               # Chart components (Recharts wrappers)
      icons/                # SVG icon components
    tests/
      setup.ts              # Vitest global setup
  e2e/                      # Playwright E2E tests
  public/
    avatars/                # Avatar images
  docs/                     # Architecture and design documentation
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright E2E tests with UI |
| `npm run sonar` | Run SonarQube analysis |
| `npm run quality` | Run lint + format check + unit tests + E2E (full pipeline) |

## Design System

The design system reference is available at [convergeflow-design-system.vercel.app](https://convergeflow-design-system.vercel.app).

### Brand Fonts

| Font | Usage | Weights |
|------|-------|---------|
| **Archivo** | Headings, bold labels | 700, 900 |
| **Chivo** | Body text, UI labels | 400, 500 |
| **JetBrains Mono** | Metrics, stats, code | 400, 500 |

Fonts are loaded via `next/font/google` and exposed as CSS variables (`--font-archivo`, `--font-chivo`, `--font-jetbrains`). Use the Tailwind utilities `font-heading`, `font-body`, and `font-mono`.

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-orange` | `#E85002` | Primary brand accent, CTAs, active states |
| `--color-orange-dark` | `#C44400` | Orange gradient end, hover states |
| `--color-olive` | `#707653` | Secondary accent |
| `--color-sand` | `#D9C3AB` | Warm neutral accent |
| `--color-mint` | `#D4E4DD` | Light accent |
| `--bg-page` | `#111113` | Page background |
| `--bg-card` | `#1B1B1F` | Card surfaces |
| `--bg-elevated` | `#222228` | Elevated surfaces |

Full token list in `src/app/globals.css`. Tailwind tokens are prefixed `cf-` (e.g., `bg-cf-card`, `text-cf-orange`).

## Deployment

The app deploys to **Vercel** with automatic preview deploys on pull requests.

- Production builds run `next build`
- Framework detection is configured in `vercel.json`
- CI runs lint, tests, build, and E2E on every PR (see `.github/workflows/ci.yml`)

## Quality Tools

- **SonarQube**: Static analysis configured via `sonar-project.properties`. Run `npm run sonar`.
- **ESLint**: Extended from `next/core-web-vitals` and `prettier`. Config in `.eslintrc.json`.
- **Prettier**: Enforced formatting. Config in `.prettierrc`.
- **Dependabot**: Weekly npm and GitHub Actions dependency updates.
- **CI Pipeline**: GitHub Actions runs lint, unit tests, build, and E2E tests on every push and PR.
