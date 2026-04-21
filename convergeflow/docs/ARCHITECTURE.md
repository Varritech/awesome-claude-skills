# Architecture

## High-Level Overview

```
                        Vercel (Edge + Serverless)
                                  |
                          +-------+-------+
                          |  Next.js 14   |
                          |  App Router   |
                          +-------+-------+
                                  |
          +-----------+-----------+-----------+
          |           |           |           |
     (auth)     (onboarding)  (dashboard)   API
     Route       Route         Route       Routes
     Group       Group         Group      (future)
          |           |           |
          v           v           v
     AuthLayout  OnboardingLayout  DashboardLayout
                                    (Sidebar + MobileNav)
          |           |           |
          +-----+-----+-----+----+
                |           |
           UI Components   Charts
           (src/components/ui)
```

ConvergeFlow is a single-page application built on Next.js 14 App Router. It uses route groups to apply different layouts to different sections of the app without affecting URL paths.

## Folder Structure

```
src/
  app/
    layout.tsx              # Root layout: loads fonts, sets metadata
    globals.css             # CSS custom properties (design tokens)
    page.tsx                # Root redirect -> /dashboard

    (auth)/                 # Auth route group
      layout.tsx            # Centered card layout
      login/page.tsx

    (onboarding)/           # Onboarding route group
      layout.tsx            # Passthrough (no additional wrapper)
      onboarding/
        page.tsx            # Onboarding entry (signup redirect)
        signup/page.tsx     # Step: Account creation
        path/page.tsx       # Step: Path selection
        domain/page.tsx     # Step: Domain setup
        inbox/page.tsx      # Step: Inbox connection
        industry/page.tsx   # Step: Industry/niche
        style/page.tsx      # Step: Email style + launch
        openclaw/page.tsx   # OpenClaw integration

    (dashboard)/            # Dashboard route group
      layout.tsx            # Wraps children in DashboardLayout
      dashboard/page.tsx    # Home dashboard (metrics overview)
      emails/
        page.tsx            # Email campaign list
        [id]/page.tsx       # Email detail view (dynamic route)
      customers/page.tsx    # Customer list
      styles/page.tsx       # Email style editor
      analytics/page.tsx    # Campaign analytics
      deliverability/page.tsx  # Deliverability monitoring
      settings/
        page.tsx            # General settings
        payments/page.tsx   # Payment settings
      help/page.tsx         # Help center

  components/
    ui/                     # Reusable UI primitives
      Button.tsx
      Card.tsx              # Card, MetricCard, ActionCard
      Badge.tsx             # Badge, CountBadge
      Input.tsx
      Select.tsx
      Toggle.tsx
      Avatar.tsx            # Avatar, MenuDot
      index.ts              # Barrel export

    layout/                 # Layout shells
      DashboardLayout.tsx   # Sidebar + MobileNav + content area
      OnboardingLayout.tsx  # Progress bar + step breadcrumbs
      index.ts

    charts/                 # Recharts wrappers
      Charts.tsx
      index.ts

    icons/                  # SVG icon components
      Icon.tsx
      index.ts

  tests/
    setup.ts                # Vitest global setup (testing-library matchers)

e2e/                        # Playwright E2E tests
  smoke.spec.ts             # Basic smoke tests
  dashboard.spec.ts         # Dashboard-specific tests
```

## Component Hierarchy

```
RootLayout (fonts, global CSS)
  |
  +-- AuthLayout
  |     +-- LoginPage
  |
  +-- OnboardingGroupLayout (passthrough)
  |     +-- OnboardingLayout (progress bar, steps)
  |           +-- SignupPage
  |           +-- PathPage
  |           +-- DomainPage
  |           +-- InboxPage
  |           +-- IndustryPage
  |           +-- StylePage
  |
  +-- DashboardLayout (Sidebar + MobileNav)
        +-- DashboardPage
        +-- EmailsPage / EmailDetailPage
        +-- CustomersPage
        +-- StylesPage
        +-- AnalyticsPage
        +-- DeliverabilityPage
        +-- SettingsPage / PaymentsPage
        +-- HelpPage
```

### Layout Responsibilities

- **RootLayout** (`src/app/layout.tsx`): Loads Google Fonts (Archivo, Chivo, JetBrains Mono) as CSS variables, applies `font-body` as the default, sets page metadata.
- **AuthLayout**: Centers content vertically and horizontally on a full-height dark background.
- **OnboardingLayout**: Fixed top bar with logo, step breadcrumbs, and a gradient progress track. Used as a wrapper component (not a route group layout) so pages can pass `currentStep`.
- **DashboardLayout**: Persistent sidebar (desktop) with icon navigation, mobile bottom nav bar, and a max-width content area.

## Styling Approach

### Tailwind CSS + CSS Custom Properties

The project uses a two-layer system:

1. **CSS custom properties** in `globals.css` define the design tokens (colors, radii, spacing, transitions).
2. **Tailwind config** (`tailwind.config.ts`) maps those properties to utility classes with the `cf-` prefix.

This means you write Tailwind in components (`bg-cf-card`, `text-cf-orange`, `rounded-cf-btn`) and the actual values are resolved from CSS variables at runtime.

```
globals.css          tailwind.config.ts        Component
--bg-card: #1B1B1F   "cf-card": "var(--bg-card)"   className="bg-cf-card"
```

### Why Not Just Tailwind?

CSS custom properties give us:
- A single source of truth for token values
- Easy theming (swap the variable, all components update)
- Access to tokens outside of Tailwind (inline styles, third-party libs)

### No Borders

The design follows the Cuberto pattern of **background stepping** instead of borders. Surfaces are distinguished by their background shade:

```
Page (#111113) > Card (#1B1B1F) > Elevated (#222228) > Subtle (white 6%)
```

Do not add `border` utilities to cards or containers. If visual separation is needed, use a different background level.

## Font System

Three fonts are loaded in the root layout via `next/font/google`:

| Font | Variable | Tailwind Class | Role |
|------|----------|----------------|------|
| Archivo | `--font-archivo` | `font-heading` | Headings, bold labels. Weights: 700, 900. |
| Chivo | `--font-chivo` | `font-body` / `font-sans` | Body text, UI labels. Default font. Weights: 400, 500. |
| JetBrains Mono | `--font-jetbrains` | `font-mono` | Metrics, statistics, code. Weights: 400, 500. |

The `font-sans` alias also maps to Chivo, so Tailwind's default sans-serif stack uses the brand font.

## Color System

### Token Hierarchy

```
CSS Custom Properties (globals.css)
  |
  v
Tailwind Tokens (tailwind.config.ts, cf-* prefix)
  |
  v
Component Classes (bg-cf-card, text-cf-orange, etc.)
```

### Token Categories

**Backgrounds** (dark stepping):
- `--bg-page` (#111113) - Page background
- `--bg-card` (#1B1B1F) - Card surfaces
- `--bg-elevated` (#222228) - Elevated elements within cards
- `--bg-subtle` (white 6%) - Subtle highlight
- `--bg-card-in-card` (#161618) - Nested card surfaces

**Brand Accents**:
- `--color-orange` (#E85002) - Primary brand color
- `--color-olive` (#707653) - Secondary accent
- `--color-sand` (#D9C3AB) - Warm neutral
- `--color-mint` (#D4E4DD) - Light accent

**Semantic Colors**:
- `--color-green` (#22C55E) - Success
- `--color-red` (#EF4444) - Error
- `--color-amber` (#F59E0B) - Warning
- `--color-indigo` (#6366F1) - Info

**Text Hierarchy**:
- `--text-primary` (white) - Main content
- `--text-secondary` (white 50%) - Supporting text
- `--text-muted` (white 35%) - De-emphasized
- `--text-dim` through `--text-faint` - Progressively lighter

**Gray Scale**:
- `--color-absolute-black` (#050505)
- `--color-dark-gray` (#333333)
- `--color-mid-gray` (#646464)
- `--color-light-gray` (#A7A7A7)
- `--color-off-white` (#F9F9F9)

## State Management

- **Zustand** is the state management library. It provides lightweight stores without the boilerplate of Redux.
- Stores should be created per-domain (e.g., email store, onboarding store) rather than one global store.
- Server-side data fetching uses Next.js conventions (server components, `fetch` in page components). Zustand is for client-side UI state only.

## Routing

### App Router with Route Groups

Next.js App Router is used with **route groups** (parenthesized folder names) to apply different layouts without affecting the URL path:

| Route Group | Layout | URL Prefix | Pages |
|-------------|--------|------------|-------|
| `(auth)` | AuthLayout (centered) | `/login` | Login |
| `(onboarding)` | OnboardingLayout (progress bar) | `/onboarding/*` | Signup, path, domain, inbox, industry, style |
| `(dashboard)` | DashboardLayout (sidebar) | `/*` | Dashboard, emails, customers, styles, analytics, settings, etc. |

### Dynamic Routes

- `/emails/[id]` -- Email detail page, uses a dynamic segment for the email ID.

### Root Redirect

The root page (`/`) redirects to `/dashboard` via `next/navigation`'s `redirect()`.

### Navigation

- **Desktop**: Sidebar with icon-only navigation links. Active state uses orange accent + left indicator bar.
- **Mobile**: Fixed bottom nav bar with icon + label. Simplified to four primary destinations.
- Active route detection supports both exact match and prefix match (for nested routes like `/emails/123`).
