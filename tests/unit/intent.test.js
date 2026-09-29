const assert = require('assert');
const IntentEngine = require('../../src/agents/intentEngine');

console.log('🧪 Running Unit Test: Intent Engine Parsing...');

const engine = new IntentEngine();

// Test 1: Content type & duration
const intent1 = engine.parseIntent('Create a 60-second product launch video for investors.');
assert.strictEqual(intent1.content_type, 'launch_video', 'Should detect launch video');
assert.strictEqual(intent1.duration_seconds, 60, 'Should parse 60 seconds duration');
assert.strictEqual(intent1.audience, 'investors', 'Should detect investors audience');

// Test 2: Vertical aspect ratio & technical tone
const intent2 = engine.parseIntent('Make a vertical 30-second technical demo for developers on X.');
assert.strictEqual(intent2.aspect_ratio, '9:16', 'Should parse vertical 9:16 aspect ratio');
assert.strictEqual(intent2.duration_seconds, 30, 'Should parse 30 seconds');
assert.strictEqual(intent2.tone, 'technical', 'Should detect technical tone');
assert.strictEqual(intent2.audience, 'developers', 'Should detect developers audience');

// Test 3: Voice selection and PRD regeneration directives
const intent3 = engine.parseIntent('Make the opening stronger, show more of the dashboard, and use a female voice.');
assert.strictEqual(intent3.voice_preference, 'female_clear', 'Should detect female voice preference');
assert(intent3.custom_instructions.includes('enhance_hook'), 'Should include enhance_hook');
assert(intent3.custom_instructions.includes('show_more_dashboard'), 'Should include show_more_dashboard');

console.log('✅ Unit Test Passed: Intent Engine Parsing (3/3 assertions)');
