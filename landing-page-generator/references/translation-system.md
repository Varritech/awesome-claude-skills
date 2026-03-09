# Translation System

## Language Provider Component

Copy this file verbatim to `src/components/language-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Language } from "@/lib/translations";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (obj: Record<Language, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("{{PRIMARY_LANGUAGE}}");

  const t = (obj: Record<Language, string>) => obj[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
```

Replace `{{PRIMARY_LANGUAGE}}` with the user's primary language code (e.g., `"en"`).

## Translations File Structure

Create `src/lib/translations.ts`:

```typescript
export type Language = "en" | "es"; // Union of all supported language codes

export const translations = {
  nav: {
    // Navigation items — one per nav link
    features: { en: "Features", es: "Características" },
    about: { en: "About", es: "Acerca de" },
    reviews: { en: "Reviews", es: "Reseñas" },
    faq: { en: "FAQ", es: "Preguntas" },
    buy: { en: "Get Started", es: "Comenzar" },
  },
  hero: {
    tagline: { en: "Business Name", es: "Nombre del Negocio" },
    heading: { en: "Main headline goes here", es: "Título principal aquí" },
    subheading: { en: "Supporting text", es: "Texto de apoyo" },
    cta: { en: "Learn More", es: "Saber Más" },
    scroll: { en: "Scroll down", es: "Desplazar hacia abajo" },
  },
  // Continue for each section: showcase, about, testimonials, details, faq, cta, footer
};
```

## Usage in Components

```tsx
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/translations";

export default function MySection() {
  const { t } = useLanguage();
  return <h1>{t(translations.hero.heading)}</h1>;
}
```

## Key Rules

1. **Every** visible string goes through `t()` — no hardcoded text in JSX
2. The `Language` type must include all supported languages
3. Default language in `useState` should be the user's primary language
4. For arrays (testimonials, FAQ items, etc.), each item's text fields must be `Record<Language, string>`
5. Non-translated content (names, numbers) can be plain strings outside the `Record` pattern
