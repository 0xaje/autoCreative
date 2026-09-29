const assert = require('assert');
const IntentEngine = require('../../src/agents/intentEngine');
const EvidenceEngine = require('../../src/agents/evidenceEngine');
const CreativeDirector = require('../../src/agents/creativeDirector');

console.log('🧪 Running Integration Test: Intelligence -> Evidence -> Manifest Flow...');

const intentEngine = new IntentEngine();
const evidenceEngine = new EvidenceEngine();
const creativeDirector = new CreativeDirector();

// 1. Parse prompt
const intent = intentEngine.parseIntent('Create a 45-second launch video demonstrating live application workflows.');

// 2. Classify evidence
const evidence = evidenceEngine.classifyEvidence({
  name: 'Golden SaaS Demo',
  features: ['Real-Time Analytics', 'Automated Event Ingestion'],
  liveData: {
    headings: ['Real-Time Analytics Dashboard'],
    interactiveElements: [{ tag: 'BUTTON', text: 'Launch Worker' }]
  }
});

(async () => {
  // 3. Plan production manifest
  const manifest = await creativeDirector.planProduction({
    intent,
    projectModel: {
      project: 'Golden SaaS Demo',
      purpose: 'Automated telemetry and real-time observability',
      problem: 'Fragmented log viewing'
    },
    evidenceReport: evidence
  });

  assert(manifest.scenes.length > 0, 'Must produce structured scenes');
  assert.strictEqual(manifest.duration, 45, 'Target duration must propagate to manifest');
  assert(manifest.scenes[0].type === 'hook', 'First scene must be hook');
  assert(manifest.scenes[manifest.scenes.length - 1].type === 'ending', 'Last scene must be ending');

  console.log('✅ Integration Test Passed: Intelligence -> Evidence -> Manifest Pipeline');
})().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
