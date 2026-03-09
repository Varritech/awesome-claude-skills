# Design System — Aesthetic Presets

Each preset provides a complete `:root` CSS custom property block, font configuration, and effect class customizations. Replace the `:root` block in `globals.css` with the selected preset.

---

## 1. Luxury Editorial

Warm, feminine, serif-driven. Rose and mauve accents on cream.

**Fonts:** Playfair Display (display, 700/900) + DM Sans (body, 400/500/600) + DM Mono (mono, 400)

```css
:root {
  --background: #faf5f0;
  --foreground: #2c2018;
  --card: #ffffff;
  --card-foreground: #2c2018;
  --popover: #ffffff;
  --popover-foreground: #2c2018;
  --primary: #b54e6f;
  --primary-foreground: #faf5f0;
  --secondary: #f3ede5;
  --secondary-foreground: #2c2018;
  --muted: #f3ede5;
  --muted-foreground: #7a6e62;
  --accent: #8b6b7a;
  --accent-foreground: #faf5f0;
  --destructive: #dc2626;
  --border: rgba(44, 32, 24, 0.1);
  --input: rgba(44, 32, 24, 0.1);
  --ring: #b54e6f;
  --radius: 0.75rem;
}
```

**Gradient:** `linear-gradient(135deg, #b54e6f 0%, #8b6b7a 50%, #c77d8a 100%)`
**Animated mesh:** Warm rose/cream radial gradients
**Glass panel:** `rgba(255, 255, 255, 0.7)` with blur(16px)

---

## 2. Dark Minimal

Tech-forward, monospace accents. Indigo and violet on near-black.

**Fonts:** Space Grotesk (display, 500/700) + DM Sans (body, 400/500) + JetBrains Mono (mono, 400)

```css
:root {
  --background: #0a0a0a;
  --foreground: #e5e5e5;
  --card: #141414;
  --card-foreground: #e5e5e5;
  --popover: #141414;
  --popover-foreground: #e5e5e5;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #1a1a2e;
  --secondary-foreground: #e5e5e5;
  --muted: #1a1a2e;
  --muted-foreground: #737373;
  --accent: #8b5cf6;
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.08);
  --ring: #6366f1;
  --radius: 0.5rem;
}
```

**Gradient:** `linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)`
**Animated mesh:** Deep indigo/violet radial gradients on black
**Glass panel:** `rgba(20, 20, 20, 0.8)` with blur(20px)

---

## 3. Bright Playful

Bold, rounded, energetic. Orange and pink on white.

**Fonts:** Fredoka (display, 500/700) + Nunito (body, 400/600) + Space Mono (mono, 400)

```css
:root {
  --background: #ffffff;
  --foreground: #1a1a1a;
  --card: #fefefe;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;
  --primary: #f97316;
  --primary-foreground: #ffffff;
  --secondary: #fff7ed;
  --secondary-foreground: #1a1a1a;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #ec4899;
  --accent-foreground: #ffffff;
  --destructive: #dc2626;
  --border: rgba(0, 0, 0, 0.06);
  --input: rgba(0, 0, 0, 0.06);
  --ring: #f97316;
  --radius: 1rem;
}
```

**Gradient:** `linear-gradient(135deg, #f97316 0%, #ec4899 50%, #f59e0b 100%)`
**Animated mesh:** Warm orange/pink/yellow radial gradients
**Glass panel:** `rgba(255, 255, 255, 0.85)` with blur(12px)

---

## 4. Clean Modern

Neutral, precise, professional. Blue accent on light slate.

**Fonts:** Geist (display, 500/700) + Geist (body, 400/500) + Geist Mono (mono, 400)

```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #3b82f6;
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --border: rgba(15, 23, 42, 0.08);
  --input: rgba(15, 23, 42, 0.08);
  --ring: #2563eb;
  --radius: 0.625rem;
}
```

**Gradient:** `linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)`
**Animated mesh:** Cool blue/slate radial gradients
**Glass panel:** `rgba(255, 255, 255, 0.75)` with blur(16px)

---

## 5. Retro Warm

Vintage, earthy, textured. Amber and brown on parchment.

**Fonts:** Merriweather (display, 700/900) + Source Sans 3 (body, 400/600) + IBM Plex Mono (mono, 400)

```css
:root {
  --background: #fef3c7;
  --foreground: #292524;
  --card: #fffbeb;
  --card-foreground: #292524;
  --popover: #fffbeb;
  --popover-foreground: #292524;
  --primary: #b45309;
  --primary-foreground: #fffbeb;
  --secondary: #fef9c3;
  --secondary-foreground: #292524;
  --muted: #fef9c3;
  --muted-foreground: #78716c;
  --accent: #92400e;
  --accent-foreground: #fffbeb;
  --destructive: #dc2626;
  --border: rgba(41, 37, 36, 0.12);
  --input: rgba(41, 37, 36, 0.12);
  --ring: #b45309;
  --radius: 0.5rem;
}
```

**Gradient:** `linear-gradient(135deg, #b45309 0%, #92400e 50%, #d97706 100%)`
**Animated mesh:** Warm amber/brown/gold radial gradients on parchment
**Glass panel:** `rgba(255, 251, 235, 0.7)` with blur(14px) saturate(150%)

---

## 6. Bold Maximalist

High contrast, dramatic, oversized type. Red accent on black.

**Fonts:** Bebas Neue (display, 400) + Archivo (body, 400/600) + Fira Code (mono, 400)

```css
:root {
  --background: #000000;
  --foreground: #fafafa;
  --card: #0a0a0a;
  --card-foreground: #fafafa;
  --popover: #0a0a0a;
  --popover-foreground: #fafafa;
  --primary: #ef4444;
  --primary-foreground: #ffffff;
  --secondary: #171717;
  --secondary-foreground: #fafafa;
  --muted: #171717;
  --muted-foreground: #a3a3a3;
  --accent: #f97316;
  --accent-foreground: #ffffff;
  --destructive: #dc2626;
  --border: rgba(255, 255, 255, 0.1);
  --input: rgba(255, 255, 255, 0.1);
  --ring: #ef4444;
  --radius: 0.25rem;
}
```

**Gradient:** `linear-gradient(135deg, #ef4444 0%, #f97316 50%, #ef4444 100%)`
**Animated mesh:** Deep red/orange radial gradients on black
**Glass panel:** `rgba(10, 10, 10, 0.85)` with blur(20px)

---

## Effect Class Customization

For **dark themes** (Dark Minimal, Bold Maximalist), adjust:
- `.noise-overlay::before` — increase opacity to 0.05
- `.glass-panel` — use dark rgba backgrounds (see preset notes)
- `.film-grain::after` — use `screen` blend mode instead of `multiply`

For **light themes** (Luxury Editorial, Bright Playful, Clean Modern, Retro Warm):
- `.noise-overlay::before` — opacity 0.03
- `.glass-panel` — use light rgba backgrounds
- `.film-grain::after` — use `multiply` blend mode

## Font Import Mapping

| Preset | Display Import | Body Import | Mono Import |
|--------|---------------|-------------|-------------|
| Luxury Editorial | `Playfair_Display` | `DM_Sans` | `DM_Mono` |
| Dark Minimal | `Space_Grotesk` | `DM_Sans` | `JetBrains_Mono` |
| Bright Playful | `Fredoka` | `Nunito` | `Space_Mono` |
| Clean Modern | `Geist` | `Geist` | `Geist_Mono` |
| Retro Warm | `Merriweather` | `Source_Sans_3` | `IBM_Plex_Mono` |
| Bold Maximalist | `Bebas_Neue` | `Archivo` | `Fira_Code` |
