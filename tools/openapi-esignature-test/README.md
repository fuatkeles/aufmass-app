# OpenAPI eSignature Sandbox Test Harness

Test script to measure WAIT_VALIDATION duration and verify callback/polling behavior for OpenAPI eSignature service.

## Purpose

- Measure how long signatures stay in WAIT_VALIDATION state
- Compare callback vs polling detection times
- Generate reports suitable for OpenAPI support tickets

## Quick Start

From the project root:

```bash
# Single test run
pnpm openapi:test

# Multiple runs with statistics (3 runs)
pnpm openapi:test:multi
```

Or from this directory:

```bash
npm install
npm start            # Single run
npm test             # 3 runs with statistics
npx tsx run.ts --runs=5  # Custom number of runs
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| OPENAPI_TOKEN | Sandbox authentication token | Pre-configured |
| OPENAPI_API_KEY | API key for requests | Pre-configured |
| SIGNER_EMAIL | Email for test signer | fkeles@conais.com |
| OPENAPI_DOMAIN | Sandbox API domain | test.esignature.openapi.com |
| CERT_USERNAME | Certificate username | openapiSandboxUsername |
| CERT_PASSWORD | Certificate password | openapiSandboxPassword |
| CALLBACK_PUBLIC_URL | Your server's callback endpoint | https://aufmass-api.conais.com/api/openapi/esignature/callback |
| PDF_PATH | Custom PDF for testing (optional) | Uses built-in sample |
| SIGNATURE_TYPE | EU-QES_automatic or EU-SES | EU-QES_automatic |
| NUM_RUNS | Default number of test runs | 1 |
| POLL_INTERVAL_MS | Polling interval in ms | 5000 |

## Callback Setup

The test harness expects your server to have these endpoints:

- `POST /api/openapi/esignature/callback` - Receives OpenAPI callbacks
- `GET /api/openapi/esignature/callback-log` - Returns callback logs for analysis

These endpoints are already added to `server/index.js`.

## Output

### Reports (reports/)

Each test run generates a markdown report:
- `{signatureId}.md` - Individual test report
- `statistics-{timestamp}.md` - Aggregate statistics (multi-run only)

### Artifacts (artifacts/)

For successful signatures:
- `{signatureId}.pdf` - Signed document
- `{signatureId}-validated.pdf` - Validated document
- `{signatureId}-audit.json` - Audit trail

### Logs (logs/)

- `{signatureId}-poll.json` - Complete polling history

## Sample Report Output

```markdown
# OpenAPI eSignature Test Report

**Signature ID:** `abc123`
**Test Date:** 2024-01-15T10:30:00.000Z

## Summary

| Metric | Value |
|--------|-------|
| Final State | `DONE` |
| Total Duration | 12m 34s (754000ms) |
| WAIT_VALIDATION Duration | 10m 5s (605000ms) |
| Callback Received | Yes |
| Callback Duration | 10m 3s (603000ms) |
```

## State Flow

Expected signature states:
1. `WAIT_VALIDATION` - Document being validated (may take ~10 minutes in sandbox)
2. `WAIT_SIGN` - Waiting for signer action
3. `DONE` - Successfully signed
4. `ERROR` - Failed with error

## Notes

- Sandbox environment may have different timing than production
- Callback requires publicly accessible URL
- Each test creates a real signature request in sandbox
