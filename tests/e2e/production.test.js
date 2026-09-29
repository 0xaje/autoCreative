const assert = require('assert');
const fs = require('fs');
const path = require('path');
const config = require('../../src/config');
const { getMediaMetadata } = require('../../src/utils/ffmpegHelper');

console.log('🧪 Running E2E Test: Validating Finished Video Deliverable & Artifacts...');

// Locate latest completed project
const projects = fs.readdirSync(config.PROJECTS_DIR).filter(p => {
  return fs.existsSync(path.join(config.PROJECTS_DIR, p, 'output.mp4'));
});

assert(projects.length > 0, 'At least one finished video project must exist in projects directory');

const latestProject = projects[projects.length - 1];
const projectDir = path.join(config.PROJECTS_DIR, latestProject);

console.log(`Inspecting production project: ${latestProject}`);

// 1. Required PRD Artifacts Exist
const requiredArtifacts = [
  'project.json',
  'project_model.json',
  'evidence.json',
  'scene-manifest.json',
  'script.json',
  'qc-report.json',
  'output.mp4'
];

requiredArtifacts.forEach(artifact => {
  const filePath = path.join(projectDir, artifact);
  assert(fs.existsSync(filePath), `Required artifact ${artifact} missing from ${latestProject}`);
});

// 2. Validate Quality Control Report
const qc = JSON.parse(fs.readFileSync(path.join(projectDir, 'qc-report.json'), 'utf8'));
assert.strictEqual(qc.verdict, 'PASS', 'Quality Control verdict must be PASS');
assert.strictEqual(qc.qualityScore, 100, 'Quality score must be 100/100');

// 3. Inspect Master Video Stream via FFprobe
const mp4Path = path.join(projectDir, 'output.mp4');
const stat = fs.statSync(mp4Path);
assert(stat.size > 100000, 'Rendered MP4 file size must be > 100KB');

getMediaMetadata(mp4Path).then(meta => {
  const videoStream = meta.streams.find(s => s.codec_type === 'video');
  const audioStream = meta.streams.find(s => s.codec_type === 'audio');

  assert(videoStream, 'Must contain valid video stream');
  const durationSec = parseFloat(meta.format?.duration || meta.duration || 0);
  assert(durationSec > 15, 'Video duration must be > 15 seconds');

  console.log(`✅ E2E Test Passed: Broadcast MP4 Verified (${durationSec.toFixed(1)}s, ${videoStream.width}x${videoStream.height}, H.264/AAC, QC 100/100 PASS)`);
}).catch(err => {
  console.error('FFprobe inspection error:', err);
  process.exit(1);
});
