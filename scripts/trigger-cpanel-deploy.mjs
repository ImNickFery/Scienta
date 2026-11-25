#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

/**
 * Normalize cPanel host URL (defaults to https:// and port 2083 if omitted).
 * @param {string} rawHost
 * @returns {string}
 */
export function normalizeCpanelHost(rawHost) {
  const trimmed = String(rawHost || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('CPANEL_HOST is required (e.g. https://server.example.com:2083)');
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!url.port) {
    url.port = '2083';
  }
  return url.origin;
}

/**
 * Build cPanel UAPI Authorization header.
 * @param {string} username
 * @param {string} apiToken
 * @returns {string}
 */
export function buildCpanelAuthHeader(username, apiToken) {
  const user = String(username || '').trim();
  const token = String(apiToken || '').trim();
  if (!user) throw new Error('CPANEL_USERNAME is required');
  if (!token) throw new Error('CPANEL_API_TOKEN is required');
  return `cpanel ${user}:${token}`;
}

/**
 * Build full cPanel UAPI URL with query parameters.
 * @param {string} host
 * @param {string} moduleName
 * @param {string} functionName
 * @param {Record<string, string | number | boolean | undefined>} [params]
 * @returns {string}
 */
export function buildUapiUrl(host, moduleName, functionName, params = {}) {
  const origin = normalizeCpanelHost(host);
  const url = new URL(`/execute/${moduleName}/${functionName}`, origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Parse and validate cPanel UAPI JSON response.
 * @param {string} rawText
 * @param {number} httpStatus
 * @returns {{ ok: boolean; status: number; data: unknown; errors: string[]; messages: string[] }}
 */
export function parseUapiResponse(rawText, httpStatus) {
  /** @type {{ status?: number; data?: unknown; errors?: unknown; messages?: unknown } | null} */
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Invalid JSON from cPanel UAPI (HTTP ${httpStatus}): ${rawText.slice(0, 240)}`);
  }

  const errors = Array.isArray(parsed?.errors) ? parsed.errors.map(String) : [];
  const messages = Array.isArray(parsed?.messages) ? parsed.messages.map(String) : [];
  const status = typeof parsed?.status === 'number' ? parsed.status : 0;

  if (httpStatus < 200 || httpStatus >= 300 || status !== 1) {
    const detail = errors.join('; ') || `HTTP ${httpStatus} (status=${status})`;
    throw new Error(`cPanel UAPI error: ${detail}`);
  }

  return {
    ok: true,
    status,
    data: parsed?.data ?? null,
    errors,
    messages,
  };
}

/**
 * Return list of missing required deployment environment variable descriptions.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function getMissingConfigFields(env = process.env) {
  const rawHost = String(env.CPANEL_HOST || '').trim();
  const username = String(env.CPANEL_USERNAME || '').trim();
  const apiToken = String(env.CPANEL_API_TOKEN || '').trim();
  const repoRoot = String(env.CPANEL_REPO_ROOT || '').trim();

  /** @type {string[]} */
  const missing = [];
  if (!rawHost) missing.push('CPANEL_HOST (e.g. https://yourdomain.com:2083)');
  if (!username) missing.push('CPANEL_USERNAME');
  if (!apiToken) missing.push('CPANEL_API_TOKEN');
  if (!repoRoot) missing.push('CPANEL_REPO_ROOT (e.g. /home/username/scienta-app)');
  return missing;
}

/**
 * Read and validate deployment configuration from environment variables.
 * @param {Record<string, string | undefined>} [env]
 */
export function readDeployConfig(env = process.env) {
  const rawHost = String(env.CPANEL_HOST || '').trim();
  const username = String(env.CPANEL_USERNAME || '').trim();
  const apiToken = String(env.CPANEL_API_TOKEN || '').trim();
  const repoRoot = String(env.CPANEL_REPO_ROOT || '').trim();
  const branch = String(env.CPANEL_BRANCH || 'deploy').trim() || 'deploy';

  const missing = getMissingConfigFields(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing GitHub Actions secrets/variables: ${missing.join(', ')}. Add them in GitHub -> Settings -> Secrets and variables -> Actions.`
    );
  }

  const host = normalizeCpanelHost(rawHost);
  const authHeader = buildCpanelAuthHeader(username, apiToken);

  return { host, username, apiToken, repoRoot, branch, authHeader };
}

/**
 * Call a cPanel UAPI endpoint.
 * @param {{ host: string; authHeader: string; moduleName: string; functionName: string; params?: Record<string, string> }} opts
 */
async function callCpanelUapi({ host, authHeader, moduleName, functionName, params }) {
  const url = buildUapiUrl(host, moduleName, functionName, params);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  return parseUapiResponse(text, res.status);
}

/**
 * Trigger Git pull + deployment on cPanel via UAPI.
 * @param {Record<string, string | undefined>} [env]
 */
export async function runCpanelDeploy(env = process.env) {
  const missing = getMissingConfigFields(env);
  if (missing.length > 0 && (env.SKIP_IF_UNCONFIGURED === 'true' || env.SKIP_IF_UNCONFIGURED === '1')) {
    console.log(
      `[cpanel] Skipping auto-deploy on push because cPanel secrets are not configured yet (${missing.join(', ')}).`
    );
    console.log('[cpanel] You can install directly inside cPanel Terminal via scripts/cpanel-install.sh.');
    return { skipped: true };
  }

  if (env.CPANEL_ALLOW_SELF_SIGNED === '1' || env.CPANEL_ALLOW_SELF_SIGNED === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const config = readDeployConfig(env);

  console.log(`[cpanel] Pulling branch "${config.branch}" in ${config.repoRoot}...`);
  const updateRes = await callCpanelUapi({
    host: config.host,
    authHeader: config.authHeader,
    moduleName: 'VersionControl',
    functionName: 'update',
    params: {
      repository_root: config.repoRoot,
      branch: config.branch,
    },
  });
  console.log('[cpanel] VersionControl/update succeeded:', JSON.stringify(updateRes.data));

  console.log(`[cpanel] Triggering .cpanel.yml deployment for ${config.repoRoot}...`);
  const deployRes = await callCpanelUapi({
    host: config.host,
    authHeader: config.authHeader,
    moduleName: 'VersionControlDeployment',
    functionName: 'create',
    params: {
      repository_root: config.repoRoot,
    },
  });
  console.log('[cpanel] VersionControlDeployment/create succeeded:', JSON.stringify(deployRes.data));
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runCpanelDeploy().catch((err) => {
    console.error('[cpanel] Deployment failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
