---
name: nextjs-sdk
description: Set up BugSink error tracking in a Next.js application using @sentry/nextjs. Use when the user wants to add error tracking to a Next.js project.
---

# BugSink: Next.js SDK Setup

Set up error tracking in a Next.js application using `@sentry/nextjs`, configured to report to your BugSink instance.

## Step 1: Install the SDK

```bash
npm install @sentry/nextjs
```

## Step 2: Run the Sentry Wizard (Optional)

The wizard scaffolds config files automatically:

```bash
npx @sentry/wizard@latest -i nextjs --saas-url https://your-bugsink-host
```

If the wizard doesn't work with BugSink, create the files manually below.

## Step 3: Create Configuration Files

### `sentry.client.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
  tracesSampleRate: 1.0,
});
```

### `sentry.server.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
  tracesSampleRate: 1.0,
});
```

### `sentry.edge.config.ts`

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
  tracesSampleRate: 1.0,
});
```

### `instrumentation.ts` (App Router)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

## Step 4: Configure `next.config.js`

```javascript
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  // your existing config
};

export default withSentryConfig(nextConfig, {
  // Upload source maps to BugSink
  org: "your-org",
  project: "your-project",
  sentryUrl: "https://your-bugsink-host",

  // Suppress source map upload warnings in dev
  silent: !process.env.CI,

  // Hide source maps from users
  hideSourceMaps: true,
});
```

## Step 5: Environment Variables

Add to your `.env.local`:

```bash
# Client-side DSN (public)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<your-bugsink-host>/<project-id>

# Server-side DSN
SENTRY_DSN=https://<key>@<your-bugsink-host>/<project-id>

# Auth token for source map uploads
SENTRY_AUTH_TOKEN=your-bugsink-token

# Release version
NEXT_PUBLIC_RELEASE_VERSION=1.0.0
```

## Step 6: Error Boundary (App Router)

Create `app/global-error.tsx`:

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

## App Router vs Pages Router

| Feature | App Router | Pages Router |
|---------|-----------|--------------|
| Server init | `instrumentation.ts` | `sentry.server.config.ts` imported in `_app.tsx` |
| Client init | `sentry.client.config.ts` | `sentry.client.config.ts` |
| Error boundary | `app/global-error.tsx` | `pages/_error.tsx` |
| API routes | Route handlers catch automatically | Wrap with `withSentry` |

## Verification

After setup, trigger a test error:

```typescript
// In any component or API route
throw new Error("BugSink test error");
```

Then check your BugSink instance — the error should appear within seconds.
