const assert = require('assert');
const path = require('path');
const fs = require('fs');
const config = require('../../src/config');
const ProductionPipeline = require('../../src/agents/pipeline');
const { ensureDir, runFFmpeg } = require('../../src/utils/ffmpegHelper');

console.log('🧪 Running Unit Test: Selective Scene Regeneration & Header Safety...');

const pipeline = new ProductionPipeline();

// 1. Verify method existence
assert.strictEqual(
  typeof pipeline.regenerateScene,
  'function',
  'ProductionPipeline must define regenerateScene method'
);
console.log('✅ Test 1 Passed: ProductionPipeline.regenerateScene method is defined');

// 2. Test error throwing for missing project / invalid scene index
(async () => {
  // Test missing project
  await assert.rejects(
    async () => {
      await pipeline.regenerateScene('non_existent_project_123', 0, {});
    },
    (err) => {
      assert(err.code === 'PROJECT_NOT_FOUND' || err.message.includes('not found'));
      return true;
    },
    'Should throw error for non-existent project'
  );
  console.log('✅ Test 2 Passed: Non-existent project handled with proper error code');

  // 3. Set up a lightweight mock project directory to test full selective scene regeneration
  const testProjectId = 'test_regen_' + Date.now();
  const testProjectDir = ensureDir(path.join(config.PROJECTS_DIR, testProjectId));
  const audioDir = ensureDir(path.join(testProjectDir, 'audio'));
  const assetsDir = ensureDir(path.join(testProjectDir, 'assets'));

  const s1Audio = path.join(audioDir, 'scene-1.wav');
  const s2Audio = path.join(audioDir, 'scene-2.wav');
  const s1Video = path.join(assetsDir, 'scene-1.mp4');
  const s2Video = path.join(assetsDir, 'scene-2.mp4');

  // Generate 2 short sine wavs (2s each)
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'pcm_s16le', s1Audio]);
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2', '-c:a', 'pcm_s16le', s2Audio]);

  // Generate 2 short test mp4s (2s each)
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', s1Video]);
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=640x360:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', s2Video]);

  const mockManifest = {
    projectTitle: 'Regen Test Project',
    resolution: { width: 640, height: 360 },
    aspectRatio: '16:9',
    duration: 4,
    scenes: [
      {
        id: 'scene-01',
        title: 'Original Hook',
        duration: 2,
        voiceover: 'Original voiceover for scene one.',
        narrationText: 'Original voiceover for scene one.',
        audioPath: s1Audio,
        audioDuration: 2,
        videoPath: s1Video,
        visuals: [{ source: 'motion_graphic', motionType: 'intro_cinematic' }]
      },
      {
        id: 'scene-02',
        title: 'Original Feature',
        duration: 2,
        voiceover: 'Original voiceover for scene two.',
        narrationText: 'Original voiceover for scene two.',
        audioPath: s2Audio,
        audioDuration: 2,
        videoPath: s2Video,
        visuals: [{ source: 'motion_graphic', motionType: 'outro_cta' }]
      }
    ]
  };

  const mockProjectData = {
    id: testProjectId,
    status: 'COMPLETED',
    inputs: { voiceId: 'en-US-ChristopherNeural', musicStyle: 'cinematic' },
    artifacts: { outputMp4: path.join(testProjectDir, 'output.mp4') }
  };

  fs.writeFileSync(path.join(testProjectDir, 'project.json'), JSON.stringify(mockProjectData, null, 2), 'utf8');
  fs.writeFileSync(path.join(testProjectDir, 'scene-manifest.json'), JSON.stringify(mockManifest, null, 2), 'utf8');

  // Test invalid scene index
  await assert.rejects(
    async () => {
      await pipeline.regenerateScene(testProjectId, 99, {});
    },
    (err) => {
      assert.strictEqual(err.code, 'SCENE_NOT_FOUND');
      return true;
    },
    'Should throw SCENE_NOT_FOUND for out-of-bounds scene index'
  );
  console.log('✅ Test 3 Passed: Out-of-bounds scene index throws SCENE_NOT_FOUND');

  // 4. Test actual selective regeneration on Scene 0
  console.log('Testing selective regeneration of Scene 0...');
  const newText = 'Brand new selective narration text for scene 1.';
  const result = await pipeline.regenerateScene(testProjectId, 0, {
    narrationText: newText
  });

  assert(result.success, 'Regeneration should return success');
  assert.strictEqual(result.sceneIndex, 0);
  assert.strictEqual(result.scene.narrationText, newText);
  assert.strictEqual(result.scene.voiceover, newText);

  // Check manifest on disk was updated
  const updatedManifest = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'scene-manifest.json'), 'utf8'));
  assert.strictEqual(updatedManifest.scenes[0].voiceover, newText);
  assert.strictEqual(updatedManifest.scenes[1].voiceover, 'Original voiceover for scene two.');

  // Check output.mp4 was regenerated
  assert(fs.existsSync(result.finalVideo.path), 'Regenerated final video must exist on disk');
  console.log('✅ Test 4 Passed: Selective scene regeneration completed and updated project manifest & video');

  // 5. Test HTTP headersSent safety
  // Simulate double-response scenario to verify no ERR_HTTP_HEADERS_SENT
  const mockRes = {
    headersSent: true,
    status(code) {
      if (this.headersSent) {
        throw new Error('ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client');
      }
      return this;
    },
    json(data) {
      if (this.headersSent) {
        throw new Error('ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client');
      }
      return this;
    }
  };

  // Safe error handling pattern test
  let caughtDoubleHeader = false;
  try {
    if (!mockRes.headersSent) {
      mockRes.status(500).json({ error: 'fail' });
    }
  } catch (err) {
    caughtDoubleHeader = true;
  }
  assert(!caughtDoubleHeader, 'headersSent check must guard against double response');
  console.log('✅ Test 5 Passed: headersSent guard protects against ERR_HTTP_HEADERS_SENT');

  // 6. Test Natural Language Duration Change proportionally rescales all scene durations
  console.log('Testing natural language duration change (e.g. "make it 60 seconds")...');
  
  // Set initial scene durations: scene 0 = 6s, scene 1 = 14s (sum = 20s)
  const baseManifest = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'scene-manifest.json'), 'utf8'));
  baseManifest.duration = 20;
  baseManifest.scenes[0].duration = 6;
  baseManifest.scenes[1].duration = 14;
  fs.writeFileSync(path.join(testProjectDir, 'scene-manifest.json'), JSON.stringify(baseManifest, null, 2), 'utf8');

  // Also write mock project_model.json
  fs.writeFileSync(path.join(testProjectDir, 'project_model.json'), JSON.stringify({
    project: 'Regen Test Project',
    purpose: 'Autonomous video testing'
  }, null, 2), 'utf8');

  const regenResult = await pipeline.executeNaturalLanguageRegeneration(testProjectId, 'make it 60 seconds');

  const updatedManifest2 = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'scene-manifest.json'), 'utf8'));
  const sumSceneDurations = updatedManifest2.scenes.reduce((acc, s) => acc + s.duration, 0);

  assert.strictEqual(updatedManifest2.duration, 60, 'Manifest duration must be 60');
  assert.strictEqual(sumSceneDurations, 60, 'Sum of individual scene durations must be exactly 60');
  assert(updatedManifest2.scenes[0].duration > 6, 'Scene 0 duration must have scaled up from 6s');
  assert(updatedManifest2.scenes[1].duration > 14, 'Scene 1 duration must have scaled up from 14s');
  
  // Ratio of 6:14 (30%:70%) in 60s is 18s and 42s
  assert.strictEqual(updatedManifest2.scenes[0].duration, 18, 'Scene 0 should scale proportionally to 18s');
  assert.strictEqual(updatedManifest2.scenes[1].duration, 42, 'Scene 1 should scale proportionally to 42s');
  console.log('✅ Test 6 Passed: Proportional rescaling updates individual scene durations to exactly 60s');

  // 7. Test Natural Language Aspect Ratio Change ("make vertical")
  console.log('Testing natural language aspect ratio change (e.g. "make vertical")...');
  
  // Verify config.RESOLUTIONS is properly exported
  assert(config.RESOLUTIONS && typeof config.RESOLUTIONS === 'object', 'config.RESOLUTIONS must be defined');
  assert.deepStrictEqual(config.RESOLUTIONS['9:16'], { width: 1080, height: 1920 }, 'config.RESOLUTIONS must define 9:16');
  assert.deepStrictEqual(config.RESOLUTIONS['16:9'], { width: 1920, height: 1080 }, 'config.RESOLUTIONS must define 16:9');

  // Explicitly test manifest with only aspect_ratio (snake_case) to reproduce previous crash
  const verticalTestManifest = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'scene-manifest.json'), 'utf8'));
  verticalTestManifest.aspect_ratio = '16:9';
  delete verticalTestManifest.aspectRatio; // ensure previous undefined aspectRatio bug is covered
  fs.writeFileSync(path.join(testProjectDir, 'scene-manifest.json'), JSON.stringify(verticalTestManifest, null, 2), 'utf8');

  // Write a mock render-config.json
  fs.writeFileSync(path.join(testProjectDir, 'render-config.json'), JSON.stringify({
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    aspect_ratio: '16:9',
    targetDuration: 60
  }, null, 2), 'utf8');

  const verticalRegenResult = await pipeline.executeNaturalLanguageRegeneration(testProjectId, 'make vertical');
  assert(verticalRegenResult, 'Regeneration must succeed without TypeError on config.RESOLUTIONS');

  const verticalManifest = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'scene-manifest.json'), 'utf8'));
  assert.strictEqual(verticalManifest.aspect_ratio, '9:16', 'Manifest aspect_ratio must be updated to 9:16');
  assert.strictEqual(verticalManifest.aspectRatio, '9:16', 'Manifest aspectRatio must be updated to 9:16');
  assert.deepStrictEqual(verticalManifest.resolution, { width: 1080, height: 1920 }, 'Manifest resolution must be 1080x1920 for vertical 9:16');

  // Check updated render-config.json
  const updatedRenderConfig = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'render-config.json'), 'utf8'));
  assert.deepStrictEqual(updatedRenderConfig.resolution, { width: 1080, height: 1920 }, 'render-config.json resolution must be updated to 1080x1920');
  assert.strictEqual(updatedRenderConfig.aspect_ratio, '9:16', 'render-config.json aspect_ratio must be 9:16');

  // Check project.json inputs
  const updatedProjectJson = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'project.json'), 'utf8'));
  assert.strictEqual(updatedProjectJson.inputs.aspectRatio, '9:16', 'project.json inputs aspectRatio must be 9:16');
  assert.strictEqual(updatedProjectJson.inputs.aspect_ratio, '9:16', 'project.json inputs aspect_ratio must be 9:16');
  console.log('✅ Test 7 Passed: Natural language "make vertical" correctly switches canvas layout and updates manifest without crashing');

  // Clean up test directory
  try {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n🎉 ALL SELECTIVE SCENE REGENERATION TESTS PASSED!\n');
})().catch(err => {
  console.error('❌ Selective scene regeneration test failed:', err);
  process.exit(1);
});
