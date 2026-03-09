# Component Patterns

Each section component follows a consistent architecture. Below are the template patterns for every section type. Adapt content, colors, and structure to match the user's specification.

## Common Patterns

### Scroll-Triggered Animation
```tsx
const ref = useRef(null);
const inView = useInView(ref, { once: true, margin: "-60px" });

<motion.div
  ref={ref}
  initial={{ opacity: 0, y: 30 }}
  animate={inView ? { opacity: 1, y: 0 } : {}}
  transition={{ duration: 0.7 }}
>
```

### Parallax Effect
```tsx
const { scrollYProgress } = useScroll({
  target: sectionRef,
  offset: ["start end", "end start"],
});
const imageY = useTransform(scrollYProgress, [0, 1], [40, -40]);

<motion.div style={{ y: imageY }}>
```

### Animated Counter
```tsx
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else { setCount(Math.floor(current)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}
```

### Section Header Pattern
```tsx
<p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
  {t(translations.section.label)}
</p>
<h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
  <span className="gradient-text">{t(translations.section.heading)}</span>
</h2>
```

---

## Navbar

Fixed header with glassmorphism on scroll. Mobile hamburger with AnimatePresence.

```tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/translations";

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    // Map from translations.nav — one per section
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-panel shadow-sm" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="font-display text-xl font-bold tracking-tight text-foreground">
          {{BUSINESS_NAME}}
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}
              className="font-sans text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
          <button onClick={() => setLang(lang === "{{LANG_A}}" ? "{{LANG_B}}" : "{{LANG_A}}")}
            className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
            {lang === "{{LANG_A}}" ? "{{LANG_B_UPPER}}" : "{{LANG_A_UPPER}}"}
          </button>
          <a href="#cta" className="rounded-full bg-primary px-5 py-2 font-sans text-sm font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg">
            {t(translations.nav.buy)}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground" aria-label="Toggle menu">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass-panel overflow-hidden md:hidden">
            <div className="flex flex-col gap-4 px-6 py-6">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                  className="font-sans text-base font-medium text-foreground">{item.label}</a>
              ))}
              <a href="#cta" onClick={() => setMobileOpen(false)}
                className="rounded-full bg-primary px-5 py-2.5 text-center font-sans text-sm font-medium text-primary-foreground">
                {t(translations.nav.buy)}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
```

---

## Hero

Full viewport with animated mesh background, gradient text heading, staggered entrance.

```tsx
"use client";

import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/translations";

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden animated-mesh film-grain">
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t(translations.hero.tagline)}
        </motion.p>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="gradient-text-animated">{t(translations.hero.heading)}</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }}
          className="mx-auto mt-8 max-w-2xl font-sans text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {t(translations.hero.subheading)}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1 }} className="mt-10">
          <a href="#showcase" className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-sans text-base font-medium text-primary-foreground transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
            {t(translations.hero.cta)}
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
          <a href="#showcase" className="flex flex-col items-center gap-2 text-muted-foreground" aria-label="Scroll down">
            <span className="font-mono text-[10px] uppercase tracking-widest">{t(translations.hero.scroll)}</span>
            <ChevronDown size={16} />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
```

---

## Showcase (Product/Feature Cards)

3-column grid with glass panels, image overlay, hover lift.

Key pattern:
- Each card: `glass-panel rounded-2xl`, `aspect-[3/4]` image with gradient overlay
- `whileHover={{ y: -8 }}` for lift effect
- `Image` with `group-hover:scale-105` for zoom
- Staggered delays: `delay: index * 0.15`

```tsx
// Card component uses useRef + useInView per card
// Parent section uses useRef + useInView for the section header
// Grid: className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
```

---

## About

2-column grid (image + text), parallax image, animated counters.

Key pattern:
- `useScroll({ target: sectionRef, offset: ["start end", "end start"] })`
- `useTransform(scrollYProgress, [0, 1], [40, -40])` for image parallax
- `AnimatedCounter` component for stats
- Image side: `initial={{ opacity: 0, x: -40 }}`, Text side: `initial={{ opacity: 0, x: 40 }}`
- Decorative accent: `absolute -bottom-4 -right-4 rounded-2xl border-2 border-primary/20 -z-10`
- Stats grid: `grid grid-cols-3 gap-6` with `font-display text-3xl font-bold text-primary`

---

## Testimonials

Masonry grid with glass panel cards, quote icon, star ratings.

Key pattern:
- CSS columns masonry: `className="columns-1 gap-6 sm:columns-2 lg:columns-3"`
- Each card wrapped in `<div className="mb-6 break-inside-avoid">`
- Card has: Quote icon, italic text, avatar (initial letter), name, role, 5 stars
- Star fill: `className="fill-primary text-primary"`

---

## Details (Deep-Dive Sections)

Alternating image/text rows with parallax and animated benefit lists.

Key pattern:
- Alternating: `reverse={i % 2 === 1}` → text/image order flips via `lg:order-1` / `lg:order-2`
- Parallax: `useTransform(scrollYProgress, [0, 1], [30, -30])`
- Benefits list: `<Check>` icon in colored circle + text, staggered animation `delay: 0.3 + i * 0.1`
- Per-item colors via `style={{ backgroundColor: item.color }}`

---

## FAQ

shadcn Accordion with glass panels.

**IMPORTANT:** Use shadcn Accordion (base-ui) without `type` or `collapsible` props — they don't exist in the base-ui version.

```tsx
<Accordion className="space-y-3">
  {translations.faq.items.map((item, i) => (
    <AccordionItem key={i} className="glass-panel rounded-xl border-none px-6">
      <AccordionTrigger className="font-sans text-base font-medium text-foreground hover:no-underline py-5">
        {t(item.q)}
      </AccordionTrigger>
      <AccordionContent className="font-sans text-sm leading-relaxed text-muted-foreground pb-5">
        {t(item.a)}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

## CTA (Final Call-to-Action)

Gradient background with animated mesh, product images fanned out, dual CTA buttons.

Key pattern:
- Background layers: `bg-gradient-to-br from-primary/10 via-background to-accent/10` + `animated-mesh opacity-50`
- Product images: 3 items with rotation `i === 0 ? -6 : i === 2 ? 6 : 0`
- `whileHover={{ rotate: 0, scale: 1.05, zIndex: 10 }}` straightens on hover
- Two CTA buttons: primary (filled, with ArrowRight icon) + secondary (outlined)

---

## Footer

Simple footer with brand, links, copyright.

```tsx
<footer className="border-t border-border py-12">
  <div className="mx-auto max-w-6xl px-6">
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
      <span className="font-display text-lg font-bold text-foreground">{{BUSINESS_NAME}}</span>
      <div className="flex gap-6">
        {/* Links: Contact, Privacy, Terms */}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        &copy; {new Date().getFullYear()} {{BUSINESS_NAME}}. All rights reserved.
      </p>
    </div>
  </div>
</footer>
```
