import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCpanelHost,
  buildCpanelAuthHeader,
  buildUapiUrl,
  parseUapiResponse,
  readDeployConfig,
  runCpanelDeploy,
} from './trigger-cpanel-deploy.mjs';

test('normalizeCpanelHost adds https and default port 2083 when omitted', () => {
  assert.equal(normalizeCpanelHost('panel.example.com'), 'https://panel.example.com:2083');
  assert.equal(normalizeCpanelHost('https://panel.example.com/'), 'https://panel.example.com:2083');
  assert.equal(normalizeCpanelHost('https://panel.example.com:2087/'), 'https://panel.example.com:2087');
  assert.throws(() => normalizeCpanelHost(''), /CPANEL_HOST is required/);
});

test('buildCpanelAuthHeader formats cpanel user:token header and rejects blanks', () => {
  assert.equal(buildCpanelAuthHeader('myuser', 'TOK123'), 'cpanel myuser:TOK123');
  assert.throws(() => buildCpanelAuthHeader('', 'TOK123'), /CPANEL_USERNAME/);
  assert.throws(() => buildCpanelAuthHeader('myuser', '  '), /CPANEL_API_TOKEN/);
});

test('buildUapiUrl builds VersionControl UAPI endpoint with query parameters', () => {
  const url = buildUapiUrl('https://host.test:2083', 'VersionControl', 'update', {
    repository_root: '/home/user/scienta-app',
    branch: 'deploy',
  });
  assert.equal(
    url,
    'https://host.test:2083/execute/VersionControl/update?repository_root=%2Fhome%2Fuser%2Fscienta-app&branch=deploy'
  );
});

test('parseUapiResponse succeeds for status=1 and throws clear error on failures', () => {
  const ok = parseUapiResponse(
    JSON.stringify({ status: 1, data: { deploy_id: 42 }, errors: null, messages: ['OK'] }),
    200
  );
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.data, { deploy_id: 42 });

  assert.throws(
    () =>
      parseUapiResponse(
        JSON.stringify({ status: 0, errors: ['Repository not found'], data: null }),
        200
      ),
    /Repository not found/
  );
  assert.throws(() => parseUapiResponse('not json', 502), /Invalid JSON/);
});

test('readDeployConfig validates all required secrets and defaults branch to deploy', () => {
  const cfg = readDeployConfig({
    CPANEL_HOST: 'example.com',
    CPANEL_USERNAME: 'alice',
    CPANEL_API_TOKEN: 'secret-token',
    CPANEL_REPO_ROOT: '/home/alice/scienta-app',
  });
  assert.equal(cfg.host, 'https://example.com:2083');
  assert.equal(cfg.branch, 'deploy');
  assert.equal(cfg.authHeader, 'cpanel alice:secret-token');

  assert.throws(
    () =>
      readDeployConfig({
        CPANEL_HOST: 'example.com',
        CPANEL_USERNAME: 'alice',
        CPANEL_API_TOKEN: 'secret-token',
      }),
    /CPANEL_REPO_ROOT/
  );
  assert.throws(
    () => readDeployConfig({}),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      return (
        msg.includes('CPANEL_HOST') &&
        msg.includes('CPANEL_USERNAME') &&
        msg.includes('CPANEL_API_TOKEN') &&
        msg.includes('CPANEL_REPO_ROOT')
      );
    }
  );
});

test('runCpanelDeploy skips cleanly when SKIP_IF_UNCONFIGURED=true and secrets are missing', async () => {
  const result = await runCpanelDeploy({ SKIP_IF_UNCONFIGURED: 'true' });
  assert.deepEqual(result, { skipped: true });
});
