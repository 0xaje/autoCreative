const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseFrameRate, getVideoMetadata } = require('../../src/utils/ffmpegHelper');

console.log('🧪 Running Unit Test: Safe Frame Rate Parsing & RCE Prevention (eval Elimination)...');

// 1. Valid frame rate strings emitted by standard encoders & ffprobe
const validRatios = [
  { input: '30/1', expected: 30 },
  { input: '25/1', expected: 25 },
  { input: '24/1', expected: 24 },
  { input: '60/1', expected: 60 },
  { input: '30000/1001', expected: 30000 / 1001 },
  { input: '24000/1001', expected: 24000 / 1001 },
  { input: '120/1', expected: 120 },
  { input: ' 30/1 ', expected: 30 },
  { input: '29.97', expected: 29.97 },
  { input: '60', expected: 60 }
];

for (const { input, expected } of validRatios) {
  const result = parseFrameRate(input);
  assert(result !== null, `Expected valid parsed frame rate for "${input}", got null`);
  assert(Math.abs(result - expected) < 0.0001, `Frame rate mismatch for "${input}": expected ${expected}, got ${result}`);
}
console.log(`✅ Test 1 Passed: All ${validRatios.length} standard video frame rates parsed with exact precision`);

// 2. Division-by-zero, invalid formats, and non-positive numbers
const invalidRatios = [
  '0/0',
  '0/1',
  '30/0',
  '-30/1',
  '30/-1',
  '',
  '   ',
  '30/1/2',
  'Infinity/1',
  'NaN/1',
  null,
  undefined,
  123,
  {},
  []
];

for (const input of invalidRatios) {
  const result = parseFrameRate(input);
  assert.strictEqual(result, null, `Input ${JSON.stringify(input)} must resolve to null, got: ${result}`);
}
console.log(`✅ Test 2 Passed: Division-by-zero, malformed formats, and non-positive inputs safely rejected as null`);

// 3. Malicious code injection payloads (RCE attack strings that would run under eval)
global.__eval_executed = false;

const maliciousPayloads = [
  'global.__eval_executed = true; 30/1',
  '(function(){ global.__eval_executed = true; return 30; })()',
  'require("child_process").execSync("id")',
  'process.exit(1)',
  '30/1; while(1){}',
  'this.constructor.constructor("return process")()',
  '1/1; fs.writeFileSync("/tmp/hacked", "1")',
  '__proto__.polluted = true',
  '1+1*console.log("hacked")'
];

for (const payload of maliciousPayloads) {
  const result = parseFrameRate(payload);
  assert.strictEqual(result, null, `Malicious payload must return null: ${payload}`);
  assert.strictEqual(global.__eval_executed, false, `Code injection payload executed in server process! Payload: ${payload}`);
}
console.log(`✅ Test 3 Passed: All ${maliciousPayloads.length} malicious code execution payloads blocked with zero execution`);

// 4. Static Code Analysis: Verify absence of eval() across ffmpegHelper.js
const ffmpegHelperSrc = fs.readFileSync(path.resolve(__dirname, '../../src/utils/ffmpegHelper.js'), 'utf8');
assert(!ffmpegHelperSrc.includes('eval('), 'src/utils/ffmpegHelper.js must not contain any eval() invocations');
assert(!ffmpegHelperSrc.includes('eval ('), 'src/utils/ffmpegHelper.js must not contain any eval () invocations');
assert(ffmpegHelperSrc.includes('parseFrameRate('), 'src/utils/ffmpegHelper.js must call parseFrameRate()');
console.log('✅ Test 4 Passed: Static analysis confirmed complete elimination of eval() in ffmpegHelper.js');

// 5. Real media file verification with getVideoMetadata
(async () => {
  const candidatePaths = [
    path.resolve(__dirname, '../../projects/proj_1790731120633/render/production-master.mp4'),
    path.resolve(__dirname, '../../projects/proj_1790731120633/final_output.mp4')
  ];
  const sampleVideoPath = candidatePaths.find(p => fs.existsSync(p));
  if (sampleVideoPath) {
    const meta = await getVideoMetadata(sampleVideoPath);
    assert(typeof meta.fps === 'number', `meta.fps must be a number, got: ${typeof meta.fps}`);
    assert(meta.fps > 0 && meta.fps <= 120, `meta.fps must be a valid video frame rate (e.g. ~30), got: ${meta.fps}`);
    console.log(`✅ Test 5 Passed: Real project video parsed safely with getVideoMetadata (computed fps: ${meta.fps.toFixed(2)})`);
  } else {
    console.log('ℹ️ Test 5 Skipped: No local project video deliverable found to inspect');
  }

  console.log('\n🎉 ALL SAFE FRAME RATE PARSING & RCE PREVENTION TESTS PASSED!\n');
})();
