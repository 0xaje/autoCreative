const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const {
  isPrivateIp,
  validateLiveUrl,
  validateGithubUrl,
  validateLocalPath,
  isValidProjectId,
  getSafeProjectPath,
  getSafeArtifactPath
} = require('../../src/utils/pathSanitizer');

const VideoEditor = require('../../src/agents/videoEditor');
const IntentEngine = require('../../src/agents/intentEngine');
const Researcher = require('../../src/agents/researcher');
const ScreenRecorder = require('../../src/agents/screenRecorder');
const CreativeDirector = require('../../src/agents/creativeDirector');
const config = require('../../src/config');
const { app, isAllowedWebSocketOrigin } = require('../../server');

console.log('🧪 Running Comprehensive Security & Audit Verification Suite...\n');

// ---------------------------------------------------------------------------
// 1. Browser Sandboxing Verification (Researcher & ScreenRecorder)
// ---------------------------------------------------------------------------
console.log('--- Test 1: Chromium Sandboxing Default Behavior ---');
{
  const researcher = new Researcher();
  const resLaunch = researcher.getChromeLaunchArgs({ width: 1920, height: 1080, forceNoSandbox: false });
  assert.ok(Array.isArray(resLaunch.args), 'Researcher launch args must be an array');
  
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  if (!isRoot && process.env.CHROME_NO_SANDBOX !== 'true') {
    assert.strictEqual(resLaunch.args.includes('--no-sandbox'), false, 'Researcher must NOT include --no-sandbox by default');
    assert.strictEqual(resLaunch.args.includes('--disable-setuid-sandbox'), false, 'Researcher must NOT include --disable-setuid-sandbox by default');
    assert.strictEqual(resLaunch.shouldDisableSandbox, false, 'Researcher shouldDisableSandbox must be false by default');
  }

  const screenRecorder = new ScreenRecorder();
  const srLaunch = screenRecorder.getChromeLaunchArgs({ width: 1280, height: 720, forceNoSandbox: false });
  assert.ok(Array.isArray(srLaunch.args), 'ScreenRecorder launch args must be an array');
  if (!isRoot && process.env.CHROME_NO_SANDBOX !== 'true') {
    assert.strictEqual(srLaunch.args.includes('--no-sandbox'), false, 'ScreenRecorder must NOT include --no-sandbox by default');
    assert.strictEqual(srLaunch.args.includes('--disable-setuid-sandbox'), false, 'ScreenRecorder must NOT include --disable-setuid-sandbox by default');
    assert.strictEqual(srLaunch.shouldDisableSandbox, false, 'ScreenRecorder shouldDisableSandbox must be false by default');
  }

  // When forceNoSandbox is true, it should cleanly add the flag
  const forcedLaunch = researcher.getChromeLaunchArgs({ forceNoSandbox: true });
  assert.ok(forcedLaunch.args.includes('--no-sandbox'), 'Forced sandbox disable must include --no-sandbox');
  assert.strictEqual(forcedLaunch.shouldDisableSandbox, true);

  console.log('✅ Test 1 Passed: Researcher and ScreenRecorder enable sandbox by default');
}

// ---------------------------------------------------------------------------
// 2. SSRF Prevention & Arbitrary Local Path Validation
// ---------------------------------------------------------------------------
console.log('\n--- Test 2: SSRF Prevention and Local Path Allow-Listing ---');
{
  // Malicious / internal IP targets
  const ssrfTargets = [
    'http://127.0.0.1:8080/admin',
    'http://localhost:3000',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/internal',
    'http://192.168.1.1/router',
    'http://172.16.0.5/api',
    'http://172.31.255.255/secrets',
    'http://[::1]/status',
    'http://0.0.0.0:80',
    'http://2130706433', // 127.0.0.1 decimal
    'http://0x7f000001', // 127.0.0.1 hex
    'http://metadata.google.internal/computeMetadata/v1/',
    'file:///etc/passwd',
    'gopher://127.0.0.1:6379/_flushall',
    'javascript:alert(1)'
  ];

  for (const url of ssrfTargets) {
    const res = validateLiveUrl(url);
    assert.strictEqual(res.valid, false, `SSRF target must be blocked: ${url}`);
  }

  // Safe external URLs
  const safeUrls = [
    'https://github.com/facebook/react',
    'https://example.com/demo',
    'http://public-saas-dashboard.com'
  ];
  for (const url of safeUrls) {
    const res = validateLiveUrl(url);
    assert.strictEqual(res.valid, true, `Legitimate external URL should be allowed: ${url}`);
  }

  // GitHub URL validation
  assert.strictEqual(validateGithubUrl('https://github.com/my-org/my-repo').valid, true);
  assert.strictEqual(validateGithubUrl('javascript:alert(1)').valid, false);
  assert.strictEqual(validateGithubUrl('file:///etc/passwd').valid, false);

  // Local Path validation
  const dangerousLocalPaths = [
    '/etc/shadow',
    '/var/log',
    '../../../../etc/passwd',
    '/tmp/arbitrary_file.txt'
  ];
  for (const p of dangerousLocalPaths) {
    const res = validateLocalPath(p);
    assert.strictEqual(res.valid, false, `Dangerous local path must be rejected: ${p}`);
  }

  // Legitimate demo path
  const demoPath = path.join(config.DEMO_APPS_DIR, 'saas-analytics');
  if (fs.existsSync(demoPath)) {
    const res = validateLocalPath(demoPath);
    assert.strictEqual(res.valid, true, 'Allowed demo app path must be accepted');
  }

  console.log('✅ Test 2 Passed: SSRF targets blocked and localPath strictly allow-listed');
}

// ---------------------------------------------------------------------------
// 3. WebSocket Origin Validation
// ---------------------------------------------------------------------------
console.log('\n--- Test 3: WebSocket Origin Validation ---');
{
  assert.strictEqual(isAllowedWebSocketOrigin(`http://localhost:${config.PORT}`), true, 'Same-host localhost origin allowed');
  assert.strictEqual(isAllowedWebSocketOrigin(`http://127.0.0.1:${config.PORT}`), true, 'Same-host 127.0.0.1 origin allowed');
  assert.strictEqual(isAllowedWebSocketOrigin(null), true, 'Non-browser CLI/testing client allowed');
  assert.strictEqual(isAllowedWebSocketOrigin(''), true, 'Empty origin allowed');

  assert.strictEqual(isAllowedWebSocketOrigin('http://evil-attacker.com'), false, 'Malicious third-party origin rejected');
  assert.strictEqual(isAllowedWebSocketOrigin('https://attacker.com'), false, 'Attacker HTTPS origin rejected');
  assert.strictEqual(isAllowedWebSocketOrigin('http://localhost:9999'), false, 'Mismatched port rejected');

  console.log('✅ Test 3 Passed: WebSocket Origin validation blocks unauthorized origins');
}

// ---------------------------------------------------------------------------
// 4. Static Projects Directory Exposure Eliminated
// ---------------------------------------------------------------------------
console.log('\n--- Test 4: Static Projects Mount Elimination ---');
{
  // Test that app.js does not fetch /projects/:id directly
  const appJsContent = fs.readFileSync(path.join(__dirname, '../../src/public/js/app.js'), 'utf8');
  assert.strictEqual(appJsContent.includes('fetch(`/projects/${projectId}/evidence.json`)'), false, 'Direct /projects/ evidence fetch removed');
  assert.strictEqual(appJsContent.includes('fetch(`/projects/${projectId}/project_model.json`)'), false, 'Direct /projects/ model fetch removed');
  assert.ok(appJsContent.includes('/api/projects/${projectId}/artifacts/evidence.json'), 'Artifacts API used for evidence.json');
  assert.ok(appJsContent.includes('/api/projects/${projectId}/artifacts/project_model.json'), 'Artifacts API used for project_model.json');

  console.log('✅ Test 4 Passed: Static projects exposure eliminated and routed through safe API');
}

// ---------------------------------------------------------------------------
// 5. Explicit Loopback Binding Default
// ---------------------------------------------------------------------------
console.log('\n--- Test 5: Explicit Loopback Binding Configuration ---');
{
  const serverJsContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(serverJsContent.includes("const HOST = process.env.HOST || '127.0.0.1';"), 'Server defines HOST defaulting to 127.0.0.1');
  assert.ok(serverJsContent.includes("server.listen(config.PORT, HOST"), 'server.listen explicitly passes HOST');

  console.log('✅ Test 5 Passed: Server explicitly binds to 127.0.0.1 loopback interface');
}

// ---------------------------------------------------------------------------
// 6. FFmpeg drawtext Filter Injection Prevention
// ---------------------------------------------------------------------------
console.log('\n--- Test 6: FFmpeg drawtext Filter Injection Prevention ---');
{
  const escapeFn = VideoEditor.escapeDrawtext;
  assert.strictEqual(typeof escapeFn, 'function', 'escapeDrawtext must be exported');

  // Test malicious injection strings
  const maliciousTitle = "Normal Title'; drawbox=0:0:100:100:red@1.0; [out] null; '";
  const escaped = escapeFn(maliciousTitle);
  assert.strictEqual(escaped.includes("'"), false, "Single quotes must be stripped to prevent closing the text delimiter");
  assert.ok(escaped.includes('\\;'), "Semicolons must be escaped with backslash");
  assert.ok(escaped.includes('\\['), "Brackets must be escaped with backslash");
  assert.ok(escaped.includes('\\]'), "Brackets must be escaped with backslash");

  // Test special drawtext function expansion: %{pts}
  const ptsPayload = 'User %{pts} text';
  assert.strictEqual(escapeFn(ptsPayload), 'User \\%\\{pts\\} text'.replace(/\\\{|\\\}/g, (m) => m[1]), 'Percent sign must be escaped to prevent drawtext function expansion');

  // Test colon escaping
  assert.strictEqual(escapeFn('Time: 12:00'), 'Time\\: 12\\:00', 'Colons must be escaped');

  // Color sanitization
  const sanitizeColor = VideoEditor.sanitizeColor;
  assert.strictEqual(sanitizeColor('0x6366f1', 'white'), '0x6366f1');
  assert.strictEqual(sanitizeColor('#ffffff', 'white'), '#ffffff');
  assert.strictEqual(sanitizeColor('red', 'white'), 'red');
  assert.strictEqual(sanitizeColor('black@0.65; exec=rm -rf', '0x6366f1'), '0x6366f1', 'Injection payload in color must fall back to default');

  console.log('✅ Test 6 Passed: FFmpeg drawtext filter parameters thoroughly escaped and sanitized');
}

// ---------------------------------------------------------------------------
// 7. MotionDesigner fs.unlinkSync TypeError Fix
// ---------------------------------------------------------------------------
console.log('\n--- Test 7: MotionDesigner Catch Block Syntax Safety ---');
{
  const motionJs = fs.readFileSync(path.join(__dirname, '../../src/agents/motionDesigner.js'), 'utf8');
  assert.strictEqual(motionJs.includes('fs.unlinkSync(tempSnapshotPath).catch'), false, 'fs.unlinkSync(...).catch() pattern must be eliminated');
  assert.ok(motionJs.includes('try {\n        if (fs.existsSync(tempSnapshotPath)) fs.unlinkSync(tempSnapshotPath);\n      } catch (_) {}') ||
            motionJs.includes('if (fs.existsSync(tempSnapshotPath)) fs.unlinkSync(tempSnapshotPath);'),
            'Safe unlink handling in catch block');

  console.log('✅ Test 7 Passed: fs.unlinkSync(...).catch() TypeError completely resolved');
}

// ---------------------------------------------------------------------------
// 8. activeScenesList Implicit Global Resolution
// ---------------------------------------------------------------------------
console.log('\n--- Test 8: activeScenesList Variable Declaration ---');
{
  const appJs = fs.readFileSync(path.join(__dirname, '../../src/public/js/app.js'), 'utf8');
  assert.ok(appJs.includes('let activeScenesList = [];'), 'activeScenesList must be explicitly declared with let');

  console.log('✅ Test 8 Passed: activeScenesList properly scoped to avoid implicit globals');
}

// ---------------------------------------------------------------------------
// 9. HTTP Range Header Validation & 416 Responses
// ---------------------------------------------------------------------------
console.log('\n--- Test 9: HTTP Range Header Validation ---');
(async () => {
  const testServer = http.createServer(app);
  await new Promise(r => testServer.listen(0, '127.0.0.1', r));
  const port = testServer.address().port;

  function reqWithRange(pathUrl, rangeHeader) {
    return new Promise((resolve) => {
      const headers = {};
      if (rangeHeader !== undefined) headers['Range'] = rangeHeader;
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: pathUrl,
        method: 'GET',
        headers
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', (e) => resolve({ error: e }));
      req.end();
    });
  }

  // Test against mock project video
  const testProjDir = path.join(config.PROJECTS_DIR, 'test_range_proj');
  fs.mkdirSync(testProjDir, { recursive: true });
  const mockVideo = path.join(testProjDir, 'output.mp4');
  fs.writeFileSync(mockVideo, Buffer.alloc(1000, 0x41)); // 1000 bytes

  try {
    // Malformed range
    const r1 = await reqWithRange('/api/projects/test_range_proj/video', 'bytes=abc-def');
    assert.strictEqual(r1.status, 416, 'Malformed range header must return HTTP 416');
    assert.strictEqual(r1.headers['content-range'], 'bytes */1000');

    // Out of bounds range (start > end)
    const r2 = await reqWithRange('/api/projects/test_range_proj/video', 'bytes=500-100');
    assert.strictEqual(r2.status, 416, 'Inverted range (start > end) must return HTTP 416');

    // Start >= fileSize
    const r3 = await reqWithRange('/api/projects/test_range_proj/video', 'bytes=2000-');
    assert.strictEqual(r3.status, 416, 'Out of bounds start must return HTTP 416');

    // Valid partial range
    const r4 = await reqWithRange('/api/projects/test_range_proj/video', 'bytes=0-99');
    assert.strictEqual(r4.status, 206, 'Valid range must return HTTP 206 Partial Content');
    assert.strictEqual(r4.headers['content-range'], 'bytes 0-99/1000');
    assert.strictEqual(r4.headers['content-length'], '100');

    // Valid suffix range: last 200 bytes
    const r5 = await reqWithRange('/api/projects/test_range_proj/video', 'bytes=-200');
    assert.strictEqual(r5.status, 206, 'Suffix range must return HTTP 206');
    assert.strictEqual(r5.headers['content-range'], 'bytes 800-999/1000');
    assert.strictEqual(r5.headers['content-length'], '200');

    console.log('✅ Test 9 Passed: HTTP Range header strictly validated with RFC 7233 416 compliance');
  } finally {
    testServer.close();
    if (fs.existsSync(testProjDir)) fs.rmSync(testProjDir, { recursive: true, force: true });
  }

  // ---------------------------------------------------------------------------
  // 10. Non-Numeric Duration NaN Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 10: Non-Numeric Duration NaN Prevention in Intent Engine ---');
  {
    const intentEngine = new IntentEngine();

    // 1. Invalid string duration in overrides
    const intent1 = intentEngine.parseIntent('Generate product video', { duration: 'not_a_number' });
    assert.strictEqual(Number.isFinite(intent1.duration_seconds), true, 'Duration must be a finite number');
    assert.strictEqual(intent1.duration_seconds, 60, 'Malformed duration override must fall back to 60s');

    // 2. NaN in overrides
    const intent2 = intentEngine.parseIntent('Generate video', { duration: NaN });
    assert.strictEqual(Number.isFinite(intent2.duration_seconds), true, 'Duration must not be NaN');
    assert.strictEqual(intent2.duration_seconds, 60);

    // 3. Clamping boundary tests
    const intent3 = intentEngine.parseIntent('Generate video', { duration: 5 });
    assert.strictEqual(intent3.duration_seconds, 15, 'Duration below 15 must be clamped to 15s');

    const intent4 = intentEngine.parseIntent('Generate video', { duration: 500 });
    assert.strictEqual(intent4.duration_seconds, 180, 'Duration above 180 must be clamped to 180s');

    console.log('✅ Test 10 Passed: Non-numeric duration inputs safely sanitized against NaN');
  }

  // ---------------------------------------------------------------------------
  // 11. Evidence Rule & Fallback State Propagation in CreativeDirector
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 11: Truthful Evidence State Propagation in CreativeDirector ---');
  {
    const director = new CreativeDirector();

    // Case A: No verified claims in evidence
    const planNoVerified = await director.planProduction({
      sourceMode: 'REPOSITORY_ANALYSIS_ONLY',
      intent: { duration_seconds: 30, content_type: 'social_short' },
      projectModel: {
        project: 'MockRepo',
        features: ['Experimental feature A', 'Experimental feature B']
      },
      evidenceData: { claims: [] }
    });

    const codeScene = planNoVerified.manifest.scenes.find(s => s.id === 'code_overview');
    assert.ok(codeScene, 'code_overview scene must exist');
    assert.notStrictEqual(codeScene.evidenceState, 'VERIFIED', 'Unverified feature fallbacks must NOT be marked VERIFIED');
    assert.strictEqual(codeScene.evidenceState, 'UNVERIFIED', 'Unverified feature fallback must have state UNVERIFIED');
    assert.strictEqual(codeScene.overlay.badge, 'CODE STRUCTURE', 'Overlay badge must not say VERIFIED CODE when unverified');

    // Case B: Verified claims in evidence
    const planWithVerified = await director.planProduction({
      sourceMode: 'REPOSITORY_ANALYSIS_ONLY',
      intent: { duration_seconds: 30, content_type: 'social_short' },
      projectModel: { project: 'MockRepo' },
      evidenceData: {
        claims: [
          { claim: 'TypeScript strict typing with zero runtime errors', state: 'VERIFIED' }
        ]
      }
    });

    const verifiedScene = planWithVerified.manifest.scenes.find(s => s.id === 'code_overview');
    assert.strictEqual(verifiedScene.evidenceState, 'VERIFIED', 'Verified claim must retain VERIFIED state');
    assert.strictEqual(verifiedScene.overlay.badge, 'VERIFIED CODE', 'Overlay badge should indicate VERIFIED CODE');

    console.log('✅ Test 11 Passed: Evidence Rule strictly enforced without false VERIFIED fallbacks');
  }

  // ---------------------------------------------------------------------------
  // 12. activePipelines Cleanup and Event Listener De-registration
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 12: activePipelines Memory Leak Prevention ---');
  {
    const serverJs = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    assert.ok(serverJs.includes('activePipelines.delete(projectId)'), 'Server explicitly deletes completed/failed pipelines');
    assert.ok(serverJs.includes('pipeline.removeListener'), 'Server unregisters event listeners upon completion/error');

    console.log('✅ Test 12 Passed: activePipelines entries and listeners are reliably cleaned up');
  }

  // ---------------------------------------------------------------------------
  // 13. ScreenRecorder CDP Screencast Backpressure
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 13: ScreenRecorder CDP Screencast Backpressure ---');
  {
    const srContent = fs.readFileSync(path.join(__dirname, '../../src/agents/screenRecorder.js'), 'utf8');
    assert.ok(srContent.includes("ffmpegProc.stdin.once('drain'"), 'ScreenRecorder waits for drain when stdin buffer is full');
    assert.ok(srContent.includes('const canWrite = ffmpegProc.stdin.write('), 'ScreenRecorder checks stdin.write return value for backpressure');

    console.log('✅ Test 13 Passed: CDP screencast backpressure handled before frame acknowledgment');
  }

  // ---------------------------------------------------------------------------
  // 14. TypeScript Configuration Coverage
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 14: TypeScript Configuration Coverage ---');
  {
    const tsconfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tsconfig.json'), 'utf8'));
    assert.strictEqual(tsconfig.compilerOptions.allowJs, true, 'tsconfig must enable allowJs');
    assert.ok(tsconfig.include.includes('src/**/*'), 'tsconfig must include src/**/*');
    assert.ok(tsconfig.include.includes('server.js'), 'tsconfig must include server.js');

    console.log('✅ Test 14 Passed: TypeScript configuration covers core source codebase');
  }

  // ---------------------------------------------------------------------------
  // 15. Silent Catch Blocks Elimination
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 15: Silent Catch Blocks Elimination ---');
  {
    const pipelineContent = fs.readFileSync(path.join(__dirname, '../../src/agents/pipeline.js'), 'utf8');
    assert.ok(pipelineContent.includes('[Pipeline] Failed to parse project_model.json'), 'pipeline.js logs warning on project_model failure');
    assert.ok(pipelineContent.includes('[Pipeline] Failed to parse discovery.json'), 'pipeline.js logs warning on discovery failure');

    const researcherContent = fs.readFileSync(path.join(__dirname, '../../src/agents/researcher.js'), 'utf8');
    assert.ok(researcherContent.includes('[Researcher] Sub-page exploration skipped'), 'researcher.js logs warning on subpage exploration error');

    console.log('✅ Test 15 Passed: Silent catch blocks replaced with informative warning logs');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 15 SECURITY, CORRECTNESS & ARCHITECTURE AUDIT TESTS PASSED!');
  console.log('===============================================================');
})().catch(err => {
  console.error('Audit verification test failed:', err);
  process.exit(1);
});
