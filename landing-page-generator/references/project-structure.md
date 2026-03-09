# Project Structure

## File Tree

Every generated landing page follows this structure:

```
{project-name}/
├── public/
│   └── images/           # User-uploaded assets (logos, product images)
├── src/
│   ├── app/
│   │   ├── globals.css   # Tailwind v4 + design tokens + effect classes
│   │   ├── layout.tsx    # Root layout with fonts, providers
│   │   ├── page.tsx      # Main page composing all sections
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/           # shadcn components (accordion, button, card)
│   │   ├── sections/     # One file per page section
│   │   │   ├── navbar.tsx
│   │   │   ├── hero.tsx
│   │   │   ├── showcase.tsx
│   │   │   ├── about.tsx
│   │   │   ├── testimonials.tsx
│   │   │   ├── details.tsx
│   │   │   ├── faq.tsx
│   │   │   ├── cta.tsx
│   │   │   └── footer.tsx
│   │   ├── language-provider.tsx
│   │   └── smooth-scrolling.tsx
│   ├── lib/
│   │   ├── translations.ts
│   │   └── utils.ts
│   └── hooks/            # Custom hooks if needed
├── package.json
├── components.json       # shadcn config
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── eslint.config.mjs
```

## Configuration Files

### package.json

```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@base-ui/react": "^1.2.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lenis": "^1.3.18",
    "lucide-react": "^0.577.0",
    "motion": "^12.35.1",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "shadcn": "^4.0.2",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### components.json (shadcn v4 base-nova)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### next.config.ts

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

### postcss.config.mjs

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

## Setup Commands

After generating all files:

```bash
npm install
npx shadcn@latest add accordion button card
npm run build  # Verify it compiles
```

## layout.tsx Template

```tsx
import type { Metadata } from "next";
import { {{DISPLAY_FONT_IMPORT}}, {{BODY_FONT_IMPORT}}, {{MONO_FONT_IMPORT}} } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import SmoothScrolling from "@/components/smooth-scrolling";

const displayFont = {{DISPLAY_FONT_IMPORT}}({
  variable: "--font-display",
  subsets: ["latin"],
  weight: {{DISPLAY_WEIGHTS}},
  display: "swap",
});

const bodyFont = {{BODY_FONT_IMPORT}}({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: {{BODY_WEIGHTS}},
  display: "swap",
});

const monoFont = {{MONO_FONT_IMPORT}}({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "{{BUSINESS_NAME}}",
  description: "{{META_DESCRIPTION}}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="{{PRIMARY_LANGUAGE}}">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}>
        <LanguageProvider>
          <SmoothScrolling>{children}</SmoothScrolling>
        </LanguageProvider>
      </body>
    </html>
  );
}
```

## page.tsx Template

```tsx
import Navbar from "@/components/sections/navbar";
import Hero from "@/components/sections/hero";
// ... import each section that was selected
import Footer from "@/components/sections/footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      {/* Include only selected sections in order */}
      <Footer />
    </main>
  );
}
```
