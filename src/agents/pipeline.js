const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const config = require('../config');
const { ensureDir } = require('../utils/ffmpegHelper');

const IntentEngine = require('./intentEngine');
const Researcher = require('./researcher');
const EvidenceEngine = require('./evidenceEngine');
const CreativeDirector = require('./creativeDirector');
const ScreenRecorder = require('./screenRecorder');
const VoiceProducer = require('./voiceProducer');
const MotionDesigner = require('./motionDesigner');
const AudioEngineer = require('./audioEngineer');
const VideoEditor = require('./videoEditor');
const QualityController = require('./qualityController');

// Formal PRD Project States
const PROJECT_STATES = {
  CREATED: 'CREATED',
  ANALYZING: 'ANALYZING',
  UNDERSTOOD: 'UNDERSTOOD',
  PLANNING: 'PLANNING',
  EXPLORING: 'EXPLORING',
  RECORDING: 'RECORDING',
  GENERATING: 'GENERATING',
  COMPOSING: 'COMPOSING',
  RENDERING: 'RENDERING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

class ProductionPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;

    this.intentEngine = new IntentEngine();
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
    projectName,
    githubUrl,
    liveUrl,
    localPath,
    isDemo,
    prompt,
    mode,
    duration,
    aspectRatio,
    voiceId,
    musicStyle,
    provider
  }) {
    const id = projectId || `proj_${Date.now()}`;
    const projectDir = ensureDir(path.join(config.PROJECTS_DIR, id));

    // Determine truthful source mode
    let sourceMode = 'LIVE_URL';
    if (isDemo || mode === 'sample' || (localPath && localPath.includes('demo-apps/saas-analytics'))) {
      sourceMode = 'DEMO';
    } else if (liveUrl) {
      sourceMode = 'LIVE_URL';
    } else if (localPath) {
      const resolved = path.resolve(localPath);
      if (!fs.existsSync(resolved)) {
        throw this.wrapError('SOURCE_UNAVAILABLE', `Local application or repository path not found: ${localPath}`);
      }
      const hasExecutableHtml = fs.statSync(resolved).isDirectory()
        ? (fs.existsSync(path.join(resolved, 'index.html')) ||
           fs.existsSync(path.join(resolved, 'public', 'index.html')) ||
           fs.existsSync(path.join(resolved, 'src', 'public', 'index.html')) ||
           fs.existsSync(path.join(resolved, 'dist', 'index.html')))
        : resolved.endsWith('.html');
      if (githubUrl && hasExecutableHtml) {
        sourceMode = 'REPOSITORY_EXECUTED';
      } else {
        sourceMode = hasExecutableHtml ? 'LOCAL_APP' : 'REPOSITORY_ANALYSIS_ONLY';
      }
    } else if (githubUrl) {
      sourceMode = 'REPOSITORY_ANALYSIS_ONLY';
    } else {
      throw this.wrapError('SOURCE_EXECUTION_UNAVAILABLE', 'At least one valid source (liveUrl, localPath, or githubUrl) is required.');
    }

    const projectData = {
      id,
      projectName: projectName || (sourceMode === 'DEMO' ? 'PulseFlow SaaS Demo' : 'Project Workspace'),
      createdAt: new Date().toISOString(),
      status: PROJECT_STATES.CREATED,
      currentStage: PROJECT_STATES.CREATED,
      progressPercent: 0,
      sourceMode,
      inputs: {
        projectName,
        githubUrl: githubUrl || null,
        liveUrl: liveUrl || null,
        localPath: localPath || null,
        sourceMode,
        isDemo: sourceMode === 'DEMO',
        prompt: prompt || 'Professional presentation video showcasing key capabilities',
        mode,
        duration,
        aspectRatio,
        voiceId,
        musicStyle
      },
      artifacts: {
        projectJson: path.join(projectDir, 'project.json'),
        projectModel: null,
        intent: null,
        evidence: null,
        sceneManifest: null,
        script: null,
        outputMp4: null,
        qcReport: null
      },
      logs: []
    };

    const setStage = (stage, message, percent, agent = 'Creative Director') => {
      projectData.status = stage;
      projectData.currentStage = stage;
      if (percent !== undefined) projectData.progressPercent = percent;
      const entry = { timestamp: new Date().toISOString(), stage, agent, message };
      projectData.logs.push(entry);

      this.emit('progress', {
        projectId: id,
        stage,
        agent,
        message,
        percent: projectData.progressPercent
      });

      fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectData, null, 2), 'utf8');
    };

    try {
      setStage(PROJECT_STATES.CREATED, `Initializing production for [${id}] in mode [${sourceMode}]...`, 5, 'Creative Director');

      // 1. Intent Engine (Parse natural language creative request into Intent Model)
      const userIntent = this.intentEngine.parseIntent(prompt, {
        mode,
        duration,
        aspectRatio,
        voiceId
      }, projectDir);
      projectData.artifacts.intent = path.join(projectDir, 'intent.json');
      projectData.intent = userIntent;

      // 2. Researcher: ANALYZING -> UNDERSTOOD
      setStage(PROJECT_STATES.ANALYZING, `Analyzing source structure and intelligence for [${sourceMode}]...`, 12, 'Researcher');

      let projectModel = null;
      try {
        projectModel = await this.researcher.analyzeSource({
          projectName,
          githubUrl,
          liveUrl,
          localPath,
          isDemo: sourceMode === 'DEMO',
          projectDir,
          onProgress: (p) => setStage(PROJECT_STATES.ANALYZING, p.message, 18, p.agent)
        });
        projectData.artifacts.projectModel = path.join(projectDir, 'project_model.json');
        fs.writeFileSync(path.join(projectDir, 'understanding.json'), JSON.stringify(projectModel, null, 2), 'utf8');
        projectData.artifacts.understanding = path.join(projectDir, 'understanding.json');
        projectData.projectModel = projectModel;
      } catch (err) {
        if (err.code === 'LIVE_APP_UNREACHABLE' || err.code === 'SOURCE_UNAVAILABLE') {
          throw err;
        }
        throw this.wrapError('LIVE_APP_UNREACHABLE', `Failed to analyze application source: ${err.message}`);
      }

      setStage(PROJECT_STATES.UNDERSTOOD, `Product understood: ${projectModel.project} (${projectModel.purpose})`, 25, 'Researcher');

      // 3. Evidence Engine (Evaluate Claims against Evidence Rule)
      const evidenceSummary = this.evidenceEngine.processEvidence(projectModel, projectDir);
      projectData.artifacts.evidence = path.join(projectDir, 'evidence.json');
      projectData.evidenceSummary = {
        sourceMode,
        total: evidenceSummary.totalClaims,
        verified: evidenceSummary.verifiedCount,
        partial: evidenceSummary.partialCount,
        unverified: evidenceSummary.unverifiedCount,
        future: evidenceSummary.futureCount
      };

      // 4. Creative Director: PLANNING
      setStage(PROJECT_STATES.PLANNING, `Planning story arc, sequence, and narration for [${sourceMode}]...`, 32, 'Creative Director');
      const { manifest, script } = await this.creativeDirector.planProduction({
        userIntent,
        projectModel,
        evidenceSummary,
        projectDir
      });
      projectData.artifacts.sceneManifest = path.join(projectDir, 'scene-manifest.json');
      projectData.artifacts.script = path.join(projectDir, 'script.json');
      projectData.manifest = manifest;

      // 5. Target URL Resolution: Strictly governed by Source Mode (NO SILENT DEMO FALLBACK)
      let targetUrl = null;
      if (sourceMode === 'DEMO') {
        targetUrl = liveUrl || `file://${path.resolve(config.DEMO_APPS_DIR, 'saas-analytics', 'index.html')}`;
      } else if (sourceMode === 'LIVE_URL') {
        targetUrl = liveUrl;
      } else if (sourceMode === 'LOCAL_APP' || sourceMode === 'REPOSITORY_EXECUTED') {
        const resolved = path.resolve(localPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          const indexHtml = path.join(resolved, 'index.html');
          const publicIndex = path.join(resolved, 'public', 'index.html');
          const srcPublicIndex = path.join(resolved, 'src', 'public', 'index.html');
          const distIndex = path.join(resolved, 'dist', 'index.html');
          if (fs.existsSync(indexHtml)) {
            targetUrl = `file://${indexHtml}`;
          } else if (fs.existsSync(publicIndex)) {
            targetUrl = `file://${publicIndex}`;
          } else if (fs.existsSync(srcPublicIndex)) {
            targetUrl = `file://${srcPublicIndex}`;
          } else if (fs.existsSync(distIndex)) {
            targetUrl = `file://${distIndex}`;
          } else {
            targetUrl = `file://${resolved}`;
          }
        } else {
          targetUrl = `file://${resolved}`;
        }
      } else {
        // REPOSITORY_ANALYSIS_ONLY: targetUrl remains null! No browser recording will be executed!
        targetUrl = null;
      }

      // Save discovery.json (Section 24)
      const discoveryData = {
        sourceMode,
        targetUrl,
        projectId: id,
        projectName,
        liveData: projectModel.liveData || {},
        workflows: projectModel.workflows || [],
        discoveredAt: new Date().toISOString()
      };
      fs.writeFileSync(path.join(projectDir, 'discovery.json'), JSON.stringify(discoveryData, null, 2), 'utf8');
      projectData.artifacts.discovery = path.join(projectDir, 'discovery.json');

      const resolution = manifest.resolution;
      const completedScenes = [];
      const scenesTotal = manifest.scenes.length;
      let sceneStep = 0;

      for (const scene of manifest.scenes) {
        sceneStep++;
        const baseScenePct = 35 + Math.round((sceneStep / scenesTotal) * 35);

        // Voice Generation
        setStage(PROJECT_STATES.GENERATING, `Synthesizing neural voice for Scene ${sceneStep}/${scenesTotal}: "${scene.title}"...`, baseScenePct - 2, 'Voice Producer');
        let voiceResult = null;
        try {
          voiceResult = await this.voiceProducer.produceSceneVoice({
            scene: { id: scene.id, title: scene.title, narrationText: scene.voiceover, targetDuration: scene.duration },
            voiceId: userIntent.voice_id,
            provider: provider || 'edge-tts',
            projectDir,
            onProgress: (p) => setStage(PROJECT_STATES.GENERATING, p.message, baseScenePct - 1, p.agent)
          });
        } catch (err) {
          throw this.wrapError('VOICE_GENERATION_FAILED', `Failed to generate voice for scene ${scene.id}: ${err.message}`);
        }

        scene.audioPath = voiceResult.audioPath;
        scene.subtitlesPath = voiceResult.subtitlesPath;
        scene.audioDuration = voiceResult.duration;
        scene.subtitles = voiceResult.subtitles;

        // Visuals (Recording or Motion Graphic)
        // Ensure visual duration matches planned scene duration, accommodating audio if voice is longer
        if (voiceResult && voiceResult.duration > (scene.duration || 6)) {
          scene.duration = Math.ceil(voiceResult.duration + 0.5);
        }
        const sceneTargetDuration = Math.max(scene.duration || 8, Math.ceil(voiceResult.duration || 0));

        const primaryVisual = scene.visuals?.[0] || {};
        if (primaryVisual.source === 'browser_recording' || scene.type === 'product_demo') {
          if (!targetUrl) {
            throw this.wrapError('SOURCE_EXECUTION_UNAVAILABLE', `Scene "${scene.id}" requires browser recording, but no live URL or runnable local application was provided for [${sourceMode}].`);
          }
          setStage(PROJECT_STATES.RECORDING, `Recording semantic product interaction for Scene ${sceneStep}: "${scene.title}"...`, baseScenePct, 'Screen Recorder');
          try {
            const recordingResult = await this.screenRecorder.recordSceneFootage({
              scene: { id: scene.id, title: scene.title, targetDuration: sceneTargetDuration, overlay: scene.overlay, visualPlan: scene.visualPlan },
              targetUrl,
              durationSeconds: sceneTargetDuration,
              resolution,
              projectModel,
              projectDir,
              onProgress: (p) => setStage(PROJECT_STATES.RECORDING, p.message, baseScenePct, p.agent)
            });
            scene.videoPath = recordingResult.outputPath;
            scene.recordingMetadata = recordingResult.metadataPath;
          } catch (err) {
            throw this.wrapError('RECORDING_FAILED', `Failed to capture product footage for scene ${scene.id}: ${err.message}`);
          }
        } else {
          setStage(PROJECT_STATES.GENERATING, `Rendering procedural motion graphics for Scene ${sceneStep}: "${scene.title}"...`, baseScenePct, 'Motion Designer');
          const motionType = primaryVisual.motionType || (scene.id === 'hook' ? 'intro_cinematic' : scene.id === 'product_reveal' ? 'problem_solution_split' : 'outro_cta');
          const motionResult = await this.motionDesigner.renderMotionClip({
            scene: { id: scene.id, title: scene.title, targetDuration: sceneTargetDuration, visualPlan: { motionType }, overlay: scene.overlay },
            sourceAnalysis: projectModel,
            durationSeconds: sceneTargetDuration,
            resolution,
            projectDir,
            onProgress: (p) => setStage(PROJECT_STATES.GENERATING, p.message, baseScenePct, p.agent)
          });
          scene.videoPath = motionResult.outputPath;
        }

        completedScenes.push(scene);
      }

      manifest.scenes = completedScenes;
      fs.writeFileSync(path.join(projectDir, 'scene-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

      // 6. Audio Engineer: COMPOSING
      const totalTimelineDuration = completedScenes.reduce((acc, s) => acc + (s.duration || 8), 0);
      setStage(PROJECT_STATES.COMPOSING, `Composing soundtrack and applying smart sidechain audio ducking (${totalTimelineDuration.toFixed(1)}s)...`, 75, 'Audio Engineer');
      const masterAudio = await this.audioEngineer.produceMasterAudio({
        scenes: completedScenes,
        totalDuration: totalTimelineDuration,
        musicStyle: musicStyle || 'cinematic',
        projectDir,
        onProgress: (p) => setStage(PROJECT_STATES.COMPOSING, p.message, 78, p.agent)
      });

      // Save asset-manifest.json and render-config.json (Section 24)
      const assetManifest = {
        projectId: id,
        scenes: completedScenes.map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          audioPath: s.audioPath,
          audioDuration: s.audioDuration,
          subtitlesPath: s.subtitlesPath,
          videoPath: s.videoPath,
          visuals: s.visuals
        })),
        audio: {
          masterMix: masterAudio.masterMixPath,
          soundtrackBed: masterAudio.soundtrackBedPath,
          narrationMaster: masterAudio.narrationMasterPath
        },
        generatedAt: new Date().toISOString()
      };
      fs.writeFileSync(path.join(projectDir, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2), 'utf8');
      projectData.artifacts.assetManifest = path.join(projectDir, 'asset-manifest.json');

      const renderConfig = {
        resolution,
        aspectRatio: userIntent.aspect_ratio || '16:9',
        fps: 30,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 19,
        preset: 'fast',
        targetDuration: totalTimelineDuration
      };
      fs.writeFileSync(path.join(projectDir, 'render-config.json'), JSON.stringify(renderConfig, null, 2), 'utf8');
      projectData.artifacts.renderConfig = path.join(projectDir, 'render-config.json');

      // 7. Video Editor: RENDERING
      setStage(PROJECT_STATES.RENDERING, 'Composing multi-track video timeline and encoding broadcast MP4...', 82, 'Video Editor');
      let renderResult = null;
      try {
        renderResult = await this.videoEditor.composeAndRender({
          scenes: completedScenes.map(s => ({
            ...s,
            narrationText: s.voiceover,
            targetDuration: s.duration
          })),
          masterAudioPath: masterAudio.masterMixPath,
          resolution,
          projectDir,
          onProgress: (p) => setStage(PROJECT_STATES.RENDERING, p.message, 88, p.agent)
        });
      } catch (err) {
        throw this.wrapError('RENDER_FAILED', `Failed to render final MP4: ${err.message}`);
      }
      projectData.artifacts.outputMp4 = renderResult.projectRootMp4;

      // 8. Quality Controller: QUALITY_CHECK
      setStage(PROJECT_STATES.QUALITY_CHECK, 'Running automated technical, visual, narrative, and product accuracy checks...', 94, 'Quality Controller');
      let qcReport = null;
      try {
        qcReport = await this.qualityController.inspectMasterVideo({
          videoPath: renderResult.projectRootMp4,
          targetDuration: totalTimelineDuration,
          resolution,
          projectDir,
          onProgress: (p) => setStage(PROJECT_STATES.QUALITY_CHECK, p.message, 97, p.agent)
        });
      } catch (err) {
        throw this.wrapError('QUALITY_CHECK_FAILED', `Quality check failed: ${err.message}`);
      }

      projectData.artifacts.qcReport = path.join(projectDir, 'qc-report.json');
      projectData.qc = qcReport;
      projectData.qcReport = qcReport;

      // 9. Completed
      projectData.status = PROJECT_STATES.COMPLETED;
      projectData.progressPercent = 100;
      projectData.completedAt = new Date().toISOString();
      projectData.finalVideo = {
        path: renderResult.projectRootMp4,
        duration: renderResult.duration,
        width: renderResult.width,
        height: renderResult.height,
        sizeBytes: renderResult.sizeBytes
      };

      setStage(PROJECT_STATES.COMPLETED, `Production successfully delivered: ${path.basename(renderResult.projectRootMp4)}`, 100, 'Creative Director');
      this.emit('complete', { projectId: id, projectData });
      return projectData;
    } catch (err) {
      projectData.status = PROJECT_STATES.FAILED;
      projectData.errorCode = err.code || 'UNKNOWN_ERROR';
      projectData.error = err.message;
      setStage(PROJECT_STATES.FAILED, `Production halted [${projectData.errorCode}]: ${err.message}`, projectData.progressPercent, 'Creative Director');
      this.emit('error', { projectId: id, error: err.message, code: projectData.errorCode });
      throw err;
    }
  }

  /**
   * Natural Language Regeneration (Section 16 of PRD)
   * Modifies only relevant production artifacts without repeating repo analysis or browser discovery!
   */
  async executeNaturalLanguageRegeneration(projectId, userRequest) {
    const projectDir = path.join(config.PROJECTS_DIR, projectId);
    const projectJsonPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(projectJsonPath)) throw new Error(`Project ${projectId} not found`);

    const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    const manifestPath = path.join(projectDir, 'scene-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const projectModel = JSON.parse(fs.readFileSync(path.join(projectDir, 'project_model.json'), 'utf8'));

    const log = (agent, message, percent) => {
      this.emit('progress', { projectId, stage: 'REGENERATING', agent: `[REGEN] ${agent}`, message, percent });
    };

    log('Creative Director', `Interpreting natural language regeneration request: "${userRequest}"...`, 15);

    // Parse updated intent
    const updatedIntent = this.intentEngine.parseIntent(userRequest, {}, projectDir);

    let needsVoiceResynth = false;
    let needsVideoReassemble = false;
    let needsVisualResync = false;

    // 1. If opening modified ("make the opening stronger")
    if (updatedIntent.custom_instructions.includes('enhance_hook') && manifest.scenes[0]) {
      log('Creative Director', 'Rewriting Scene 1 with high-impact opening hook...', 25);
      manifest.scenes[0].voiceover = `Stop wasting engineering time on fragmented tools. Here is why ${projectModel.project} changes everything.`;
      manifest.scenes[0].narrationText = manifest.scenes[0].voiceover;
      needsVoiceResynth = true;
    }

    // 2. If remove cinematic intro requested ("remove the cinematic intro", "skip intro")
    if (updatedIntent.custom_instructions.includes('remove_cinematic_intro') && manifest.scenes[0]) {
      log('Creative Director', 'Reframing Scene 1 to dive straight into live software...', 25);
      manifest.scenes[0].voiceover = `Here is ${projectModel.project} running in production, built directly for modern teams.`;
      manifest.scenes[0].narrationText = manifest.scenes[0].voiceover;
      manifest.scenes[0].duration = 4;
      needsVoiceResynth = true;
    }

    // 3. If technical depth requested ("make it more technical", "for developers")
    if (updatedIntent.custom_instructions.includes('more_technical')) {
      log('Creative Director', 'Rewriting narrative with developer-grade technical depth and architecture metrics...', 28);
      manifest.scenes.forEach((s, idx) => {
        if (s.type === 'product_demo' || s.type === 'feature_demo') {
          s.voiceover = `${s.title}: Powered by reactive state pipelines, sub-millisecond execution, and automated distributed telemetry.`;
          s.narrationText = s.voiceover;
        }
      });
      needsVoiceResynth = true;
    }

    // 4. If dashboard focus requested ("show more of the dashboard")
    if (updatedIntent.custom_instructions.includes('show_more_dashboard')) {
      log('Creative Director', 'Expanding live telemetry and dashboard screentime...', 28);
      const dashScene = manifest.scenes.find(s => s.type === 'product_demo' || s.id.includes('demo') || s.id.includes('workflow'));
      if (dashScene) {
        dashScene.duration = Math.max(dashScene.duration, 15);
        needsVideoReassemble = true;
      }
    }

    // 5. If ending modified ("change the ending", "stronger cta")
    if (updatedIntent.custom_instructions.includes('change_ending') && manifest.scenes.length > 0) {
      const lastScene = manifest.scenes[manifest.scenes.length - 1];
      log('Creative Director', 'Crafting high-conversion closing call to action...', 29);
      lastScene.voiceover = `Experience the next generation of ${projectModel.project}. Deploy locally or explore the live system today.`;
      lastScene.narrationText = lastScene.voiceover;
      needsVoiceResynth = true;
    }

    // 6. If aspect ratio changed ("make this vertical", "make it 9:16")
    const currentAspectRatio = manifest.aspect_ratio || manifest.aspectRatio || config.DEFAULT_SPECS?.aspectRatio || '16:9';
    if (updatedIntent.aspect_ratio && updatedIntent.aspect_ratio !== currentAspectRatio) {
      log('Creative Director', `Switching canvas layout to ${updatedIntent.aspect_ratio}...`, 30);
      manifest.aspect_ratio = updatedIntent.aspect_ratio;
      manifest.aspectRatio = updatedIntent.aspect_ratio;
      const targetRes = (config.RESOLUTIONS && config.RESOLUTIONS[updatedIntent.aspect_ratio])
        || (config.DEFAULT_SPECS && config.DEFAULT_SPECS.resolution)
        || (updatedIntent.aspect_ratio === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
      manifest.resolution = targetRes;
      needsVideoReassemble = true;
      needsVisualResync = true;
    }

    // 7. If duration changed ("make it 60 seconds")
    if (updatedIntent.duration_seconds && Math.abs(updatedIntent.duration_seconds - manifest.duration) > 2) {
      const newTotal = updatedIntent.duration_seconds;
      const oldTotal = manifest.scenes.reduce((acc, s) => acc + (s.duration || 8), 0) || manifest.duration || newTotal;
      log('Creative Director', `Rescaling timeline duration from ${oldTotal}s to ${newTotal}s across ${manifest.scenes.length} scenes...`, 32);

      manifest.duration = newTotal;
      manifest.targetTotalDuration = newTotal;

      let allocated = 0;
      for (let i = 0; i < manifest.scenes.length; i++) {
        const s = manifest.scenes[i];
        if (i === manifest.scenes.length - 1) {
          s.duration = Math.max(newTotal - allocated, 3);
        } else {
          const ratio = (s.duration || 8) / oldTotal;
          const scaledDur = Math.max(Math.round(ratio * newTotal), 3);
          s.duration = scaledDur;
          allocated += scaledDur;
        }
      }

      // Ensure sum strictly equals newTotal
      const currentSum = manifest.scenes.reduce((acc, s) => acc + s.duration, 0);
      const diff = newTotal - currentSum;
      if (diff !== 0 && manifest.scenes.length > 0) {
        manifest.scenes[manifest.scenes.length - 1].duration += diff;
      }

      needsVideoReassemble = true;
      needsVisualResync = true;
    }

    // 8. If voice changed ("use a faster voice" or "use a female voice")
    const voiceId = updatedIntent.voice_id || projectData.inputs.voiceId;

    // Re-synthesize voice if needed
    for (let i = 0; i < manifest.scenes.length; i++) {
      const scene = manifest.scenes[i];
      if (needsVoiceResynth || updatedIntent.voice_id !== projectData.inputs.voiceId) {
        log('Voice Producer', `Re-synthesizing voice track for Scene ${i + 1}...`, 45);
        const vResult = await this.voiceProducer.produceSceneVoice({
          scene: { id: scene.id, title: scene.title, narrationText: scene.voiceover || scene.narrationText, targetDuration: scene.duration },
          voiceId,
          projectDir,
          onProgress: (p) => log(p.agent, p.message)
        });
        scene.audioPath = vResult.audioPath;
        scene.audioDuration = vResult.duration;
        scene.subtitlesPath = vResult.subtitlesPath;
        scene.subtitles = vResult.subtitles;
      }
      if (scene.audioDuration && scene.audioDuration > scene.duration) {
        scene.duration = Math.ceil(scene.audioDuration + 0.5);
      }
    }

    // Re-sync visual clips if duration or resolution changed
    if (needsVisualResync) {
      for (let i = 0; i < manifest.scenes.length; i++) {
        const scene = manifest.scenes[i];
        const primaryVisual = scene.visuals?.[0] || {};
        const isMotionGraphic = primaryVisual.source === 'motion_graphic' || scene.type !== 'product_demo';

        if (isMotionGraphic) {
          log('Motion Designer', `Re-rendering motion graphics for Scene ${i + 1} (${scene.duration}s)...`, 55);
          const motionType = primaryVisual.motionType || (scene.id === 'hook' ? 'intro_cinematic' : scene.id === 'product_reveal' ? 'problem_solution_split' : 'outro_cta');
          try {
            const motionResult = await this.motionDesigner.renderMotionClip({
              scene: {
                id: scene.id,
                title: scene.title,
                targetDuration: scene.duration,
                visualPlan: { motionType },
                overlay: scene.overlay
              },
              sourceAnalysis: projectModel,
              durationSeconds: scene.duration,
              resolution: manifest.resolution,
              projectDir,
              onProgress: (p) => log(p.agent, p.message)
            });
            scene.videoPath = motionResult.outputPath;
          } catch (mErr) {
            console.warn(`Motion re-render warning for scene ${scene.id}:`, mErr.message);
          }
        }
      }
    }

    // Re-mix master audio
    log('Audio Engineer', 'Re-mixing master soundtrack with updated stems...', 70);
    const timelineDuration = manifest.scenes.reduce((acc, s) => acc + (s.duration || 8), 0);
    manifest.duration = timelineDuration;
    manifest.targetTotalDuration = timelineDuration;
    const masterAudio = await this.audioEngineer.produceMasterAudio({
      scenes: manifest.scenes,
      totalDuration: timelineDuration,
      musicStyle: projectData.inputs.musicStyle || 'cinematic',
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });

    // Re-render final video without repeating browser exploration
    log('Video Editor', 'Re-rendering broadcast MP4 with cached visual assets...', 85);
    const renderResult = await this.videoEditor.composeAndRender({
      scenes: manifest.scenes.map(s => ({
        ...s,
        narrationText: s.voiceover || s.narrationText,
        targetDuration: s.duration
      })),
      masterAudioPath: masterAudio.masterMixPath,
      resolution: manifest.resolution,
      projectDir,
      onProgress: (p) => log(p.agent, p.message)
    });

    // Run QC
    log('Quality Controller', 'Inspecting regenerated MP4 output...', 95);
    const qcReport = await this.qualityController.inspectMasterVideo({
      videoPath: renderResult.projectRootMp4,
      targetDuration: timelineDuration,
      resolution: manifest.resolution,
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
    projectData.qcReport = qcReport;
    if (projectData.inputs) {
      if (manifest.aspect_ratio || manifest.aspectRatio) {
        projectData.inputs.aspectRatio = manifest.aspect_ratio || manifest.aspectRatio;
        projectData.inputs.aspect_ratio = manifest.aspect_ratio || manifest.aspectRatio;
      }
      if (manifest.duration) {
        projectData.inputs.duration = manifest.duration;
      }
    }

    const renderConfigPath = path.join(projectDir, 'render-config.json');
    if (fs.existsSync(renderConfigPath)) {
      try {
        const renderConfig = JSON.parse(fs.readFileSync(renderConfigPath, 'utf8'));
        renderConfig.resolution = manifest.resolution;
        renderConfig.aspectRatio = manifest.aspect_ratio || manifest.aspectRatio;
        renderConfig.aspect_ratio = manifest.aspect_ratio || manifest.aspectRatio;
        renderConfig.targetDuration = timelineDuration;
        fs.writeFileSync(renderConfigPath, JSON.stringify(renderConfig, null, 2), 'utf8');
      } catch (_) {}
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf8');

    log('Creative Director', `Natural language regeneration complete! (${renderResult.duration.toFixed(1)}s broadcast MP4)`, 100);
    return { manifest, projectData };
  }

  /**
   * Selective Scene Regeneration (Section 21 & 22 of PRD)
   * Regenerates an individual scene (narration and/or recording/motion graphic),
   * then re-mixes audio and re-renders the final broadcast MP4 without re-running full pipeline.
   */
  async regenerateScene(projectId, sceneIndex, options = {}) {
    const projectDir = path.join(config.PROJECTS_DIR, projectId);
    const projectJsonPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      throw this.wrapError('PROJECT_NOT_FOUND', `Project ${projectId} not found`);
    }

    const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    const manifestPath = path.join(projectDir, 'scene-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw this.wrapError('MANIFEST_NOT_FOUND', `Scene manifest not found for project ${projectId}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    let projectModel = {};
    const modelPath = path.join(projectDir, 'project_model.json');
    if (fs.existsSync(modelPath)) {
      try {
        projectModel = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      } catch (_) {}
    } else if (projectData.projectModel) {
      projectModel = projectData.projectModel;
    }

    const log = (agent, message, percent) => {
      this.emit('progress', {
        projectId,
        stage: 'REGENERATING',
        agent: `[SCENE REGEN] ${agent}`,
        message,
        percent
      });
    };

    const idx = parseInt(sceneIndex, 10);
    const targetScene = manifest.scenes[idx];
    if (!targetScene) {
      throw this.wrapError(
        'SCENE_NOT_FOUND',
        `Scene at index ${idx} not found in project ${projectId} (total scenes: ${manifest.scenes.length})`
      );
    }

    log('Creative Director', `Starting selective regeneration for Scene ${idx + 1}: "${targetScene.title}"...`, 10);

    // 1. Update text / visual plan / duration
    if (options.narrationText) {
      targetScene.voiceover = options.narrationText;
      targetScene.narrationText = options.narrationText;
    }
    if (options.visualPlan) {
      targetScene.visualPlan = { ...targetScene.visualPlan, ...options.visualPlan };
    }
    if (options.duration || options.targetDuration) {
      targetScene.duration = options.duration || options.targetDuration;
    }

    // 2. Synthesize new neural voice track for target scene
    const voiceId = options.voiceId || projectData.inputs?.voiceId;
    log('Voice Producer', `Re-synthesizing voice for Scene ${idx + 1}: "${targetScene.title}"...`, 25);
    const vResult = await this.voiceProducer.produceSceneVoice({
      scene: {
        id: targetScene.id,
        title: targetScene.title,
        narrationText: targetScene.voiceover || targetScene.narrationText,
        targetDuration: targetScene.duration
      },
      voiceId,
      projectDir,
      onProgress: (p) => log(p.agent, p.message, 35)
    });

    targetScene.audioPath = vResult.audioPath;
    targetScene.subtitlesPath = vResult.subtitlesPath;
    targetScene.audioDuration = vResult.duration;
    targetScene.subtitles = vResult.subtitles;

    if (vResult.duration > (targetScene.duration || 6)) {
      targetScene.duration = Math.ceil(vResult.duration + 0.5);
    }
    const sceneTargetDuration = Math.max(targetScene.duration || 8, Math.ceil(vResult.duration || 0));

    // 3. Re-record or re-render visual if requested or needed
    const primaryVisual = targetScene.visuals?.[0] || {};
    const isBrowserRecording = primaryVisual.source === 'browser_recording' || targetScene.type === 'product_demo';

    if (options.reRecord || options.visualPlan || !targetScene.videoPath || !fs.existsSync(targetScene.videoPath)) {
      if (isBrowserRecording) {
        let targetUrl = null;
        const discoveryPath = path.join(projectDir, 'discovery.json');
        if (fs.existsSync(discoveryPath)) {
          try {
            const discovery = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'));
            targetUrl = discovery.targetUrl;
          } catch (_) {}
        }
        if (!targetUrl) {
          targetUrl = projectData.inputs?.liveUrl;
        }

        if (targetUrl) {
          log('Screen Recorder', `Re-recording product interaction for Scene ${idx + 1}...`, 50);
          const recordingResult = await this.screenRecorder.recordSceneFootage({
            scene: {
              id: targetScene.id,
              title: targetScene.title,
              targetDuration: sceneTargetDuration,
              overlay: targetScene.overlay,
              visualPlan: targetScene.visualPlan
            },
            targetUrl,
            durationSeconds: sceneTargetDuration,
            resolution: manifest.resolution,
            projectModel,
            projectDir,
            onProgress: (p) => log(p.agent, p.message, 55)
          });
          targetScene.videoPath = recordingResult.outputPath;
          targetScene.recordingMetadata = recordingResult.metadataPath;
        } else {
          log('Screen Recorder', `Target URL unavailable for re-recording, maintaining existing footage for Scene ${idx + 1}`, 50);
        }
      } else {
        log('Motion Designer', `Re-rendering motion graphics for Scene ${idx + 1}...`, 50);
        const motionType = primaryVisual.motionType || targetScene.visualPlan?.motionType || (targetScene.id === 'hook' ? 'intro_cinematic' : targetScene.id === 'product_reveal' ? 'problem_solution_split' : 'outro_cta');
        const motionResult = await this.motionDesigner.renderMotionClip({
          scene: {
            id: targetScene.id,
            title: targetScene.title,
            targetDuration: sceneTargetDuration,
            visualPlan: { motionType },
            overlay: targetScene.overlay
          },
          sourceAnalysis: projectModel,
          durationSeconds: sceneTargetDuration,
          resolution: manifest.resolution,
          projectDir,
          onProgress: (p) => log(p.agent, p.message, 55)
        });
        targetScene.videoPath = motionResult.outputPath;
      }
    }

    manifest.scenes[idx] = targetScene;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 4. Re-mix master audio track
    log('Audio Engineer', 'Re-mixing master soundtrack with updated scene audio...', 70);
    const timelineDuration = manifest.scenes.reduce((acc, s) => acc + (s.duration || 8), 0);
    const masterAudio = await this.audioEngineer.produceMasterAudio({
      scenes: manifest.scenes,
      totalDuration: timelineDuration,
      musicStyle: projectData.inputs?.musicStyle || 'cinematic',
      projectDir,
      onProgress: (p) => log(p.agent, p.message, 75)
    });

    // 5. Re-render final broadcast video
    log('Video Editor', 'Re-rendering broadcast MP4 with updated scene and audio...', 85);
    const renderResult = await this.videoEditor.composeAndRender({
      scenes: manifest.scenes.map(s => ({
        ...s,
        narrationText: s.voiceover || s.narrationText,
        targetDuration: s.duration
      })),
      masterAudioPath: masterAudio.masterMixPath,
      resolution: manifest.resolution,
      projectDir,
      onProgress: (p) => log(p.agent, p.message, 90)
    });

    // 6. Quality Controller verification
    log('Quality Controller', 'Inspecting regenerated MP4 output...', 95);
    const qcReport = await this.qualityController.inspectMasterVideo({
      videoPath: renderResult.projectRootMp4,
      targetDuration: timelineDuration,
      resolution: manifest.resolution,
      projectDir,
      onProgress: (p) => log(p.agent, p.message, 98)
    });

    projectData.finalVideo = {
      path: renderResult.projectRootMp4,
      duration: renderResult.duration,
      width: renderResult.width,
      height: renderResult.height,
      sizeBytes: renderResult.sizeBytes
    };
    projectData.qc = qcReport;
    projectData.qcReport = qcReport;
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf8');

    // Save updated asset-manifest.json
    const assetManifest = {
      projectId,
      scenes: manifest.scenes.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        audioPath: s.audioPath,
        audioDuration: s.audioDuration,
        subtitlesPath: s.subtitlesPath,
        videoPath: s.videoPath,
        visuals: s.visuals
      })),
      audio: {
        masterMix: masterAudio.masterMixPath,
        soundtrackBed: masterAudio.soundtrackBedPath,
        narrationMaster: masterAudio.narrationMasterPath
      },
      regeneratedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(projectDir, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2), 'utf8');

    log('Creative Director', `Selective scene regeneration complete for Scene ${idx + 1}! (${renderResult.duration.toFixed(1)}s broadcast MP4)`, 100);

    return {
      success: true,
      sceneIndex: idx,
      scene: targetScene,
      manifest,
      projectData,
      finalVideo: projectData.finalVideo
    };
  }

  /**
   * Helper to construct explicit PRD failure errors
   */
  wrapError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }
}

module.exports = ProductionPipeline;
