const assert = require('assert');
const EvidenceEngine = require('../../src/agents/evidenceEngine');

console.log('🧪 Running Unit Test: Evidence Engine Classification...');

const engine = new EvidenceEngine();

const sourceAnalysis = {
  name: 'Telemetry Hub',
  features: ['Live Event Streaming', 'Zero-Config Telemetry', 'Autonomous Scaling'],
  liveData: {
    headings: ['Real-Time Stream Processing', 'Live Event Streaming'],
    interactiveElements: [{ tag: 'BUTTON', text: 'Deploy Stream' }]
  },
  githubData: {
    features: ['Live Event Streaming']
  }
};

const evidenceReport = engine.classifyEvidence(sourceAnalysis);

// Assertions
assert(evidenceReport.claims.length > 0, 'Should classify claims from source analysis');
assert(evidenceReport.verifiedCount >= 1, 'Should verify at least one matching live element');

// Test Evidence Filter: UNVERIFIED claims must NEVER be included in verified narration claims
const unverifiedClaims = evidenceReport.claims.filter(c => c.state === 'UNVERIFIED');
const verifiedClaims = evidenceReport.claims.filter(c => c.state === 'VERIFIED');

assert(verifiedClaims.every(c => c.confidence >= 0.7), 'Verified claims must have >= 70% confidence');
assert(unverifiedClaims.every(c => c.confidence < 0.6), 'Unverified claims must have low confidence');

// Regression Test 1: Researcher returns structured button descriptor objects
console.log('🧪 Running Regression Test: Structured Button Descriptor Objects...');
const structuredButtonAnalysis = {
  name: 'PulseFlow Analytics',
  features: ['Automated Telemetry'],
  liveData: {
    headings: ['Automated Telemetry'],
    buttons: [
      { text: 'Export Metrics', id: 'btn-export', className: 'btn btn-secondary', selector: '#btn-export' },
      { text: 'Deploy Stream', id: 'btn-deploy', className: 'btn btn-primary', selector: '#btn-deploy' }
    ]
  },
  githubData: { detectedTech: ['Node.js'] }
};

const structuredReport = engine.classifyEvidence(structuredButtonAnalysis);
assert(structuredReport.claims.length > 0, 'Structured buttons should produce claims');
const exportClaim = structuredReport.claims.find(c => c.claim === 'Actionable: Export Metrics');
assert(exportClaim, 'Should generate clean Actionable claim from button object without [object Object]');
assert.strictEqual(exportClaim.state, 'VERIFIED', 'Button action claim should be VERIFIED');
console.log('✅ Regression Test Passed: Structured Button Descriptors processed without crash');

// Regression Test 2: Legacy string buttons
console.log('🧪 Running Regression Test: Legacy String Buttons...');
const legacyButtonAnalysis = {
  name: 'Legacy SaaS',
  features: ['Stream Pipelines'],
  liveData: {
    headings: ['Stream Pipelines'],
    buttons: ['Export Metrics', 'Deploy Stream']
  }
};

const legacyReport = engine.classifyEvidence(legacyButtonAnalysis);
assert(legacyReport.claims.length > 0, 'Legacy buttons should produce claims');
const legacyClaim = legacyReport.claims.find(c => c.claim === 'Actionable: Export Metrics');
assert(legacyClaim, 'Should generate clean Actionable claim from string button');
assert.strictEqual(legacyClaim.state, 'VERIFIED', 'Legacy button action claim should be VERIFIED');
console.log('✅ Regression Test Passed: Legacy String Buttons processed without crash');

console.log(`✅ Unit Test Passed: Evidence Engine (${evidenceReport.verifiedCount} verified, ${unverifiedClaims.length} unverified isolated)`);
