---
name: landing-page-generator
description: >
  Generate complete, production-ready Next.js 16 landing pages with distinctive design aesthetics,
  Tailwind CSS v4, shadcn/ui, Motion animations, and Lenis smooth scrolling. This skill should be
  used when asked to create a landing page, product page, sales page, or single-page marketing
  website. It produces a fully deployable project with section-based architecture, bilingual support,
  scroll-triggered animations, glassmorphism, gradient text effects, and responsive design.
---

# Landing Page Generator

Generate a complete, standalone Next.js 16 landing page project from a structured specification.

## Fixed Tech Stack

- **Framework:** Next.js 16.x (App Router, TypeScript, `src/` directory)
- **Styling:** Tailwind CSS v4 (uses `@import "tailwindcss"` — NOT v3 config files)
- **UI:** shadcn/ui v4 (base-nova style, `@base-ui/react`)
- **Animations:** Motion 12 — import from `motion/react` (NOT `framer-motion`)
- **Smooth scroll:** Lenis — import from `lenis/react`
- **Icons:** lucide-react
- **Fonts:** Google Fonts via `next/font/google`

## Generation Workflow

### Step 1: Read the Input Specification

The input includes: business name, industry, aesthetic preset, sections to include, content (per-section text), languages, uploaded asset URLs, and optional color overrides.

### Step 2: Select Design Tokens

Choose the aesthetic preset from `references/design-system.md`. Each preset defines: CSS custom properties (`:root` block), Google Font families + weights, effect class definitions, gradient colors. If the user provides custom colors, override the preset defaults.

### Step 3: Generate globals.css

Use the Tailwind v4 format with `@import "tailwindcss"` and `@theme inline` block. Include:
- CSS custom properties from the chosen preset
- `.noise-overlay` — subtle noise texture via inline SVG
- `.gradient-text` — static gradient background-clip text
- `.gradient-text-animated` — animated gradient shift (6s loop)
- `.glass-panel` — glassmorphism (blur + saturate + semi-transparent bg)
- `.animated-mesh` — multi-radial-gradient background with drift animation
- `.film-grain` — pseudo-element noise overlay with multiply blend
- `.glow-{accent}` — box-shadow glow effect
- `@media (prefers-reduced-motion: reduce)` — disable all animations
- `@layer base` — body bg/text, html font-sans

See `references/design-system.md` for full CSS per aesthetic.

### Step 4: Generate translations.ts

Create a `Language` type union from the specified languages (e.g., `"en" | "es"`). Build a translations object with all content organized by section. Every user-visible string must go through translations — never hardcode text in components.

Structure:
```typescript
export type Language = "en" | "es"; // from spec
export const translations = {
  nav: { items: { en: "...", es: "..." }, ... },
  hero: { heading: { en: "...", es: "..." }, ... },
  // one key per section
};
```

### Step 5: Generate Section Components

Create one component per section in `src/components/sections/`. Every section component follows this pattern:

```typescript
"use client";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/translations";

export default function SectionName() {
  const { t } = useLanguage();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  // ... motion.div with initial/animate conditional on inView
}
```

See `references/component-patterns.md` for full templates of each section type.

### Step 6: Generate page.tsx and layout.tsx

- **layout.tsx**: Import fonts from `next/font/google`, configure variables, wrap children in `LanguageProvider` → `SmoothScrolling`
- **page.tsx**: Import and compose all section components in order

## Available Sections

| Section | File | Key Features |
|---------|------|-------------|
| Navbar | `navbar.tsx` | Fixed header, glassmorphism on scroll, language toggle, mobile hamburger, CTA button |
| Hero | `hero.tsx` | Full viewport, animated-mesh + film-grain background, gradient-text-animated heading, staggered entrance, scroll indicator |
| Showcase | `showcase.tsx` | 3-column card grid, glass-panel cards, image with gradient overlay, hover lift (whileHover: y: -8), staggered scroll reveal |
| About | `about.tsx` | 2-column (image + text), parallax via useScroll/useTransform, AnimatedCounter for stats, decorative accent border |
| Testimonials | `testimonials.tsx` | Masonry grid (CSS columns), glass-panel cards, Quote icon, star ratings, avatar initials |
| Details | `details.tsx` | Alternating image/text rows, parallax cover images, animated check-mark benefit lists, per-item accent colors |
| FAQ | `faq.tsx` | shadcn Accordion (base-ui, NO type/collapsible props), glass-panel items |
| CTA | `cta.tsx` | Gradient background + animated-mesh overlay, gradient-text-animated heading, fanned product images with rotation hover, dual CTA buttons |
| Footer | `footer.tsx` | Simple footer with brand, links, copyright |

## Critical Rules

### DO:
- Use `motion/react` for all motion imports
- Use Tailwind v4 `@import "tailwindcss"` (not tailwind.config.js)
- Use shadcn base-nova style with `@base-ui/react`
- Include `.noise-overlay`, `.glass-panel`, `.gradient-text` CSS classes
- Include `@media (prefers-reduced-motion: reduce)` blocks
- Make everything responsive (mobile-first with sm/md/lg breakpoints)
- Put ALL text through the translations system
- Include language toggle even for single-language sites
- Use `next/font/google` for fonts (not next/font/local)
- Copy `language-provider.tsx` and `smooth-scrolling.tsx` from `assets/boilerplate/`

### DON'T:
- Don't use `framer-motion` import path (it's `motion/react`)
- Don't use Tailwind v3 config files
- Don't use flat white (#fff) or flat black (#000) as primary backgrounds
- Don't use generic Inter-only typography
- Don't hardcode visible text in components
- Don't use `type="single"` or `collapsible` props on shadcn Accordion (base-ui doesn't support them)
- Don't use `smoothTouch` option in Lenis (not in current types)

## References

- `references/component-patterns.md` — Full component templates for each section
- `references/design-system.md` — 6 aesthetic presets with complete CSS
- `references/translation-system.md` — i18n provider + translations pattern
- `references/project-structure.md` — File tree, package.json, configs
