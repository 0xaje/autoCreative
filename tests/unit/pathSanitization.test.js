const assert = require('assert');
const path = require('path');
const http = require('http');
const config = require('../../src/config');
const { app } = require('../../server');
const {
  PROJECT_ID_PATTERN,
  isValidProjectId,
  getSafeProjectPath,
  getSafeArtifactPath
} = require('../../src/utils/pathSanitizer');

console.log('🧪 Running Unit Test: Path Sanitization & Traversal Security...');

// 1. Unit Tests: isValidProjectId and PROJECT_ID_PATTERN
const maliciousPayloads = [
  '..',
  '../..',
  '../../etc/passwd',
  '..\\..\\windows\\system32',
  'proj_../../../etc/passwd',
  'proj_..\\..\\secret',
  'proj_test/subfolder',
  'proj_test\\subfolder',
  'proj_test.dot',
  'proj_%2e%2e',
  'proj_null\0byte',
  '/etc/shadow',
  '~/.ssh/id_rsa',
  'some_arbitrary_project',
  '',
  null,
  undefined,
  12345
];

for (const payload of maliciousPayloads) {
  assert.strictEqual(
    isValidProjectId(payload),
    false,
    `Payload "${payload}" must be rejected by isValidProjectId`
  );
  assert.strictEqual(
    getSafeProjectPath(payload),
    null,
    `Payload "${payload}" must return null from getSafeProjectPath`
  );
}
console.log(`✅ Test 1 Passed: All ${maliciousPayloads.length} malicious traversal payloads rejected`);

// 2. Unit Tests: Valid project IDs
const validProjectIds = [
  'proj_1790731120633',
  'proj_alpha-beta_123',
  'proj_workspace_99',
  'cli_1790639584763',
  'test_regen_12345'
];

for (const id of validProjectIds) {
  assert.strictEqual(isValidProjectId(id), true, `Project ID "${id}" must be valid`);
  const safePath = getSafeProjectPath(id);
  assert(safePath, `Safe path must be returned for "${id}"`);
  assert(
    safePath.startsWith(path.resolve(config.PROJECTS_DIR) + path.sep),
    `Safe path for "${id}" must stay strictly inside PROJECTS_DIR`
  );
}
console.log(`✅ Test 2 Passed: Valid project IDs accepted and safely resolved within PROJECTS_DIR`);

// 3. Unit Tests: Artifact path sanitization
assert.strictEqual(getSafeArtifactPath('..', 'project.json'), null);
assert.strictEqual(getSafeArtifactPath('proj_123', '..'), null);
assert.strictEqual(getSafeArtifactPath('proj_123', ''), null);

const safeArtifact = getSafeArtifactPath('proj_123', '../../etc/passwd');
assert(safeArtifact, 'Sanitized artifact path should be resolved');
assert(
  safeArtifact.startsWith(path.resolve(config.PROJECTS_DIR, 'proj_123') + path.sep),
  'Sanitized artifact must remain strictly within project directory'
);
assert.strictEqual(path.basename(safeArtifact), 'passwd', 'Basename must be extracted safely');
console.log('✅ Test 3 Passed: Artifact path sanitization prevents directory breakout');

// 4. HTTP API Integration Tests on server endpoints
(async () => {
  // Start server on an ephemeral port for testing
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const makeRequest = (method, urlPath, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, baseUrl);
      const req = http.request(
        {
          method,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          headers: body ? { 'Content-Type': 'application/json' } : {}
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = JSON.parse(data);
            } catch (_) {
              parsed = data;
            }
            resolve({ status: res.statusCode, body: parsed });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  try {
    // 4.1 Invalid ID formats should return 400 Bad Request
    const res1 = await makeRequest('GET', '/api/projects/arbitrary_id');
    assert.strictEqual(res1.status, 400, 'GET /api/projects/arbitrary_id must return 400');
    assert(res1.body.error.includes('Invalid project ID'), 'Must return Invalid project ID format error');

    // 4.2 Traversal attempt in project ID
    const res2 = await makeRequest('GET', '/api/projects/proj_..%2f..%2fetc/status');
    assert.strictEqual(res2.status, 400, 'Traversal status endpoint must return 400');

    // 4.3 Traversal in artifact retrieval
    const res3 = await makeRequest('GET', '/api/projects/invalid_id/artifacts/project.json');
    assert.strictEqual(res3.status, 400, 'Artifact endpoint with invalid ID must return 400');

    // 4.4 Regeneration endpoints with invalid project ID
    const res4 = await makeRequest('POST', '/api/projects/hack_attempt/regenerate-scene', { sceneIndex: 0 });
    assert.strictEqual(res4.status, 400, 'regenerate-scene with invalid ID must return 400');

    const res5 = await makeRequest('POST', '/api/projects/hack_attempt/regenerate-intent', { userRequest: 'make vertical' });
    assert.strictEqual(res5.status, 400, 'regenerate-intent with invalid ID must return 400');

    const res6 = await makeRequest('POST', '/api/projects/hack_attempt/regenerate', { sceneIndex: 0 });
    assert.strictEqual(res6.status, 400, 'regenerate with invalid ID must return 400');

    // 4.5 Video endpoint with invalid ID
    const res7 = await makeRequest('GET', '/api/projects/hack_attempt/video');
    assert.strictEqual(res7.status, 400, 'Video endpoint with invalid ID must return 400');

    // 4.6 Valid format but non-existent project should return 404 (not 400 or 500)
    const res8 = await makeRequest('GET', '/api/projects/proj_999999999999');
    assert.strictEqual(res8.status, 404, 'Valid format but non-existent project must return 404');
    assert.strictEqual(res8.body.error, 'Project not found');

    console.log('✅ Test 4 Passed: Express HTTP API endpoints strictly enforce 400 for path traversal and 404 for non-existent projects');

    console.log('\n🎉 ALL PATH SANITIZATION & TRAVERSAL SECURITY TESTS PASSED!\n');
  } finally {
    testServer.close();
  }
})().catch((err) => {
  console.error('❌ Path sanitization test failed:', err);
  process.exit(1);
});
