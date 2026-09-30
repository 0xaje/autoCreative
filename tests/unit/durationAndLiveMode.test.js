const assert = require('assert');
const CreativeDirector = require('../../src/agents/creativeDirector');
const AudioEngineer = require('../../src/agents/audioEngineer');
const { ensureDir, getVideoMetadata } = require('../../src/utils/ffmpegHelper');
const path = require('path');
const fs = require('fs');

console.log('🧪 Running Unit Test: Video Duration & Live Application Mode Precision...');

const director = new CreativeDirector();

async function runTests() {
  // Test 1: Verify exact timeline duration allocation across various durations (30s, 45s, 60s, 75s, 90s, 120s, 150s, 180s)
  const testDurations = [30, 45, 60, 75, 90, 120, 150, 180];

  for (const dur of testDurations) {
    const scenes = director.buildSceneList({
      sourceMode: 'LIVE_URL',
      contentType: 'demo',
      totalDuration: dur,
      productName: 'RealApp',
      tagline: 'High-speed cloud engine',
      problem: 'Slow deployments',
      f1: 'Automated CI/CD',
      f2: 'Real-time telemetry',
      f3: 'Cluster autoscaling',
      customInstructions: '',
      isVertical: false
    });

    const sumDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
    assert.strictEqual(
      sumDuration,
      dur,
      `Scene durations must sum strictly to requested totalDuration (${dur}s), got ${sumDuration}s`
    );

    // Verify badges and labels have no demo traces on LIVE_URL
    for (const scene of scenes) {
      if (scene.overlay && scene.overlay.badge) {
        assert(!scene.overlay.badge.includes('DEMO'), `Scene ${scene.id} badge must not contain DEMO on LIVE_URL: got ${scene.overlay.badge}`);
      }
      if (scene.overlay) {
        assert(scene.overlay.color, `Scene ${scene.id} must have brand color`);
      }
    }
  }
  console.log('✅ Test 1 Passed: Scene durations sum strictly to targetDuration for 30s through 180s (3 min)');

  // Test 2: Verify project title formatting for LIVE_URL does not use "PRODUCT DEMO"
  const manifest60 = await director.planProduction({
    userIntent: { content_type: 'product_demo', duration_seconds: 60, aspect_ratio: '16:9' },
    projectModel: { project: 'ProductionApp', sourceMode: 'LIVE_URL' },
    evidenceReport: { claims: [] }
  });

  assert.strictEqual(manifest60.duration, 60, 'Manifest duration must be 60s');
  assert(!manifest60.projectTitle.includes('PRODUCT DEMO'), `Title must not say PRODUCT DEMO for live URL: got "${manifest60.projectTitle}"`);
  assert(manifest60.projectTitle.includes('LIVE WALKTHROUGH') || manifest60.projectTitle.includes('FEATURE SHOWCASE'), 'Title must use professional showcase terminology');
  console.log('✅ Test 2 Passed: Live URL project title uses LIVE WALKTHROUGH / FEATURE SHOWCASE');

  // Test 3: AudioEngineer paces and pads audio tracks to match full 60s timeline
  console.log('Testing AudioEngineer master mix pacing to 60s...');
  const testDir = path.resolve('artifacts/test_duration_mix');
  ensureDir(testDir);
  const audioDir = ensureDir(path.join(testDir, 'audio'));

  // Create 5 dummy scene voice audio files of varying short lengths (3s - 5s each)
  const scenes = [
    { id: 'hook', duration: 10, audioDuration: 3.5, audioPath: path.join(audioDir, 's1.wav') },
    { id: 'product_reveal', duration: 12, audioDuration: 4.2, audioPath: path.join(audioDir, 's2.wav') },
    { id: 'feature_1', duration: 16, audioDuration: 5.0, audioPath: path.join(audioDir, 's3.wav') },
    { id: 'feature_2', duration: 14, audioDuration: 4.8, audioPath: path.join(audioDir, 's4.wav') },
    { id: 'outro_cta', duration: 8, audioDuration: 3.2, audioPath: path.join(audioDir, 's5.wav') }
  ];

  const { runFFmpeg } = require('../../src/utils/ffmpegHelper');
  for (const s of scenes) {
    await runFFmpeg(['-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${s.audioDuration}`, '-c:a', 'pcm_s16le', s.audioPath]);
  }

  const audioEngineer = new AudioEngineer();
  const masterAudio = await audioEngineer.produceMasterAudio({
    scenes,
    totalDuration: 60,
    musicStyle: 'cinematic',
    projectDir: testDir
  });

  const masterMeta = await getVideoMetadata(masterAudio.masterMixPath);
  console.log(`Produced master mix duration: ${masterMeta.duration.toFixed(2)}s (Target: 60.0s)`);
  assert(Math.abs(masterMeta.duration - 60) < 1.0, `Master mix duration must be ~60s, got ${masterMeta.duration}`);
  console.log('✅ Test 3 Passed: AudioEngineer successfully produced full 60s soundtrack mix without premature cutoff');

  console.log('\n🎉 ALL DURATION & LIVE APPLICATION PRECISION TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
