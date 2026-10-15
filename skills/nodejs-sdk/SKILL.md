---
name: nodejs-sdk
description: Set up BugSink error tracking in a Node.js application using @sentry/node. Use when the user wants to add error tracking to a Node.js, Express, or Fastify project.
---

# BugSink: Node.js SDK Setup

Set up error tracking in a Node.js application using `@sentry/node`, configured to report to your BugSink instance. Works with Express, Fastify, Koa, and other Node.js frameworks.

## Step 1: Install the SDK

```bash
npm install @sentry/node
```

## Step 2: Initialize Sentry Early

Sentry must be initialized before any other imports. Create an `instrument.ts` (or `instrument.js`) file:

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.RELEASE_VERSION,
  tracesSampleRate: 1.0,
});
```

Then import it at the top of your entry point:

```typescript
// This must be the first import
import "./instrument";

import express from "express";
// ... rest of your app
```

## Express Setup

```typescript
import "./instrument";

import express from "express";
import * as Sentry from "@sentry/node";

const app = express();

// Your routes
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Sentry error handler — must be after all routes
Sentry.setupExpressErrorHandler(app);

// Your own error handler — after Sentry's
app.use((err, req, res, next) => {
  res.status(500).send("Something went wrong");
});

app.listen(3000);
```

## Fastify Setup

```typescript
import "./instrument";

import Fastify from "fastify";
import * as Sentry from "@sentry/node";

const app = Fastify();

Sentry.setupFastifyErrorHandler(app);

app.get("/", async (request, reply) => {
  return { hello: "world" };
});

app.listen({ port: 3000 });
```

## Manual Error Capture

For catching errors outside of request handlers:

```typescript
import * as Sentry from "@sentry/node";

try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
}

// Capture a message
Sentry.captureMessage("Something noteworthy happened");
```

## Adding Context

```typescript
import * as Sentry from "@sentry/node";

// Set user context
Sentry.setUser({
  id: user.id,
  email: user.email,
});

// Add extra context to the next error
Sentry.setExtra("orderData", { orderId: "12345", total: 99.99 });

// Add tags for filtering
Sentry.setTag("component", "payment");
```

## Async Context Tracking

Node.js v14.8+ supports `AsyncLocalStorage`, which Sentry uses automatically to maintain context across async operations. No extra configuration needed with modern Node.js versions.

For older Node.js versions or custom async patterns:

```typescript
Sentry.withScope((scope) => {
  scope.setExtra("additionalData", data);
  Sentry.captureException(error);
});
```

## Environment Variables

```bash
# DSN pointing to your BugSink instance
SENTRY_DSN=https://<key>@<your-bugsink-host>/<project-id>

# Auth token for source map uploads
SENTRY_AUTH_TOKEN=your-bugsink-token

# Release version
RELEASE_VERSION=1.0.0
```

## Source Maps for TypeScript

If using TypeScript, upload source maps for readable stacktraces:

```bash
# Build with source maps
tsc --sourceMap

# Upload to BugSink
npx @sentry/cli sourcemaps upload \
  --url https://your-bugsink-host \
  --auth-token $SENTRY_AUTH_TOKEN \
  --org your-org \
  --project your-project \
  ./dist
```

## Verification

Trigger a test error after setup:

```typescript
import * as Sentry from "@sentry/node";

setTimeout(() => {
  throw new Error("BugSink test error from Node.js");
}, 1000);
```

Check your BugSink instance — the error should appear within seconds.
