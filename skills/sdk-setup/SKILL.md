---
name: sdk-setup
description: General guide for setting up Sentry-compatible SDKs to report to BugSink. Use when the user wants to add error tracking or configure a Sentry SDK to point at BugSink.
---

# BugSink: SDK Setup Guide

BugSink is compatible with Sentry SDKs. This guide covers general SDK configuration for reporting errors to a BugSink instance.

## Prerequisites

- A running BugSink instance (self-hosted)
- A project created in BugSink
- The project's DSN (Data Source Name)

## Getting Your DSN

The DSN is available in your BugSink project settings. It follows the format:

```
https://<public_key>@<bugsink-host>/<project-id>
```

For example: `https://abc123@bug.example.com/1`

## General SDK Configuration

All Sentry SDKs accept a `dsn` parameter that points to your BugSink instance instead of Sentry's servers.

### Key Configuration Options

```javascript
Sentry.init({
  // Point to your BugSink instance (not sentry.io)
  dsn: "https://<key>@<your-bugsink-host>/<project-id>",

  // Tag events with environment
  environment: process.env.NODE_ENV || "development",

  // Tag events with release version for tracking
  release: "my-app@1.0.0",

  // Sample rate for performance (1.0 = 100%)
  tracesSampleRate: 1.0,
});
```

### Environment Tagging

Always set the `environment` so you can filter errors by deployment:
- `development` — local dev
- `staging` — pre-production
- `production` — live

### Release Tagging

Set `release` to match your deployment version. This enables:
- Filtering issues by release
- Tracking regressions across versions
- Source map association

## Source Maps

For JavaScript/TypeScript projects, upload source maps so BugSink can display original source code in stacktraces:

```bash
# Install sentry-cli (v3.0+ required for sourcemap upload)
npm install -g @sentry/cli

# Upload source maps
sentry-cli sourcemaps upload \
  --url https://your-bugsink-host \
  --auth-token YOUR_TOKEN \
  --org your-org \
  --project your-project \
  ./dist
```

## Common Gotchas

1. **DSN host must match BugSink URL** — The DSN host must be reachable from your application
2. **HTTPS certificates** — If self-signed, you may need to configure the SDK to accept them
3. **Sentry SDK version** — BugSink supports the standard Sentry event format. Use recent stable SDK versions.
4. **Rate limiting** — BugSink has its own rate limiting. Check your instance settings.
5. **CORS** — For browser SDKs, ensure BugSink allows requests from your domain

## Framework-Specific Guides

For framework-specific setup, use:
- **Next.js** → `/bugsink:nextjs-sdk`
- **Node.js / Express** → `/bugsink:nodejs-sdk`
