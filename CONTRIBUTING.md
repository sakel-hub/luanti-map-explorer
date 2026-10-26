# Contributing to Luanti Map & Biome Explorer

Thank you for your interest in contributing to **Luanti Map & Biome Explorer**! We welcome contributions of all kinds, including bug reports, feature requests, code enhancements, documentation improvements, and **translations**.

---

## 📑 Table of Contents
- [Code of Conduct](#-code-of-conduct)
- [Development Setup](#-development-setup)
- [Contributing Translations](#-contributing-translations)
  - [Overview of the i18n Architecture](#overview-of-the-i18n-architecture)
  - [Option 1: Improving Existing Translations](#option-1-improving-existing-translations)
  - [Option 2: Adding a New Language](#option-2-adding-a-new-language)
  - [Option 3: Contributing Without Coding (GitHub Issues)](#option-3-contributing-without-coding-github-issues)
- [Testing & Validation](#-testing--validation)
- [Submitting a Pull Request](#-submitting-a-pull-request)

---

## 🤝 Code of Conduct
Please be polite, constructive, and respectful to fellow contributors and maintainers. We aim to keep this community open and welcoming to everyone.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `>= 24.16.0` (LTS recommended)
- **npm**: `>= 11.0.0`
- **Git**

### Installation
```bash
# 1. Clone your fork or the repository
git clone https://github.com/sakel-hub/luanti-map-explorer.git
cd luanti-map-explorer

# 2. Install dependencies
npm ci

# 3. Generate sample world data
npm run generate:sample-world

# 4. Start the local development server
npm start
```
The application will be accessible at `http://localhost:4200/`.

---

## 🌍 Contributing Translations

Luanti Map Explorer supports multi-language localization. Translations reside in `src/app/core/i18n/locales/`.

### Structure
- `src/app/core/i18n/translation.types.ts`: TypeScript schema defining all required keys and interfaces.
- `src/app/core/i18n/locales/en.ts`: English source dictionary (canonical source of truth).
- `src/app/core/i18n/locales/sk.ts`: Slovak translation.
- `src/app/core/i18n/locales/de.ts`: German translation.
- `src/app/core/i18n/locales/fr.ts`: French translation.
- `src/app/core/i18n/locales/es.ts`: Spanish translation.
- `src/app/core/i18n/locales/ru.ts`: Russian translation.

### Option 1: Improving Existing Translations
1. Open the relevant file in `src/app/core/i18n/locales/<lang>.ts`.
2. Update the text strings while preserving placeholder tokens like `{count}` or `{unit}`.
3. Test locally using the Language Switcher in the top header.
4. Run `npm run test` and `npx tsc --noEmit` to verify type safety.

### Option 2: Adding a New Language
1. Add the new language code (e.g. `'it'`) to the `SupportedLanguage` type in `translation.types.ts`.
2. Create `src/app/core/i18n/locales/<lang>.ts` implementing `TranslationSchema`.
3. Register the new dictionary in `src/app/core/i18n/translation.service.ts`.
4. Add hreflang links to `src/index.html` and `public/sitemap.xml`.

### Option 3: Contributing via GitHub Issues
Don't want to edit TypeScript code? Submit a translation directly using our [Translation Issue Template](https://github.com/sakel-hub/luanti-map-explorer/issues/new?template=translation.yml).

---

## 🧪 Testing & Validation

Before submitting any code changes, please ensure all automated tests pass:

```bash
# 1. Run unit test suite (Vitest)
npm run test

# 2. Verify strict TypeScript compilation
npx tsc --noEmit

# 3. Test production build
npm run build
```

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Follow Conventional Commits:
   - `feat(...)`: New features
   - `fix(...)`: Bug fixes
   - `docs(...)`: Documentation updates
   - `refactor(...)`: Code refactoring without behavior change
   - `test(...)`: Adding or updating tests
3. Push to your fork and submit a Pull Request to `sakel-hub/luanti-map-explorer:main`.
