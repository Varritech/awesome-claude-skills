# Contributing to ConvergeFlow

## Local Development Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd convergeflow
npm install

# 2. Start dev server
npm run dev

# 3. Run tests to verify setup
npm test
```

The dev server runs at `http://localhost:3000`.

## Branch Naming

Use the following prefixes:

- `feature/*` -- New functionality (e.g., `feature/email-template-picker`)
- `fix/*` -- Bug fixes (e.g., `fix/sidebar-active-state`)
- `chore/*` -- Tooling, config, refactoring (e.g., `chore/upgrade-next-15`)

Always branch from `main`.

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types**: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`, `ci`

**Examples**:

```
feat(emails): add email detail page with metrics
fix(sidebar): correct active state for nested routes
chore(deps): upgrade Playwright to 1.59
test(ui): add Button component tests
```

Keep the subject line under 72 characters. Use the body for context when the change is not self-explanatory.

## Pull Request Process

1. **Create a branch** from `main` with the correct prefix.
2. **Make your changes.** Keep PRs focused -- one feature or fix per PR.
3. **Run the quality pipeline** before pushing:
   ```bash
   npm run quality
   ```
   This runs lint, format check, unit tests, and E2E tests.
4. **Push and open a PR** against `main`. Fill in the PR template.
5. **Attach screenshots** for any UI changes (desktop and mobile viewports).
6. **Wait for CI** to pass (lint, tests, build, E2E).
7. **Request review** and address feedback.

## Code Style

### TypeScript

- **Strict mode is on.** No `any` types unless absolutely necessary.
- `noUnusedLocals` and `noUnusedParameters` are enforced.
- Use the `@/*` path alias for imports from `src/` (e.g., `import { Button } from "@/components/ui"`).

### ESLint + Prettier

- ESLint extends `next/core-web-vitals` and `prettier`.
- Prettier config: double quotes, semicolons, 100-char print width, trailing commas.
- Run `npm run lint:fix` and `npm run format` before committing.
- `no-console` is a warning -- remove `console.log` before opening a PR.

### Formatting Quick Reference

```
Semi:            yes
Quotes:          double
Tab width:       2
Trailing commas: es5
Print width:     100
Arrow parens:    always
```

## Testing Requirements

### Unit Tests (Vitest)

- All new UI components in `src/components/` need tests.
- Test files live next to the component: `Button.tsx` -> `Button.test.tsx`.
- Use `@testing-library/react` for rendering and assertions.
- Use `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument()`).
- Run with `npm test` or `npm run test:watch` during development.

### E2E Tests (Playwright)

- E2E tests live in the `e2e/` directory.
- Tests run against Chromium (desktop) and Pixel 5 (mobile).
- The dev server starts automatically during test runs.
- Run with `npm run test:e2e` or `npm run test:e2e:ui` for the interactive runner.

### Coverage

- Run `npm run test:coverage` to generate a coverage report.
- Coverage is collected for `src/components/` and `src/lib/`.
- Coverage reports are uploaded as CI artifacts on every PR.

## Design System

### Follow Cuberto Style

The UI follows the Cuberto design language: dark theme, no visible borders (surfaces differentiate via background stepping), generous radius values, and restrained color use.

### Use Existing Components

Before building new UI, check `src/components/ui/` for existing primitives:

- `Button` -- Primary, secondary, ghost variants
- `Card`, `MetricCard`, `ActionCard` -- Surface containers
- `Badge`, `CountBadge` -- Labels and counters
- `Input` -- Text input
- `Select` -- Dropdown select
- `Toggle` -- Switch toggle
- `Avatar`, `MenuDot` -- User indicators

Import from the barrel export: `import { Button, Card } from "@/components/ui"`.

### Colors and Tokens

Use Tailwind tokens prefixed with `cf-` (e.g., `bg-cf-card`, `text-cf-orange`). These map to CSS custom properties defined in `src/app/globals.css`. Do not hardcode hex values.

### Typography

Use the font utilities:

- `font-heading` -- Archivo (headings, bold labels)
- `font-body` -- Chivo (body text, default)
- `font-mono` -- JetBrains Mono (stats, metrics)

## Review Checklist

Before approving a PR, verify:

- [ ] All tests pass (`npm test` and `npm run test:e2e`)
- [ ] Lint is clean (`npm run lint`)
- [ ] No `console.log` statements in production code
- [ ] Accessibility: keyboard navigation, screen reader, color contrast
- [ ] Screenshots attached for UI changes
- [ ] Responsive behavior verified (mobile and desktop)
- [ ] New components have unit tests
- [ ] Tailwind tokens used instead of hardcoded values
- [ ] Imports use the `@/*` path alias
