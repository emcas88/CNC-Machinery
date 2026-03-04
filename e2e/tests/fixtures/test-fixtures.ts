import { test as base, expect, Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'super_admin' | 'designer' | 'cnc_operator' | 'shop_floor';
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export type RouteHandler = (route: Route) => Promise<void> | void;

export interface MockApiFixture {
  /**
   * Mock a specific API endpoint.
   * @param method  HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param path    URL path to intercept, e.g. '/api/jobs'
   * @param body    Response body (will be JSON-serialised)
   * @param status  HTTP status code (default 200)
   */
  mock(
    method: string,
    path: string,
    body: unknown,
    status?: number,
  ): Promise<void>;

  /**
   * Intercept a route with a custom handler.
   */
  intercept(urlPattern: string | RegExp, handler: RouteHandler): Promise<void>;
}

// ---------------------------------------------------------------------------
// Fixture definitions
// ---------------------------------------------------------------------------

type CustomFixtures = {
  testUser: TestUser;
  authTokens: AuthTokens;
  mockApi: MockApiFixture;
  authenticatedPage: Page;
};

// ---------------------------------------------------------------------------
// Default test credentials
// ---------------------------------------------------------------------------

const DEFAULT_USER: TestUser = {
  id: 'user-test-001',
  email: 'test@cnc-cabinet.local',
  password: 'Password123!',
  first_name: 'Test',
  last_name: 'User',
  role: 'super_admin',
};

const DEFAULT_TOKENS: AuthTokens = {
  access_token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiJ1c2VyLXRlc3QtMDAxIiwiZW1haWwiOiJ0ZXN0QGNuYy1jYWJpbmV0LmxvY2FsIiwicm9sZSI6InN1cGVyX2FkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ' +
    '.FAKE_SIGNATURE_FOR_TESTING',
  refresh_token: 'refresh-token-test-001-fake',
};

// ---------------------------------------------------------------------------
// Helper: inject auth tokens into page localStorage before navigation
// ---------------------------------------------------------------------------

async function injectAuthTokens(page: Page, tokens: AuthTokens): Promise<void> {
  await page.addInitScript((t) => {
    window.localStorage.setItem('access_token', t.access_token);
    window.localStorage.setItem('refresh_token', t.refresh_token);
  }, tokens);
}

// ---------------------------------------------------------------------------
// Helper: build a URL-matching RegExp from a path string
// ---------------------------------------------------------------------------

function makeUrlMatcher(path: string): RegExp {
  // Escape special regex chars, but keep * as wildcard
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped + '(\\?.*)?$');
}

// ---------------------------------------------------------------------------
// Extended test object
// ---------------------------------------------------------------------------

export const test = base.extend<CustomFixtures>({
  // -------------------------------------------------------------------------
  // testUser – default test credentials
  // -------------------------------------------------------------------------
  testUser: async ({}, use) => {
    await use(DEFAULT_USER);
  },

  // -------------------------------------------------------------------------
  // authTokens – default JWT tokens
  // -------------------------------------------------------------------------
  authTokens: async ({}, use) => {
    await use(DEFAULT_TOKENS);
  },

  // -------------------------------------------------------------------------
  // mockApi – intercept and fulfil API routes
  // -------------------------------------------------------------------------
  mockApi: async ({ page }, use) => {
    const fixture: MockApiFixture = {
      async mock(method, path, body, status = 200) {
        const pattern = makeUrlMatcher(path);
        await page.route(pattern, (route) => {
          const req = route.request();
          if (req.method().toUpperCase() !== method.toUpperCase()) {
            return route.continue();
          }
          return route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        });
      },

      async intercept(urlPattern, handler) {
        await page.route(urlPattern, handler);
      },
    };

    await use(fixture);
  },

  // -------------------------------------------------------------------------
  // authenticatedPage – page pre-loaded with auth tokens + baseline API mocks
  // -------------------------------------------------------------------------
  authenticatedPage: async ({ page, testUser, authTokens }, use) => {
    // Inject tokens before any page navigation
    await injectAuthTokens(page, authTokens);

    // Mock POST /api/auth/login
    await page.route(/\/api\/auth\/login(\?.*)?$/, async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      const body = req.postDataJSON() as { email?: string; password?: string };
      if (body?.email === testUser.email && body?.password === testUser.password) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(authTokens),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid email or password' }),
        });
      }
    });

    // Mock POST /api/auth/register
    await page.route(/\/api\/auth\/register(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authTokens),
      });
    });

    // Mock GET /api/users/me
    await page.route(/\/api\/users\/me(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testUser.id,
          email: testUser.email,
          first_name: testUser.first_name,
          last_name: testUser.last_name,
          role: testUser.role,
        }),
      });
    });

    // Mock common list endpoints to return empty arrays
    const emptyListEndpoints = [
      /\/api\/jobs(\?.*)?$/,
      /\/api\/products(\?.*)?$/,
      /\/api\/parts(\?.*)?$/,
      /\/api\/materials(\?.*)?$/,
      /\/api\/machines(\?.*)?$/,
      /\/api\/tools(\?.*)?$/,
      /\/api\/hardware(\?.*)?$/,
      /\/api\/quotes(\?.*)?$/,
      /\/api\/labels(\?.*)?$/,
      /\/api\/post-processors(\?.*)?$/,
      /\/api\/construction-methods(\?.*)?$/,
    ];

    for (const pattern of emptyListEndpoints) {
      await page.route(pattern, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
    }

    await use(page);
  },
});

export { expect };
