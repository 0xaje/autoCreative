const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const config = require('../config');
const { ensureDir } = require('../utils/ffmpegHelper');

const Researcher = require('./researcher');
const EvidenceEngine = require('./evidenceEngine');
const CreativeDirector = require('./creativeDirector');
const ScreenRecorder = require('./screenRecorder');
const VoiceProducer = require('./voiceProducer');
const MotionDesigner = require('./motionDesigner');
const AudioEngineer = require('./audioEngineer');
const VideoEditor = require('./videoEditor');
const QualityController = require('./qualityController');

class ProductionPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;

    this.researcher = new Researcher();
    this.evidenceEngine = new EvidenceEngine();
    this.creativeDirector = new CreativeDirector();
    this.screenRecorder = new ScreenRecorder();
    this.voiceProducer = new VoiceProducer();
    this.motionDesigner = new MotionDesigner();
    this.audioEngineer = new AudioEngineer();
    this.videoEditor = new VideoEditor();
    this.qualityController = new QualityController();
  }

  /**
   * Execute full end-to-end autonomous video production pipeline
   */
  async runPipeline({
    projectId,
    githubUrl,
    liveUrl,
    localPath,
    prompt,
    mode = 'launch',
    duration = 60,
    aspectRatio = '16:9',
    voiceId = 'en-US-ChristopherNeural',
    musicStyle = 'cinematic'
  }) {
    const id = projectId || `proj_${Date.now()}`;
    const projectDir = ensureDir(path.join(config.PROJECTS_DIR, id));

    const projectData = {
      id,
      createdAt: new Date().toISOString(),
      status: 'PROCESSING',
      inputs: {
        githubUrl: githubUrl || null,
        liveUrl: liveUrl || null,
        localPath: localPath || null,
        prompt: prompt || 'Professional product presentation video showcasing key capabilities',
        mode,
        duration: parseInt(duration, 10) || 60,
        aspectRatio,
        voiceId,
        musicStyle
      },
      currentStage: 'INITIALIZING',
      progressPercent: 5,
      artifacts: {
        projectJson: path.join(projectDir, 'project.json'),
        sourceAnalysis: null,
        evidence: null,
        sceneManifest: null,
        script: null,
        outputMp4: null,
        qcReport: null
      },
      logs: []
    };

    const log = (agent, message, percent) => {
      const entry = { timestamp: new Date().toISOString(), agent, message };
      projectData.logs.push(entry);
      if (percent) projectData.progressPercent = percent;
      projectData.currentStage = agent.toUpperCase();
      this.emit('progress', { projectId: id, agent, message, percent: projectData.progressPercent });
      fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectData, null, 2), 'utf8');
    };

    try {
      log('Creative Director', `Initiating Autonomous Studio Pipeline for Project [${id}]...`, 8);

      // Stage 1: Researcher (UNDERSTAND)
      log('Researcher', 'Scanning repository code, documentation, and live interface...', 15);
      const sourceAnalysis = await this.researcher.analyzeSource({
        githubUrl,
        liveUrl,
        localPath,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });
      projectData.artifacts.sourceAnalysis = path.join(projectDir, 'source-analysis.json');

      // Stage 2: Evidence Engine (EVIDENCE RULE)
      log('Evidence Engine', 'Cross-referencing claims against live DOM elements and codebase...', 25);
      const evidenceSummary = this.evidenceEngine.processEvidence(sourceAnalysis, projectDir);
      projectData.artifacts.evidence = path.join(projectDir, 'evidence.json');
      projectData.evidenceSummary = {
        total: evidenceSummary.totalClaims,
        verified: evidenceSummary.verifiedCount,
        partial: evidenceSummary.partialCount,
        unverified: evidenceSummary.unverifiedCount,
        future: evidenceSummary.futureCount
      };
      log('Evidence Engine', `Identified ${evidenceSummary.verifiedCount} verified features. Unverified claims excluded.`, 30);

      // Stage 3: Creative Director (PLAN)
      log('Creative Director', `Drafting story arc, scenes, and narration script for [${mode.toUpperCase()}] mode...`, 35);
      const { manifest, script } = this.creativeDirector.planProduction({
        userPrompt: prompt,
        mode,
        targetDuration: projectData.inputs.duration,
        aspectRatio,
        sourceAnalysis,
        evidenceSummary,
        projectDir
      });
      projectData.artifacts.sceneManifest = path.join(projectDir, 'scene-manifest.json');
      projectData.artifacts.script = path.join(projectDir, 'script.json');
      projectData.manifest = manifest;

      // Stage 4: Scene Production (RECORD & GENERATE)
      // For each scene: record or render visual footage + synthesize voiceover
      let targetUrl = liveUrl;
      if (!targetUrl && localPath) {
        const resolved = path.resolve(localPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          const indexHtml = path.join(resolved, 'index.html');
          if (fs.existsSync(indexHtml)) {
            targetUrl = `file://${indexHtml}`;
          } else {
            targetUrl = `file://${resolved}`;
          }
        } else {
          targetUrl = `file://${resolved}`;
        }
      }
      if (!targetUrl) {
        targetUrl = `file://${path.resolve(config.DEMO_APPS_DIR, 'saas-analytics', 'index.html')}`;
      }
      const resolution = manifest.resolution;
      const completedScenes = [];

      const scenesTotal = manifest.scenes.length;
      let sceneStep = 0;

      for (const scene of manifest.scenes) {
        sceneStep++;
        const baseScenePct = 40 + Math.round((sceneStep / scenesTotal) * 30);

        log('Voice Producer', `Synthesizing neural speech for Scene ${sceneStep}/${scenesTotal}: "${scene.title}"...`, baseScenePct - 2);
        const voiceResult = await this.voiceProducer.produceSceneVoice({
          scene,
          voiceId,
          projectDir,
          onProgress: (p) => log(p.agent, p.message)
        });

        scene.audioPath = voiceResult.audioPath;
        scene.subtitlesPath = voiceResult.subtitlesPath;
        scene.audioDuration = voiceResult.duration;
        scene.subtitles = voiceResult.subtitles;

        if (scene.type === 'screen_recording') {
          log('Screen Recorder', `Launching Chrome & capturing live footage for Scene ${sceneStep}: "${scene.title}"...`, baseScenePct);
          const recordingResult = await this.screenRecorder.recordSceneFootage({
            scene,
            targetUrl: targetUrl || `file://${path.resolve(__dirname, '../../demo-apps/saas-analytics/index.html')}`,
            durationSeconds: Math.ceil(voiceResult.duration),
            resolution,
            projectDir,
            onProgress: (p) => log(p.agent, p.message)
          });
          scene.videoPath = recordingResult.outputPath;
        } else {
          // motion_graphic or hybrid_callout
          log('Motion Designer', `Rendering motion graphics for Scene ${sceneStep}: "${scene.title}"...`, baseScenePct);
          const motionResult = await this.motionDesigner.renderMotionClip({
            scene,
            sourceAnalysis,
            durationSeconds: Math.ceil(voiceResult.duration),
            resolution,
            projectDir,
            onProgress: (p) => log(p.agent, p.message)
          });
          scene.videoPath = motionResult.outputPath;
        }

        completedScenes.push(scene);
      }

      // Update scene manifest with paths and exact durations
      manifest.scenes = completedScenes;
      fs.writeFileSync(path.join(projectDir, 'scene-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

      // Stage 5: Audio Engineer (AUDIO MIX & DUCKING)
      const totalAudioDuration = completedScenes.reduce((acc, s) => acc + (s.audioDuration || 5), 0);
      log('Audio Engineer', `Composing soundtrack and applying smart sidechain ducking (${totalAudioDuration.toFixed(1)}s)...`, 75);
      const masterAudio = await this.audioEngineer.produceMasterAudio({
        scenes: completedScenes,
        totalDuration: totalAudioDuration,
        musicStyle,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });

      // Stage 6: Video Editor (EDIT & RENDER)
      log('Video Editor', 'Composing multi-track video timeline and rendering master broadcast MP4...', 85);
      const renderResult = await this.videoEditor.composeAndRender({
        scenes: completedScenes,
        masterAudioPath: masterAudio.masterMixPath,
        resolution,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });
      projectData.artifacts.outputMp4 = renderResult.projectRootMp4;

      // Stage 7: Quality Controller (QC INSPECT)
      log('Quality Controller', 'Inspecting video codecs, stream sync, bitrate, and playback health...', 95);
      const qcReport = await this.qualityController.inspectMasterVideo({
        videoPath: renderResult.projectRootMp4,
        targetDuration: totalAudioDuration,
        resolution,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });
      projectData.artifacts.qcReport = path.join(projectDir, 'qc-report.json');
      projectData.qc = qcReport;

      // Finalize
      projectData.status = 'COMPLETED';
      projectData.progressPercent = 100;
      projectData.completedAt = new Date().toISOString();
      projectData.finalVideo = {
        path: renderResult.projectRootMp4,
        duration: renderResult.duration,
        width: renderResult.width,
        height: renderResult.height,
        sizeBytes: renderResult.sizeBytes
      };

      log('Creative Director', `Production complete! Broadcast MP4 delivered: ${path.basename(renderResult.projectRootMp4)}`, 100);
      fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectData, null, 2), 'utf8');

      this.emit('complete', { projectId: id, projectData });
      return projectData;
    } catch (err) {
      projectData.status = 'FAILED';
      projectData.error = err.message;
      log('Creative Director', `Production halted due to error: ${err.message}`, projectData.progressPercent);
      fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectData, null, 2), 'utf8');
      this.emit('error', { projectId: id, error: err.message });
      throw err;
    }
  }

  /**
   * Selective Scene Regeneration:
   * Regenerate a single scene without rebuilding the rest of the project!
   */
  async regenerateScene(projectId, sceneIndex, updates = {}) {
    const projectDir = path.join(config.PROJECTS_DIR, projectId);
    const projectJsonPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      throw new Error(`Project ${projectId} not found`);
    }

    const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    const manifestPath = path.join(projectDir, 'scene-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const scene = manifest.scenes[sceneIndex];
    if (!scene) {
      throw new Error(`Scene at index ${sceneIndex} not found`);
    }

    const log = (agent, message, percent) => {
      const entry = { timestamp: new Date().toISOString(), agent: `[REGEN] ${agent}`, message };
      projectData.logs.push(entry);
      this.emit('progress', { projectId, agent, message, percent });
    };

    log('Creative Director', `Starting selective regeneration for Scene ${sceneIndex + 1}: "${scene.title}"...`, 10);

    // Apply updates if specified
    if (updates.narrationText) scene.narrationText = updates.narrationText;
    if (updates.visualPlan) scene.visualPlan = Object.assign(scene.visualPlan || {}, updates.visualPlan);

    const voiceId = updates.voiceId || projectData.inputs.voiceId;
    const resolution = manifest.resolution;

    // 1. Re-produce scene voice
    log('Voice Producer', `Re-synthesizing voice for Scene ${sceneIndex + 1}...`, 30);
    const voiceResult = await this.voiceProducer.produceSceneVoice({
      scene,
      voiceId,
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });
    scene.audioPath = voiceResult.audioPath;
    scene.subtitlesPath = voiceResult.subtitlesPath;
    scene.audioDuration = voiceResult.duration;
    scene.subtitles = voiceResult.subtitles;

    // 2. Re-record or re-render video if requested
    if (updates.reRecord || scene.type === 'screen_recording') {
      const targetUrl = projectData.inputs.liveUrl || `file://${path.resolve(__dirname, '../../demo-apps/saas-analytics/index.html')}`;
      log('Screen Recorder', `Re-recording footage for Scene ${sceneIndex + 1}...`, 50);
      const recordingResult = await this.screenRecorder.recordSceneFootage({
        scene,
        targetUrl,
        durationSeconds: Math.ceil(voiceResult.duration),
        resolution,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });
      scene.videoPath = recordingResult.outputPath;
    } else {
      log('Motion Designer', `Re-rendering motion graphics for Scene ${sceneIndex + 1}...`, 50);
      const sourceAnalysis = JSON.parse(fs.readFileSync(path.join(projectDir, 'source-analysis.json'), 'utf8'));
      const motionResult = await this.motionDesigner.renderMotionClip({
        scene,
        sourceAnalysis,
        durationSeconds: Math.ceil(voiceResult.duration),
        resolution,
        projectDir,
        onProgress: (p) => log(p.agent, p.message)
      });
      scene.videoPath = motionResult.outputPath;
    }

    manifest.scenes[sceneIndex] = scene;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 3. Fast re-mix master audio
    log('Audio Engineer', 'Re-mixing master audio tracks...', 70);
    const totalAudioDuration = manifest.scenes.reduce((acc, s) => acc + (s.audioDuration || 5), 0);
    const masterAudio = await this.audioEngineer.produceMasterAudio({
      scenes: manifest.scenes,
      totalDuration: totalAudioDuration,
      musicStyle: projectData.inputs.musicStyle || 'cinematic',
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });

    // 4. Fast re-compose video
    log('Video Editor', 'Re-compositing timeline with updated scene...', 85);
    const renderResult = await this.videoEditor.composeAndRender({
      scenes: manifest.scenes,
      masterAudioPath: masterAudio.masterMixPath,
      resolution,
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });

    // 5. Re-check quality
    log('Quality Controller', 'Inspecting regenerated MP4...', 95);
    const qcReport = await this.qualityController.inspectMasterVideo({
      videoPath: renderResult.projectRootMp4,
      targetDuration: totalAudioDuration,
      resolution,
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });

    projectData.finalVideo = {
      path: renderResult.projectRootMp4,
      duration: renderResult.duration,
      width: renderResult.width,
      height: renderResult.height,
      sizeBytes: renderResult.sizeBytes
    };
    projectData.qc = qcReport;
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf8');

    log('Creative Director', `Selective regeneration complete for Scene ${sceneIndex + 1}!`, 100);
    return { scene, projectData };
  }
}

module.exports = ProductionPipeline;
