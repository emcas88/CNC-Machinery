# CNC-Machinery E2E Tests

End-to-end test suite for the CNC Cabinet Manufacturing application using [Playwright](https://playwright.dev/).

## Overview

- **425 tests** across **21 spec files**
- Covers **90%+ of frontend use cases**
- Fully hermetic — all API calls are mocked (no backend required)
- Runs on Chromium and Firefox

## Test Coverage

| Module | Tests | Flows Covered |
|--------|-------|---------------|
| Authentication | 34 | Login, register, validation, logout, route protection, persistence |
| Dashboard | 26 | Page load, stats, sidebar nav, header, responsive layout |
| Navigation | 21 | Protected routes, catch-all, page-to-page navigation, back/forward |
| Jobs | 10 | CRUD, search, filter, status display, empty/loading/error states |
| Rooms | 7 | CRUD, canvas rendering, dimensions, properties panel |
| Products | 10 | Editor, face sections, dimensions, library types, API interactions |
| Parts | 10 | Editor, properties, dimensions, grain direction, edge banding |
| Materials | 12 | CRUD, category filter, cost, dimensions, stock badge |
| Machines | 12 | CRUD, workspace dimensions, spindle/ATC, machine types |
| Tools | 11 | CRUD, type filter, diameter/cutting length, coating |
| Hardware | 12 | CRUD, type/brand filters, card grid, drilling pattern |
| Settings | 14 | Unit system, defaults, appearance, company info, save/reset |
| Construction Methods | 15 | CRUD, joint types, method configuration |
| G-Code | 21 | Generation, viewer, download, toolpath, post-processor selection |
| Optimizer | 23 | Run optimization, results, utilization, parameters |
| Quotes | 28 | CRUD, status workflow, PDF generation, totals, line items |
| Labels | 26 | Templates, fields, print preview, batch print |
| Export | 31 | Formats (CSV/PDF/DXF), cut list, BOM, G-code, batch export |
| Cut List & BOM | 30 | Display, sorting, filtering, totals, export |
| Shop Floor | 47 | Dashboard, assembly, CNC operator, remake bin, task assignment |
| Post-Processors | 25 | CRUD, machine association, template preview |

## Quick Start

```bash
# Install dependencies
cd e2e
npm install
npx playwright install

# Run all tests
npm test

# Run with browser UI
npm run test:headed

# Run Playwright UI mode (interactive)
npm run test:ui

# Debug a specific test
npm run test:debug

# View HTML report
npm run report
```

## Architecture

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── tests/
    ├── fixtures/
    │   ├── test-fixtures.ts  # Custom fixtures (auth, mockApi, authenticatedPage)
    │   └── mock-data.ts      # Mock data factories for all entity types
    ├── auth.spec.ts          # Authentication flows
    ├── dashboard.spec.ts     # Dashboard and layout
    ├── navigation.spec.ts    # Route protection and navigation
    ├── jobs.spec.ts          # Job management
    ├── rooms.spec.ts         # Room designer
    ├── products.spec.ts      # Product editor
    ├── parts.spec.ts         # Part editor
    ├── materials.spec.ts     # Materials management
    ├── machines.spec.ts      # Machine configuration
    ├── tools.spec.ts         # Tool library
    ├── hardware.spec.ts      # Hardware library
    ├── settings.spec.ts      # Application settings
    ├── construction-methods.spec.ts  # Construction methods
    ├── gcode.spec.ts         # G-code viewer/generator
    ├── optimizer.spec.ts     # Sheet optimizer
    ├── quotes.spec.ts        # Quote generator
    ├── labels.spec.ts        # Label designer
    ├── export.spec.ts        # Export center
    ├── cutlist-bom.spec.ts   # Cut lists and BOM
    ├── shop-floor.spec.ts    # Shop floor views
    └── post-processors.spec.ts  # Post-processor config
```

## Custom Fixtures

### `authenticatedPage`
Pre-configured page with auth tokens injected into localStorage and baseline API mocks.

### `mockApi`
Helper to mock any API endpoint:
```typescript
test('example', async ({ page, mockApi }) => {
  await mockApi.mock('GET', '/api/jobs', [{ id: '1', name: 'Kitchen Job' }]);
  await page.goto('/jobs');
});
```

### `testUser` / `authTokens`
Default test credentials and JWT tokens for authenticated tests.

## CI/CD

E2E tests run automatically on PRs that touch `frontend/` or `e2e/` directories via GitHub Actions (`.github/workflows/e2e.yml`).
