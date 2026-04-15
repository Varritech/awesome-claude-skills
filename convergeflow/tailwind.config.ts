import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        "cf-page": "var(--bg-page)",
        "cf-card": "var(--bg-card)",
        "cf-elevated": "var(--bg-elevated)",
        "cf-subtle": "var(--bg-subtle)",
        "cf-inner": "var(--bg-card-in-card)",
        // Accents
        "cf-orange": "var(--color-orange)",
        "cf-orange-dark": "var(--color-orange-dark)",
        "cf-mint": "var(--color-mint)",
        "cf-mint-dark": "var(--color-mint-dark)",
        "cf-green": "var(--color-green)",
        "cf-red": "var(--color-red)",
        "cf-amber": "var(--color-amber)",
        "cf-indigo": "var(--color-indigo)",
        "cf-indigo-light": "var(--color-indigo-light)",
        "cf-olive": "var(--color-olive)",
        "cf-sand": "var(--color-sand)",
        "cf-absolute-black": "var(--color-absolute-black)",
        "cf-dark-gray": "var(--color-dark-gray)",
        "cf-mid-gray": "var(--color-mid-gray)",
        "cf-light-gray": "var(--color-light-gray)",
        "cf-off-white": "var(--color-off-white)",
      },
      borderRadius: {
        "cf-card": "var(--radius-card)",
        "cf-btn": "var(--radius-button)",
        "cf-inner": "var(--radius-inner)",
        "cf-badge": "var(--radius-badge)",
        "cf-icon": "var(--radius-icon)",
        "cf-pill": "var(--radius-pill)",
      },
      spacing: {
        "cf-sidebar": "var(--sidebar-width)",
        "cf-mobile-nav": "var(--mobile-nav-height)",
      },
      fontFamily: {
        heading: ["var(--font-archivo)", "Archivo", "sans-serif"],
        body: ["var(--font-chivo)", "Chivo", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
        sans: ["var(--font-chivo)", "Chivo", "sans-serif"],
      },
      transitionDuration: {
        "cf-fast": "var(--transition-fast)",
        "cf-normal": "var(--transition-normal)",
      },
      maxWidth: {
        "cf-content": "1280px",
      },
    },
  },
  plugins: [],
};
export default config;