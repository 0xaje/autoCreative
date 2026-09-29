const assert = require('assert');
const CreativeDirector = require('../../src/agents/creativeDirector');

console.log('🧪 Running Unit Test: Creative Director Scene Manifest Planning...');

const director = new CreativeDirector();

const intent = {
  content_type: 'launch_video',
  duration_seconds: 60,
  aspect_ratio: '16:9',
  audience: 'developers',
  tone: 'technical',
  show_real_product: true
};

const projectModel = {
  project: 'PulseFlow',
  purpose: 'Real-time telemetry and distributed stream processing',
  problem: 'Slow manual metric inspection',
  target_user: 'Engineers'
};

const evidenceReport = {
  claims: [
    { claim: 'Live Event Streaming', state: 'VERIFIED', suggestedVisual: 'browser_recording' },
    { claim: 'Sub-Millisecond Execution', state: 'VERIFIED', suggestedVisual: 'motion_graphic' }
  ]
};

(async () => {
  const manifest = await director.planProduction({
    intent,
    projectModel,
    evidenceReport
  });

  assert(manifest.scenes.length >= 4, 'Manifest must have at least 4 scenes');
  assert.strictEqual(manifest.duration, 60, 'Total timeline duration must match requested duration');
  assert(manifest.scenes.some(s => s.type === 'product_demo'), 'Must include product demo scene');

  console.log(`✅ Unit Test Passed: Scene Manifest Planning (${manifest.scenes.length} scenes planned, ${manifest.duration}s target)`);
})().catch(err => {
  console.error('Scene manifest test failed:', err);
  process.exit(1);
});
