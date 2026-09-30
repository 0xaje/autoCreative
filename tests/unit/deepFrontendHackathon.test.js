const assert = require('assert');
const CreativeDirector = require('../../src/agents/creativeDirector');
const EvidenceEngine = require('../../src/agents/evidenceEngine');
const MotionDesigner = require('../../src/agents/motionDesigner');
const ProductDemonstrator = require('../../src/agents/productDemonstrator');

console.log('🧪 Running Unit Test: Deep Frontend Hackathon & Evidence Engine...');

const director = new CreativeDirector();
const evidenceEngine = new EvidenceEngine();
const motionDesigner = new MotionDesigner();
const demonstrator = new ProductDemonstrator();

// 1. Test Evidence Engine with Feature Cards & Key Metrics
const mockLiveData = {
  url: 'https://zk-rollup.example.com',
  title: 'ZK-Rollup Engine',
  headings: ['Next-Gen Cryptography', 'Architecture'],
  featureCards: [
    { title: 'Recursive SNARK Engine', description: 'Generates verified cryptographic proofs in under 2 seconds' },
    { title: 'Decentralized Sequencer', description: 'Coordinates distributed transaction batching with zero downtime' }
  ],
  keyMetrics: [
    { value: '1.8s', label: 'Prover Latency' },
    { value: '10,000 TPS', label: 'Network Throughput' }
  ],
  buttons: [{ text: 'Launch Prover', role: 'button' }]
};

const evidenceReport = evidenceEngine.classifyEvidence({
  sourceMode: 'LIVE_URL',
  liveData: mockLiveData
});

assert(evidenceReport.verifiedCount >= 4, `Expected at least 4 verified claims, got ${evidenceReport.verifiedCount}`);
const hasCardClaim = evidenceReport.claims.some(e => e.claim.includes('Recursive SNARK Engine') && e.state === 'VERIFIED');
assert(hasCardClaim, 'Feature card should produce a verified claim');
const hasMetricClaim = evidenceReport.claims.some(e => e.claim.includes('1.8s Prover Latency') && e.state === 'VERIFIED');
assert(hasMetricClaim, 'Key metric should produce a verified claim');
console.log('✅ Test 1 Passed: Evidence Engine classifies feature cards and telemetry metrics as VERIFIED');

// 2. Test Creative Director Scene Planning with Deep Project Model
const projectModel = {
  project: 'ZK-Rollup Engine',
  purpose: 'Lightning-fast zero knowledge proving system for scalable blockchains',
  problem: 'Prohibitive cryptographic proof generation costs and latency',
  sourceMode: 'LIVE_URL',
  featureCards: mockLiveData.featureCards,
  keyMetrics: mockLiveData.keyMetrics,
  visualAssets: { hero: 'hero.png', features: 'features.png' }
};

// Test 60s (5 scenes)
const scenes60 = director.buildSceneList({
  sourceMode: 'LIVE_URL',
  contentType: 'demo',
  totalDuration: 60,
  productName: projectModel.project,
  tagline: projectModel.purpose,
  problem: projectModel.problem,
  f1: mockLiveData.featureCards[0].title,
  f2: mockLiveData.featureCards[1].title,
  f3: 'Enterprise Cryptography',
  featureCards: projectModel.featureCards,
  keyMetrics: projectModel.keyMetrics,
  visualAssets: projectModel.visualAssets,
  projectModel
});

assert.strictEqual(scenes60.reduce((acc, s) => acc + s.duration, 0), 60, 'Durations must sum to 60s');
const fullScript60 = scenes60.map(s => s.voiceover).join(' ');
assert(fullScript60.includes('Recursive SNARK Engine'), 'Voiceover must mention Recursive SNARK Engine');
assert(fullScript60.includes('Prover Latency') || fullScript60.includes('1.8s'), 'Voiceover must mention real metric');
assert(fullScript60.includes('cryptographic proof generation costs') || fullScript60.includes('Prohibitive'), 'Voiceover must address real problem');
console.log('✅ Test 2 Passed: Creative Director builds substantive pitch referencing cards, metrics, and problem (60s)');

// Test 180s Broadcast Presentation (7 scenes)
const scenes180 = director.buildSceneList({
  sourceMode: 'LIVE_URL',
  contentType: 'demo',
  totalDuration: 180,
  productName: projectModel.project,
  tagline: projectModel.purpose,
  problem: projectModel.problem,
  f1: mockLiveData.featureCards[0].title,
  f2: mockLiveData.featureCards[1].title,
  f3: 'Enterprise Cryptography',
  featureCards: projectModel.featureCards,
  keyMetrics: projectModel.keyMetrics,
  visualAssets: projectModel.visualAssets,
  projectModel
});

assert.strictEqual(scenes180.reduce((acc, s) => acc + s.duration, 0), 180, 'Durations must sum to 180s');
assert.strictEqual(scenes180.length, 7, 'Must plan 7 scenes for 180s duration');
const fullScript180 = scenes180.map(s => s.voiceover).join(' ');
assert(fullScript180.includes('Recursive SNARK Engine'), '180s voiceover must include feature card 0');
assert(fullScript180.includes('Decentralized Sequencer'), '180s voiceover must include feature card 1');
console.log('✅ Test 3 Passed: Creative Director plans 7-scene broadcast presentation referencing cards and telemetry (180s)');

// 3. Test Motion Designer Dynamic HTML (No Hardcoded Tooling Copy)
const problemSolutionHtml = motionDesigner.generateMotionHtml({
  motionType: 'problem_solution_split',
  scene: scenes60[1],
  sourceAnalysis: projectModel,
  width: 1920,
  height: 1080
});

assert(!problemSolutionHtml.includes('screen recorders'), 'Must not contain old hardcoded screen recorder text');
assert(problemSolutionHtml.includes(projectModel.problem), 'Must render actual extracted problem in challenge column');
assert(problemSolutionHtml.includes(projectModel.project), 'Must render actual project name in solution column');

const cardFlowHtml = motionDesigner.generateMotionHtml({
  motionType: 'feature_card_flow',
  scene: scenes60[3],
  sourceAnalysis: projectModel,
  width: 1920,
  height: 1080
});

assert(cardFlowHtml.includes('Recursive SNARK Engine'), 'Must render real card title');
assert(cardFlowHtml.includes('cryptographic proofs'), 'Must render real card description');
console.log('✅ Test 4 Passed: Motion Designer procedurally renders authentic problem/solution and feature cards');

// 4. Test Product Demonstrator Dynamic Targeting
const primaryActions = demonstrator.planInteraction(scenes60[2], projectModel);
const deepActions = demonstrator.planInteraction({ ...scenes60[3], visualPlan: { interaction: 'deep_dive_flow' } }, projectModel);

// Primary action highlights discovered metrics or buttons
const hlAction = primaryActions.find(a => a.type === 'semantic_highlight');
assert(hlAction, 'Must have highlight action');

// Deep action types the real feature name, NOT "Production Stream Telemetry"
const typeAction = deepActions.find(a => a.type === 'semantic_type');
assert(typeAction, 'Must have type action');
assert.strictEqual(typeAction.text, 'Decentralized Sequencer', 'Must type real feature title, not hardcoded string');
assert(!typeAction.text.includes('Production Stream Telemetry'), 'Must not type hardcoded string');
console.log('✅ Test 5 Passed: Product Demonstrator plans dynamic interactions with real card titles and metrics');

console.log('\n🎉 ALL DEEP FRONTEND HACKATHON & EVIDENCE TESTS PASSED!\n');
