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

console.log(`✅ Unit Test Passed: Evidence Engine (${evidenceReport.verifiedCount} verified, ${unverifiedClaims.length} unverified isolated)`);
