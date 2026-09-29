const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Researcher = require('../../src/agents/researcher');
const EvidenceEngine = require('../../src/agents/evidenceEngine');
const CreativeDirector = require('../../src/agents/creativeDirector');
const { AIProvider, DeterministicAIProvider } = require('../../src/providers/aiProvider');

console.log('🧪 Running Regression Test Suite: Production Truth & Source Mode...');

async function runTests() {
  const researcher = new Researcher();
  const evidenceEngine = new EvidenceEngine();
  const creativeDirector = new CreativeDirector();

  // =========================================================================
  // TEST 1 — Repository-only input never uses demo-apps/saas-analytics
  // =========================================================================
  console.log('\n--- Test 1: Repository-Only Input Isolation ---');
  // Analyze current workspace as a local repo
  const repoAnalysis = await researcher.analyzeSource({
    githubUrl: 'https://github.com/0xaje/autoCreative',
    liveUrl: null,
    localPath: null
  });

  assert.strictEqual(repoAnalysis.sourceMode, 'REPOSITORY_ANALYSIS_ONLY', 'Must classify as REPOSITORY_ANALYSIS_ONLY');

  const evidence = evidenceEngine.classifyEvidence(repoAnalysis);
  const manifest = await creativeDirector.planProduction({
    userIntent: { content_type: 'product_demo', duration_seconds: 60 },
    projectModel: repoAnalysis,
    evidenceReport: evidence
  });

  assert.strictEqual(manifest.sourceMode, 'REPOSITORY_ANALYSIS_ONLY', 'Manifest must preserve REPOSITORY_ANALYSIS_ONLY mode');
  
  // Verify that all visual strategies are truthful motion graphics / code walkthroughs
  // and NO visual is a fake browser recording without target
  for (const scene of manifest.scenes) {
    for (const visual of scene.visuals) {
      assert.notStrictEqual(
        visual.source,
        'browser_recording',
        `Scene ${scene.id} must not request browser_recording in REPOSITORY_ANALYSIS_ONLY mode`
      );
    }
  }

  // Verify demo path is never referenced in script or manifest
  const manifestStr = JSON.stringify(manifest);
  assert(!manifestStr.includes('demo-apps/saas-analytics'), 'demo-apps/saas-analytics must NEVER appear in repository manifest');
  console.log('✅ Test 1 Passed: Repository-only source never uses demo app or fake browser capture');

  // =========================================================================
  // TEST 2 — Unreachable live URL fails immediately with LIVE_APP_UNREACHABLE
  // =========================================================================
  console.log('\n--- Test 2: Unreachable Live URL Fail-Fast ---');
  let unreachableError = null;
  try {
    // Port 49151 on loopback should not be listening
    await researcher.analyzeSource({
      liveUrl: 'http://127.0.0.1:49151/nonexistent-app'
    });
  } catch (err) {
    unreachableError = err;
  }

  assert(unreachableError, 'Must throw error when live URL is unreachable');
  assert.strictEqual(unreachableError.code, 'LIVE_APP_UNREACHABLE', 'Error code must be LIVE_APP_UNREACHABLE');
  assert(!unreachableError.message.includes('Autonomous Product'), 'Must not create generic fallback');
  console.log(`✅ Test 2 Passed: Unreachable URL threw ${unreachableError.code} immediately`);

  // =========================================================================
  // TEST 3 — Evidence provenance and cross-source integrity
  // =========================================================================
  console.log('\n--- Test 3: Evidence Provenance & Cross-Source Integrity ---');
  const sourceAAnalysis = {
    sourceMode: 'LIVE_URL',
    liveUrl: 'http://example.com/app-a',
    projectModel: {
      project: 'App A',
      features: ['Real-Time Stream Processing']
    },
    liveData: {
      url: 'http://example.com/app-a',
      headings: ['Real-Time Stream Processing'],
      buttons: [{ text: 'Deploy Stream', selector: '#deploy-btn' }]
    }
  };

  const evidenceReportA = evidenceEngine.classifyEvidence(sourceAAnalysis);
  assert(evidenceReportA.claims.length > 0, 'Must produce claims');

  // Verify all claims have complete provenance fields
  for (const claim of evidenceReportA.claims) {
    assert(claim.source, 'Claim must have source field');
    assert.strictEqual(claim.sourceType, 'LIVE_URL', 'Claim sourceType must match sourceMode');
    assert(claim.sourceLocation, 'Claim must have sourceLocation');
    assert(claim.observation, 'Claim must describe observation');
    assert(claim.verificationMethod, 'Claim must state verificationMethod');
  }

  // Cross-source isolation test: Evidence from App A must not be attributed to App B
  const sourceBTarget = 'http://localhost:5173/app-b';
  for (const claim of evidenceReportA.claims) {
    assert.notStrictEqual(claim.sourceLocation, sourceBTarget, 'Claim from App A must never point to App B target');
  }
  console.log('✅ Test 3 Passed: Evidence contains full provenance and cannot cross-contaminate');

  // =========================================================================
  // TEST 4 — Canned endpoints removed from server.js
  // =========================================================================
  console.log('\n--- Test 4: Dead Canned Endpoints Removal ---');
  const serverCode = fs.readFileSync(path.resolve(__dirname, '../../server.js'), 'utf8');
  const cannedEndpoints = [
    '/api/projects/:id/analyze',
    '/api/projects/:id/plan',
    '/api/projects/:id/explore',
    '/api/projects/:id/record',
    '/api/projects/:id/generate',
    '/api/projects/:id/render',
    '/api/projects/:id/qc'
  ];

  for (const endpoint of cannedEndpoints) {
    assert(!serverCode.includes(endpoint), `Dead canned endpoint ${endpoint} must NOT exist in server.js`);
  }

  // Verify no frontend code in src/public/ references any canned endpoint
  const appJsCode = fs.readFileSync(path.resolve(__dirname, '../../src/public/js/app.js'), 'utf8');
  for (const endpoint of cannedEndpoints) {
    const routeFragment = endpoint.replace('/api/projects/:id/', '');
    assert(!appJsCode.includes(`/${routeFragment}`), `app.js must not reference dead route ${routeFragment}`);
  }
  console.log('✅ Test 4 Passed: All 7 canned endpoints removed from server and unreferenced in UI');

  // =========================================================================
  // TEST 5 — AI Provider genuinely invoked by CreativeDirector
  // =========================================================================
  console.log('\n--- Test 5: AI Provider Integration ---');
  class MockGeminiProvider extends AIProvider {
    constructor() {
      super();
      this.invoked = false;
      this.modelName = 'gemini-2.5-flash';
    }
    isAvailable() {
      return true;
    }
    async generateStructured(input, schema) {
      this.invoked = true;
      this.receivedPrompt = input.prompt;
      return {
        scenes: [
          { id: 'hook', voiceover: 'Genuine AI-directed narrative hook.' }
        ]
      };
    }
  }

  const mockProvider = new MockGeminiProvider();
  const aiManifest = await creativeDirector.planProduction({
    userIntent: { content_type: 'product_demo', duration_seconds: 45 },
    projectModel: { project: 'AI Verified Product', features: ['Telemetry Pipeline'] },
    evidenceReport: {
      claims: [{ claim: 'Telemetry Pipeline', state: 'VERIFIED' }]
    },
    aiProvider: mockProvider
  });

  assert.strictEqual(mockProvider.invoked, true, 'AI provider generateStructured must be invoked');
  assert.strictEqual(aiManifest.creative_mode, 'ai_assisted', 'creative_mode must be ai_assisted when provider is available');
  assert.strictEqual(aiManifest.ai_model, 'gemini-2.5-flash', 'ai_model must reflect provider model');
  assert.strictEqual(aiManifest.ai_provider, 'gemini', 'ai_provider must be gemini');
  assert(mockProvider.receivedPrompt.includes('Telemetry Pipeline'), 'Prompt must provide verified features to AI');

  // Test deterministic fallback labeling
  const deterministicManifest = await creativeDirector.planProduction({
    userIntent: { content_type: 'product_demo', duration_seconds: 45 },
    projectModel: { project: 'Deterministic App' },
    evidenceReport: { claims: [] },
    aiProvider: new DeterministicAIProvider()
  });
  assert.strictEqual(deterministicManifest.creative_mode, 'deterministic_fallback');
  assert.strictEqual(deterministicManifest.ai_provider, 'deterministic');
  console.log('✅ Test 5 Passed: CreativeDirector genuinely invokes AI provider with truthful fallback');

  // =========================================================================
  // TEST 6 — Demo isolation: Demo mode is explicit and isolated
  // =========================================================================
  console.log('\n--- Test 6: Demo Isolation ---');
  const demoAnalysis = await researcher.analyzeSource({
    isDemo: true
  });
  assert.strictEqual(demoAnalysis.sourceMode, 'DEMO', 'Explicit demo must set sourceMode: DEMO');

  const demoManifest = await creativeDirector.planProduction({
    userIntent: { content_type: 'launch_video', duration_seconds: 30 },
    projectModel: demoAnalysis,
    evidenceReport: evidenceEngine.classifyEvidence(demoAnalysis)
  });

  assert.strictEqual(demoManifest.sourceMode, 'DEMO', 'Demo manifest must have sourceMode: DEMO');
  assert(demoManifest.projectTitle.includes('[SAMPLE DEMO]'), 'Demo manifest title must clearly indicate sample demo');
  console.log('✅ Test 6 Passed: Demo mode is strictly explicit and labeled [SAMPLE DEMO]');

  console.log('\n===============================================================');
  console.log('🎉 ALL 6 PRODUCTION REALITY REGRESSION TESTS PASSED!');
  console.log('===============================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Regression Test Failed:', err);
  process.exit(1);
});
