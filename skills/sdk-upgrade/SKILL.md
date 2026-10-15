---
name: sdk-upgrade
description: Guide for upgrading Sentry SDK versions in projects reporting to BugSink. Use when the user wants to upgrade @sentry/node, @sentry/nextjs, or sentry-sdk.
---

# BugSink: Upgrade Sentry SDK

Guide for upgrading Sentry SDK versions in your project. Since BugSink uses Sentry-compatible SDKs, SDK upgrades follow Sentry's migration guides.

## Workflow

### Step 1: Identify Current Version

Check what SDK version is currently installed:

```bash
# JavaScript/Node.js
npm ls @sentry/node @sentry/nextjs @sentry/react @sentry/browser

# Python
pip show sentry-sdk
```

### Step 2: Check for Breaking Changes

Major version upgrades may have breaking changes. Key migration paths:

#### JavaScript SDK v7 → v8

Major breaking changes:
- `@sentry/tracing` removed — use `@sentry/node` or `@sentry/browser` directly
- `Sentry.startTransaction()` removed — use `Sentry.startSpan()` instead
- `Hub` class removed — use top-level `Sentry.*` methods
- `new Sentry.BrowserTracing()` → `Sentry.browserTracingIntegration()`
- Express: `Sentry.Handlers.requestHandler()` → `Sentry.setupExpressErrorHandler()`
- Minimum Node.js version: 14.18+

```bash
# Upgrade
npm install @sentry/node@latest
# or
npm install @sentry/nextjs@latest
```

#### JavaScript SDK v8 → v9 (latest)

- `Sentry.metrics.*` removed
- Several deprecated integrations removed
- Check https://docs.sentry.io/platforms/javascript/migration/ for full list

#### Python SDK v1 → v2

- `sentry_sdk.init()` API mostly unchanged
- Some integrations renamed or removed
- `before_send` callback signature changes

### Step 3: Update Package

```bash
# Update to latest
npm install @sentry/node@latest

# Or pin to specific version
npm install @sentry/node@8
```

### Step 4: Update Configuration

After upgrading, update your Sentry configuration files:

1. Check `sentry.client.config.ts` / `sentry.server.config.ts`
2. Replace deprecated API calls
3. Update integration configuration
4. Verify `next.config.js` `withSentryConfig` options (for Next.js)

### Step 5: Update sentry-cli

If you use `sentry-cli` for source maps:

```bash
# v3.0+ required for modern source map upload
npm install -g @sentry/cli@latest

# Verify
sentry-cli --version
```

Source map upload command changed in v3.0:
```bash
# Old (v2)
sentry-cli releases files <release> upload-sourcemaps ./dist

# New (v3)
sentry-cli sourcemaps upload --release <release> ./dist
```

### Step 6: Verify

1. Build the project — ensure no compilation errors
2. Run tests — check for broken Sentry mocks or integrations
3. Deploy to staging and trigger a test error
4. Verify the error appears in BugSink with correct source maps

## Common Issues After Upgrade

| Issue | Cause | Fix |
|-------|-------|-----|
| `Sentry.startTransaction is not a function` | v7→v8 breaking change | Use `Sentry.startSpan()` |
| `Cannot find module @sentry/tracing` | Removed in v8 | Remove import, use core SDK |
| Source maps not working | sentry-cli version mismatch | Upgrade to sentry-cli v3+ |
| `Hub is not a constructor` | Removed in v8 | Use `Sentry.*` directly |
| Express errors not captured | Handler API changed | Use `Sentry.setupExpressErrorHandler()` |

## BugSink Compatibility

BugSink supports the standard Sentry event format. When upgrading SDKs, the main concern is client-side compatibility — BugSink will accept events from any Sentry SDK version that uses the standard envelope/store API.
