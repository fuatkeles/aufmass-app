/**
 * OpenAPI eSignature Sandbox Test Harness
 *
 * Purpose: Measure WAIT_VALIDATION duration and verify callback/polling behavior
 *
 * Usage:
 *   pnpm openapi:test           # Single run
 *   pnpm openapi:test --runs=3  # Multiple runs with statistics
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Configuration
const config = {
  token: process.env.OPENAPI_TOKEN || '6970ac597587b2a42b091184',
  apiKey: process.env.OPENAPI_API_KEY || 'wwy8ndulhusbijf68wxgtv2zkx6mrevb',
  signerEmail: process.env.SIGNER_EMAIL || 'fkeles@conais.com',
  domain: process.env.OPENAPI_DOMAIN || 'test.esignature.openapi.com',
  certUsername: process.env.CERT_USERNAME || 'openapiSandboxUsername',
  certPassword: process.env.CERT_PASSWORD || 'openapiSandboxPassword',
  callbackUrl: process.env.CALLBACK_PUBLIC_URL || '',
  pdfPath: process.env.PDF_PATH || '',
  signatureType: process.env.SIGNATURE_TYPE || 'EU-QES_automatic',
  numRuns: parseInt(process.env.NUM_RUNS || '1'),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
};

// Parse CLI args
const args = process.argv.slice(2);
const runsArg = args.find(a => a.startsWith('--runs='));
if (runsArg) {
  config.numRuns = parseInt(runsArg.split('=')[1]) || 1;
}

// Directories
const artifactsDir = path.join(__dirname, 'artifacts');
const reportsDir = path.join(__dirname, 'reports');
const logsDir = path.join(__dirname, 'logs');

// Ensure directories exist
[artifactsDir, reportsDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Sample minimal PDF (base64 encoded)
const SAMPLE_PDF_BASE64 = `JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2Jq
CjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94
IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAy
IDAgUgovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcwo8PAovRm9udCA8PC9GMSAKPDwKL1R5cGUg
L0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+Cj4+Cj4+Cj4+CmVu
ZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAw
IFRkCihPcGVuQVBJIFRlc3QpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAw
MDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAw
MDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMzU0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQov
Um9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQ4CiUlRU9G`;

// API Base URL
const API_BASE = `https://${config.domain}`;

interface SignatureState {
  timestamp: string;
  state: string;
  updatedAt: string | null;
  createdAt: string | null;
  errorNumber: number | null;
  errorMessage: string | null;
  hasDocument: boolean;
}

interface TestResult {
  signatureId: string;
  createdAt: Date;
  endedAt: Date | null;
  finalState: string;
  totalDurationMs: number;
  waitValidationDurationMs: number;
  callbackReceivedAt: Date | null;
  callbackDurationMs: number | null;
  stateHistory: SignatureState[];
  error: string | null;
}

/**
 * Log with timestamp
 */
function log(message: string, ...args: unknown[]) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`, ...args);
}

/**
 * Get PDF content as base64
 */
function getPdfBase64(): string {
  if (config.pdfPath) {
    const pdfPath = path.isAbsolute(config.pdfPath)
      ? config.pdfPath
      : path.join(__dirname, config.pdfPath);

    if (fs.existsSync(pdfPath)) {
      log(`Using PDF from: ${pdfPath}`);
      return fs.readFileSync(pdfPath).toString('base64');
    }
    log(`Warning: PDF not found at ${pdfPath}, using sample PDF`);
  }

  log('Using built-in sample PDF');
  return SAMPLE_PDF_BASE64;
}

/**
 * Create signature request
 */
async function createSignature(): Promise<{ id: string; createdAt: Date }> {
  const pdfBase64 = getPdfBase64();

  let requestBody: Record<string, unknown>;

  if (config.signatureType === 'EU-SES') {
    // SES requires signers with email authentication
    requestBody = {
      inputDocuments: [{
        sourceType: 'base64',
        payload: pdfBase64
      }],
      signers: [{
        name: 'Test',
        surname: 'User',
        email: config.signerEmail,
        authentication: ['email'],
        signatures: [{
          page: 1,
          x: '350',
          y: '700'
        }]
      }],
      options: {
        timezone: 'UTC'
      }
    };
  } else {
    // QES_automatic uses certificate-based signing (no signer interaction needed)
    // Matches server's send-qes endpoint format exactly - WITH VISIBLE SIGNATURE
    requestBody = {
      title: 'Angebot - Test Kunde',
      signatureType: 'pades',
      certificateUsername: config.certUsername,
      certificatePassword: config.certPassword,
      inputDocuments: [{
        sourceType: 'base64',
        payload: pdfBase64
      }],
      options: {
        withSignatureField: true,
        page: -1,  // Last page
        signerImage: {
          signerName: 'Test Kunde',
          reason: 'Angebot Unterschrift',
          location: 'Deutschland',
          imageVisible: true,
          width: 200,
          height: 60
        }
      }
    };
  }

  // Add callback if URL is provided
  if (config.callbackUrl) {
    requestBody.callback = {
      url: config.callbackUrl
    };
    log(`Callback URL configured: ${config.callbackUrl}`);
  } else {
    log('Warning: No callback URL configured, callback timing will not be measured');
  }

  log(`Creating signature with type: ${config.signatureType}`);

  // Use correct endpoint based on signature type (EU-SES or EU-QES_automatic)
  const endpoint = config.signatureType === 'EU-SES' ? '/EU-SES' : `/${config.signatureType}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create signature: ${response.status} ${response.statusText} - ${text}`);
  }

  const responseData = await response.json();
  log(`API Response: ${JSON.stringify(responseData, null, 2)}`);

  // Response may be wrapped in a data object
  const data = responseData.data || responseData;
  const signatureId = data.id;

  if (!signatureId) {
    throw new Error(`No signature ID in response: ${JSON.stringify(responseData)}`);
  }

  log(`Signature created with ID: ${signatureId}`);

  return {
    id: signatureId,
    createdAt: new Date()
  };
}

/**
 * Get signature details
 */
async function getSignatureDetail(id: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/signatures/${id}/detail`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get signature detail: ${response.status} ${response.statusText} - ${text}`);
  }

  return await response.json();
}

/**
 * Download and save artifact
 */
async function downloadArtifact(id: string, actionType: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/signatures/${id}/${actionType}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'X-API-Key': config.apiKey
      }
    });

    if (!response.ok) {
      log(`Warning: Could not download ${actionType}: ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    log(`Saved ${actionType} to: ${outputPath}`);
    return true;
  } catch (err) {
    log(`Error downloading ${actionType}:`, err);
    return false;
  }
}

/**
 * Check callback log from server
 */
async function getCallbackLog(signatureId: string): Promise<{ receivedAt: Date | null }> {
  if (!config.callbackUrl) {
    return { receivedAt: null };
  }

  try {
    // Extract base URL from callback URL
    const callbackUrl = new URL(config.callbackUrl);
    const logUrl = `${callbackUrl.origin}/api/openapi/esignature/callback-log?signatureId=${signatureId}`;

    const response = await fetch(logUrl);
    if (!response.ok) {
      return { receivedAt: null };
    }

    const data = await response.json();
    if (data.logs && data.logs.length > 0) {
      const matchingLog = data.logs.find((log: { signatureId: string }) => log.signatureId === signatureId);
      if (matchingLog) {
        return { receivedAt: new Date(matchingLog.receivedAt) };
      }
    }
    return { receivedAt: null };
  } catch {
    return { receivedAt: null };
  }
}

/**
 * Poll signature until DONE or ERROR
 */
async function pollSignature(id: string, createdAt: Date): Promise<TestResult> {
  const stateHistory: SignatureState[] = [];
  let waitValidationStart: Date | null = null;
  let waitValidationEnd: Date | null = null;
  let currentState = '';
  let finalState = '';
  let endedAt: Date | null = null;
  let error: string | null = null;

  log('Starting polling...');

  const pollLogPath = path.join(logsDir, `${id}-poll.json`);

  while (true) {
    try {
      const detail = await getSignatureDetail(id);
      const now = new Date();
      const state = (detail.state || detail.status || 'UNKNOWN') as string;

      const stateEntry: SignatureState = {
        timestamp: now.toISOString(),
        state,
        updatedAt: (detail.updatedAt || detail.updated_at || null) as string | null,
        createdAt: (detail.createdAt || detail.created_at || null) as string | null,
        errorNumber: (detail.errorNumber || detail.error_number || null) as number | null,
        errorMessage: (detail.errorMessage || detail.error_message || null) as string | null,
        hasDocument: !!(detail.document || detail.signedDocument)
      };

      stateHistory.push(stateEntry);

      // Save poll log incrementally
      fs.writeFileSync(pollLogPath, JSON.stringify(stateHistory, null, 2));

      // Track state transitions
      if (state !== currentState) {
        log(`State changed: ${currentState || 'INITIAL'} -> ${state}`);

        // Track WAIT_VALIDATION timing
        if (state === 'WAIT_VALIDATION') {
          waitValidationStart = now;
        } else if (currentState === 'WAIT_VALIDATION') {
          waitValidationEnd = now;
        }

        currentState = state;
      }

      // Check for terminal states
      if (state === 'DONE' || state === 'ERROR' || state === 'CANCELLED') {
        finalState = state;
        endedAt = now;

        if (state === 'ERROR') {
          error = stateEntry.errorMessage || `Error ${stateEntry.errorNumber}`;
        }

        break;
      }

      // Log progress
      const elapsed = Math.round((now.getTime() - createdAt.getTime()) / 1000);
      log(`State: ${state}, Elapsed: ${elapsed}s`);

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));

    } catch (err) {
      log('Poll error:', err);
      error = err instanceof Error ? err.message : String(err);
      finalState = 'POLL_ERROR';
      endedAt = new Date();
      break;
    }
  }

  // Calculate durations
  const totalDurationMs = endedAt ? endedAt.getTime() - createdAt.getTime() : 0;

  let waitValidationDurationMs = 0;
  if (waitValidationStart && waitValidationEnd) {
    waitValidationDurationMs = waitValidationEnd.getTime() - waitValidationStart.getTime();
  } else if (waitValidationStart && endedAt) {
    // If we never left WAIT_VALIDATION, it lasted until the end
    waitValidationDurationMs = endedAt.getTime() - waitValidationStart.getTime();
  }

  // Check callback log
  const callbackResult = await getCallbackLog(id);
  let callbackDurationMs: number | null = null;
  if (callbackResult.receivedAt) {
    callbackDurationMs = callbackResult.receivedAt.getTime() - createdAt.getTime();
  }

  return {
    signatureId: id,
    createdAt,
    endedAt,
    finalState,
    totalDurationMs,
    waitValidationDurationMs,
    callbackReceivedAt: callbackResult.receivedAt,
    callbackDurationMs,
    stateHistory,
    error
  };
}

/**
 * Download artifacts after completion
 */
async function downloadArtifacts(result: TestResult): Promise<void> {
  if (result.finalState !== 'DONE') {
    log('Skipping artifact download - signature did not complete successfully');
    return;
  }

  const id = result.signatureId;

  await downloadArtifact(id, 'signedDocument', path.join(artifactsDir, `${id}.pdf`));
  await downloadArtifact(id, 'validatedDocument', path.join(artifactsDir, `${id}-validated.pdf`));

  // Audit trail - might be JSON
  const auditPath = path.join(artifactsDir, `${id}-audit.json`);
  const auditDownloaded = await downloadArtifact(id, 'audit', auditPath);

  if (!auditDownloaded) {
    // Try without extension
    await downloadArtifact(id, 'audit', path.join(artifactsDir, `${id}-audit`));
  }
}

/**
 * Generate markdown report
 */
function generateReport(result: TestResult): string {
  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s (${ms}ms)`;
    }
    return `${seconds}s (${ms}ms)`;
  };

  const lines: string[] = [
    `# OpenAPI eSignature Test Report`,
    ``,
    `**Signature ID:** \`${result.signatureId}\``,
    `**Test Date:** ${result.createdAt.toISOString()}`,
    `**Signature Type:** ${config.signatureType}`,
    `**Domain:** ${config.domain}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Final State | \`${result.finalState}\` |`,
    `| Total Duration | ${formatDuration(result.totalDurationMs)} |`,
    `| WAIT_VALIDATION Duration | ${formatDuration(result.waitValidationDurationMs)} |`,
    `| Callback Received | ${result.callbackReceivedAt ? 'Yes' : 'No'} |`,
    `| Callback Duration | ${result.callbackDurationMs !== null ? formatDuration(result.callbackDurationMs) : 'N/A'} |`,
    ``,
  ];

  if (result.error) {
    lines.push(`## Error`);
    lines.push(``);
    lines.push(`\`\`\``, result.error, `\`\`\``);
    lines.push(``);
  }

  // State history
  lines.push(`## State History`);
  lines.push(``);
  lines.push(`| Timestamp | State | Elapsed |`);
  lines.push(`|-----------|-------|---------|`);

  for (const entry of result.stateHistory) {
    const elapsed = Math.round((new Date(entry.timestamp).getTime() - result.createdAt.getTime()) / 1000);
    lines.push(`| ${entry.timestamp} | \`${entry.state}\` | ${elapsed}s |`);
  }
  lines.push(``);

  // Callback analysis
  lines.push(`## Callback vs Polling Analysis`);
  lines.push(``);

  if (result.callbackReceivedAt) {
    const pollDetectedAt = result.stateHistory.find(s => s.state === 'DONE' || s.state === 'ERROR');
    const pollDetectedMs = pollDetectedAt
      ? new Date(pollDetectedAt.timestamp).getTime() - result.createdAt.getTime()
      : null;

    lines.push(`- **Callback detected completion at:** ${formatDuration(result.callbackDurationMs!)}`);
    if (pollDetectedMs) {
      lines.push(`- **Polling detected completion at:** ${formatDuration(pollDetectedMs)}`);
      const diff = pollDetectedMs - result.callbackDurationMs!;
      if (diff > 0) {
        lines.push(`- **Callback was faster by:** ${formatDuration(diff)}`);
      } else if (diff < 0) {
        lines.push(`- **Polling was faster by:** ${formatDuration(-diff)}`);
      } else {
        lines.push(`- **Both detected at approximately the same time**`);
      }
    }
  } else {
    lines.push(`Callback was not received. This could mean:`);
    lines.push(`- Callback URL was not configured`);
    lines.push(`- Callback URL was not publicly accessible`);
    lines.push(`- OpenAPI service failed to deliver the callback`);
  }
  lines.push(``);

  // Artifacts
  lines.push(`## Artifacts`);
  lines.push(``);

  const artifactFiles = [
    `${result.signatureId}.pdf`,
    `${result.signatureId}-validated.pdf`,
    `${result.signatureId}-audit.json`
  ];

  for (const file of artifactFiles) {
    const filePath = path.join(artifactsDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      lines.push(`- [${file}](../artifacts/${file}) (${Math.round(stats.size / 1024)}KB)`);
    } else {
      lines.push(`- ${file} - Not available`);
    }
  }
  lines.push(``);

  // Poll log
  lines.push(`## Poll Log`);
  lines.push(``);
  lines.push(`Full poll log: [${result.signatureId}-poll.json](../logs/${result.signatureId}-poll.json)`);
  lines.push(``);

  // Configuration used
  lines.push(`## Configuration`);
  lines.push(``);
  lines.push(`\`\`\`json`);
  lines.push(JSON.stringify({
    domain: config.domain,
    signatureType: config.signatureType,
    callbackUrl: config.callbackUrl || 'Not configured',
    pollIntervalMs: config.pollIntervalMs,
    signerEmail: config.signerEmail
  }, null, 2));
  lines.push(`\`\`\``);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Generate statistics report for multiple runs
 */
function generateStatsReport(results: TestResult[]): string {
  const lines: string[] = [
    `# OpenAPI eSignature Test Statistics`,
    ``,
    `**Test Date:** ${new Date().toISOString()}`,
    `**Number of Runs:** ${results.length}`,
    `**Signature Type:** ${config.signatureType}`,
    `**Domain:** ${config.domain}`,
    ``,
  ];

  // Filter successful runs
  const successfulRuns = results.filter(r => r.finalState === 'DONE');
  const failedRuns = results.filter(r => r.finalState !== 'DONE');

  lines.push(`## Overview`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Successful Runs | ${successfulRuns.length} |`);
  lines.push(`| Failed Runs | ${failedRuns.length} |`);
  lines.push(`| Success Rate | ${Math.round(successfulRuns.length / results.length * 100)}% |`);
  lines.push(``);

  if (successfulRuns.length > 0) {
    // Calculate statistics
    const totalDurations = successfulRuns.map(r => r.totalDurationMs);
    const waitValidationDurations = successfulRuns.map(r => r.waitValidationDurationMs);
    const callbackDurations = successfulRuns
      .filter(r => r.callbackDurationMs !== null)
      .map(r => r.callbackDurationMs!);

    const stats = (arr: number[]) => ({
      min: Math.min(...arr),
      max: Math.max(...arr),
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    });

    const formatMs = (ms: number) => `${Math.round(ms / 1000)}s (${ms}ms)`;

    const totalStats = stats(totalDurations);
    const waitStats = stats(waitValidationDurations);

    lines.push(`## Total Duration`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Minimum | ${formatMs(totalStats.min)} |`);
    lines.push(`| Maximum | ${formatMs(totalStats.max)} |`);
    lines.push(`| Average | ${formatMs(totalStats.avg)} |`);
    lines.push(``);

    lines.push(`## WAIT_VALIDATION Duration`);
    lines.push(``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Minimum | ${formatMs(waitStats.min)} |`);
    lines.push(`| Maximum | ${formatMs(waitStats.max)} |`);
    lines.push(`| Average | ${formatMs(waitStats.avg)} |`);
    lines.push(``);

    if (callbackDurations.length > 0) {
      const callbackStats = stats(callbackDurations);
      lines.push(`## Callback Duration`);
      lines.push(``);
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Received | ${callbackDurations.length}/${successfulRuns.length} |`);
      lines.push(`| Minimum | ${formatMs(callbackStats.min)} |`);
      lines.push(`| Maximum | ${formatMs(callbackStats.max)} |`);
      lines.push(`| Average | ${formatMs(callbackStats.avg)} |`);
      lines.push(``);
    } else {
      lines.push(`## Callback`);
      lines.push(``);
      lines.push(`No callbacks were received during testing.`);
      lines.push(``);
    }
  }

  // Individual run summaries
  lines.push(`## Individual Runs`);
  lines.push(``);
  lines.push(`| Run | Signature ID | Final State | Total | WAIT_VALIDATION | Callback |`);
  lines.push(`|-----|--------------|-------------|-------|-----------------|----------|`);

  results.forEach((r, i) => {
    const totalSec = Math.round(r.totalDurationMs / 1000);
    const waitSec = Math.round(r.waitValidationDurationMs / 1000);
    const callbackSec = r.callbackDurationMs !== null ? Math.round(r.callbackDurationMs / 1000) + 's' : 'N/A';
    lines.push(`| ${i + 1} | \`${r.signatureId}\` | ${r.finalState} | ${totalSec}s | ${waitSec}s | ${callbackSec} |`);
  });
  lines.push(``);

  // Links to individual reports
  lines.push(`## Individual Reports`);
  lines.push(``);
  results.forEach(r => {
    lines.push(`- [${r.signatureId}](${r.signatureId}.md)`);
  });
  lines.push(``);

  return lines.join('\n');
}

/**
 * Run a single test
 */
async function runSingleTest(): Promise<TestResult> {
  log('='.repeat(60));
  log('Starting new signature test');
  log('='.repeat(60));

  // Create signature
  const { id, createdAt } = await createSignature();

  // Poll until completion
  const result = await pollSignature(id, createdAt);

  // Download artifacts
  await downloadArtifacts(result);

  // Generate report
  const report = generateReport(result);
  const reportPath = path.join(reportsDir, `${id}.md`);
  fs.writeFileSync(reportPath, report);
  log(`Report saved to: ${reportPath}`);

  // Print summary
  log('='.repeat(60));
  log('Test Complete');
  log(`Signature ID: ${id}`);
  log(`Final State: ${result.finalState}`);
  log(`Total Duration: ${Math.round(result.totalDurationMs / 1000)}s`);
  log(`WAIT_VALIDATION Duration: ${Math.round(result.waitValidationDurationMs / 1000)}s`);
  log(`Callback Received: ${result.callbackReceivedAt ? 'Yes' : 'No'}`);
  if (result.callbackDurationMs !== null) {
    log(`Callback Duration: ${Math.round(result.callbackDurationMs / 1000)}s`);
  }
  log('='.repeat(60));

  return result;
}

/**
 * Main entry point
 */
async function main() {
  log('OpenAPI eSignature Sandbox Test Harness');
  log(`Configuration: ${config.signatureType} on ${config.domain}`);
  log(`Planned runs: ${config.numRuns}`);
  log('');

  if (!config.callbackUrl) {
    log('WARNING: No CALLBACK_PUBLIC_URL configured. Callback timing will not be measured.');
    log('Set CALLBACK_PUBLIC_URL in .env to enable callback measurement.');
    log('');
  }

  const results: TestResult[] = [];

  for (let i = 0; i < config.numRuns; i++) {
    log(`\n${'#'.repeat(60)}`);
    log(`RUN ${i + 1} of ${config.numRuns}`);
    log(`${'#'.repeat(60)}\n`);

    try {
      const result = await runSingleTest();
      results.push(result);

      // Wait between runs to avoid rate limiting
      if (i < config.numRuns - 1) {
        log('Waiting 10 seconds before next run...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (err) {
      log('Run failed with error:', err);
      results.push({
        signatureId: `failed-run-${i + 1}`,
        createdAt: new Date(),
        endedAt: new Date(),
        finalState: 'RUN_ERROR',
        totalDurationMs: 0,
        waitValidationDurationMs: 0,
        callbackReceivedAt: null,
        callbackDurationMs: null,
        stateHistory: [],
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // Generate statistics report if multiple runs
  if (config.numRuns > 1) {
    const statsReport = generateStatsReport(results);
    const statsPath = path.join(reportsDir, `statistics-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
    fs.writeFileSync(statsPath, statsReport);
    log(`Statistics report saved to: ${statsPath}`);
  }

  log('\n' + '='.repeat(60));
  log('ALL TESTS COMPLETE');
  log('='.repeat(60));

  // Final summary
  const successful = results.filter(r => r.finalState === 'DONE').length;
  const failed = results.length - successful;
  log(`Successful: ${successful}, Failed: ${failed}`);

  if (successful > 0) {
    const avgTotal = Math.round(
      results
        .filter(r => r.finalState === 'DONE')
        .reduce((sum, r) => sum + r.totalDurationMs, 0) / successful / 1000
    );
    const avgWait = Math.round(
      results
        .filter(r => r.finalState === 'DONE')
        .reduce((sum, r) => sum + r.waitValidationDurationMs, 0) / successful / 1000
    );
    log(`Average Total Duration: ${avgTotal}s`);
    log(`Average WAIT_VALIDATION Duration: ${avgWait}s`);
  }
}

// Run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
