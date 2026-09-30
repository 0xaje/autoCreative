const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const ProductionPipeline = require('./src/agents/pipeline');
const {
  getSafeProjectPath,
  getSafeArtifactPath,
  isValidProjectId,
  validateLiveUrl,
  validateGithubUrl,
  validateLocalPath
} = require('./src/utils/pathSanitizer');

const app = express();
const server = http.createServer(app);

// WebSocket Origin validation (PRD Security)
function isAllowedWebSocketOrigin(origin) {
  if (!origin) return true; // CLI/tests without browser origin
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    const isMatchingPort = !parsed.port || parsed.port === String(config.PORT);
    if (isLocalhost && isMatchingPort) return true;

    if (process.env.ALLOWED_ORIGINS) {
      const allowed = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase());
      if (allowed.includes(origin.toLowerCase())) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

const wss = new WebSocket.Server({
  server,
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;
    if (isAllowedWebSocketOrigin(origin)) {
      callback(true);
    } else {
      console.warn(`[Security] Rejected WebSocket connection from unauthorized origin: ${origin}`);
      callback(false, 403, 'Forbidden: Invalid WebSocket origin');
    }
  }
});

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') return; // Handled on server
  console.error('WebSocket server error:', err);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use('/demo-apps', express.static(config.DEMO_APPS_DIR));

// Active pipeline instances keyed by projectId
const activePipelines = new Map();

// Broadcast WebSocket message to all connected studio clients
function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'connected', data: { status: 'Studio Studio Connected' } }));
});

// API: Get voices & modes
app.get('/api/metadata', (req, res) => {
  res.json({
    voices: config.VOICES,
    modes: config.CREATIVE_MODES,
    specs: config.DEFAULT_SPECS
  });
});

// Parameter validation middleware: guard against path traversal on all :id routes
app.param('id', (req, res, next, id) => {
  const safePath = getSafeProjectPath(id);
  if (!safePath) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }
  req.projectDir = safePath;
  next();
});

// API: List projects
app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(config.PROJECTS_DIR)) {
      return res.json({ projects: [] });
    }
    const dirs = fs.readdirSync(config.PROJECTS_DIR);
    const projects = [];

    for (const dir of dirs) {
      if (!isValidProjectId(dir)) continue;
      const pJson = path.join(config.PROJECTS_DIR, dir, 'project.json');
      if (fs.existsSync(pJson)) {
        try {
          const data = JSON.parse(fs.readFileSync(pJson, 'utf8'));
          projects.push(data);
        } catch (e) {
          console.warn(`[API] Failed to parse project metadata for ${dir}:`, e.message);
        }
      }
    }

    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single project details
app.get('/api/projects/:id', (req, res) => {
  const projectDir = req.projectDir || getSafeProjectPath(req.params.id);
  if (!projectDir) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }
  const pJson = path.join(projectDir, 'project.json');
  if (!fs.existsSync(pJson)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(pJson, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read project' });
  }
});

// API: Start new video production
app.post('/api/projects', async (req, res) => {
  try {
    const { githubUrl, liveUrl, localPath, isDemo, prompt, mode, duration, aspectRatio, voiceId, musicStyle } = req.body;

    if (!githubUrl && !liveUrl && !localPath && !isDemo) {
      return res.status(400).json({ error: 'At least one of GitHub repository URL, Live URL, or local path is required.' });
    }

    // SSRF and Arbitrary Path Validation
    if (githubUrl) {
      const gCheck = validateGithubUrl(githubUrl);
      if (!gCheck.valid) {
        return res.status(400).json({ error: gCheck.error });
      }
    }

    if (liveUrl) {
      const lCheck = validateLiveUrl(liveUrl, { allowInternal: Boolean(isDemo) });
      if (!lCheck.valid) {
        return res.status(400).json({ error: lCheck.error });
      }
    }

    if (localPath) {
      const pCheck = validateLocalPath(localPath);
      if (!pCheck.valid) {
        return res.status(400).json({ error: pCheck.error });
      }
    }

    const projectId = `proj_${Date.now()}`;
    const pipeline = new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    const onProgress = (data) => broadcast('progress', data);
    const onComplete = (data) => {
      broadcast('complete', data);
      cleanup();
    };
    const onError = (data) => {
      broadcast('error', data);
      cleanup();
    };

    function cleanup() {
      pipeline.removeListener('progress', onProgress);
      pipeline.removeListener('complete', onComplete);
      pipeline.removeListener('error', onError);
      activePipelines.delete(projectId);
    }

    pipeline.on('progress', onProgress);
    pipeline.on('complete', onComplete);
    pipeline.on('error', onError);

    // Respond immediately with projectId while production runs asynchronously
    res.json({
      success: true,
      projectId,
      message: 'Autonomous production pipeline initiated.'
    });

    // Start production in background
    pipeline.runPipeline({
      projectId,
      githubUrl,
      liveUrl,
      localPath,
      isDemo: Boolean(isDemo),
      prompt,
      mode,
      duration,
      aspectRatio,
      voiceId,
      musicStyle
    }).catch(err => {
      console.error(`Pipeline error on project ${projectId}:`, err);
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Regenerate single scene selectively
app.post('/api/projects/:id/regenerate-scene', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectDir = req.projectDir || getSafeProjectPath(projectId);
    if (!projectDir) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }
    const pJson = path.join(projectDir, 'project.json');
    if (!fs.existsSync(pJson)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { sceneIndex, narrationText, visualPlan, voiceId, reRecord } = req.body;

    if (sceneIndex === undefined || sceneIndex === null) {
      return res.status(400).json({ error: 'sceneIndex is required' });
    }

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    const onProgress = (data) => broadcast('progress', data);
    pipeline.on('progress', onProgress);

    const cleanup = () => {
      pipeline.removeListener('progress', onProgress);
      activePipelines.delete(projectId);
    };

    res.json({ success: true, message: `Selective regeneration started for scene ${sceneIndex}` });

    pipeline.regenerateScene(projectId, parseInt(sceneIndex, 10), {
      narrationText,
      visualPlan,
      voiceId,
      reRecord
    }).then(result => {
      broadcast('scene_regenerated', { projectId, sceneIndex, result });
      cleanup();
    }).catch(err => {
      console.error(`Scene regeneration error on project ${projectId}:`, err);
      broadcast('error', { projectId, error: err.message });
      cleanup();
    });

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// API: Natural Language Regeneration (PRD Section 16)
app.post('/api/projects/:id/regenerate-intent', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectDir = req.projectDir || getSafeProjectPath(projectId);
    if (!projectDir) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }
    const pJson = path.join(projectDir, 'project.json');
    if (!fs.existsSync(pJson)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const { userRequest } = req.body;

    if (!userRequest) {
      return res.status(400).json({ error: 'userRequest is required (e.g. "Make the opening stronger", "Make it 60 seconds", "Make it vertical")' });
    }

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    const onProgress = (data) => broadcast('progress', data);
    const onError = (data) => broadcast('error', data);
    pipeline.on('progress', onProgress);
    pipeline.on('error', onError);

    const cleanup = () => {
      pipeline.removeListener('progress', onProgress);
      pipeline.removeListener('error', onError);
      activePipelines.delete(projectId);
    };

    res.json({
      success: true,
      message: `Autonomous natural language regeneration started for: "${userRequest}"`
    });

    pipeline.executeNaturalLanguageRegeneration(projectId, userRequest).then(result => {
      broadcast('intent_regenerated', { projectId, userRequest, result });
      cleanup();
    }).catch(err => {
      console.error(`Regeneration error on project ${projectId}:`, err);
      broadcast('error', { projectId, error: err.message });
      cleanup();
    });

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// API: Get raw artifact content
app.get('/api/projects/:id/artifacts/:name', (req, res) => {
  try {
    const { id, name } = req.params;
    const filePath = getSafeArtifactPath(id, name);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid project ID or artifact name' });
    }

    const safeName = path.basename(name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Artifact ${safeName} not found` });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (safeName.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get project status (Section 22)
app.get('/api/projects/:id/status', (req, res) => {
  const projectDir = req.projectDir || getSafeProjectPath(req.params.id);
  if (!projectDir) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }
  const pJson = path.join(projectDir, 'project.json');
  if (!fs.existsSync(pJson)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(pJson, 'utf8'));
    res.json({
      id: data.id,
      status: data.status,
      currentStage: data.currentStage || data.status,
      progressPercent: data.progressPercent || 0,
      completedAt: data.completedAt,
      error: data.error,
      finalVideo: data.finalVideo
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read project status' });
  }
});

// API: List project assets (Section 22)
app.get('/api/projects/:id/assets', (req, res) => {
  const projectDir = req.projectDir || getSafeProjectPath(req.params.id);
  if (!projectDir) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  try {
    const listFiles = (dir) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).map(f => ({
        name: f,
        path: path.join(dir, f),
        sizeBytes: fs.statSync(path.join(dir, f)).size
      }));
    };

    res.json({
      recordings: listFiles(path.join(projectDir, 'recordings')),
      audio: listFiles(path.join(projectDir, 'audio')),
      assets: listFiles(path.join(projectDir, 'assets')),
      render: listFiles(path.join(projectDir, 'render')),
      artifacts: [
        'project.json',
        'project_model.json',
        'source-analysis.json',
        'evidence.json',
        'scene-manifest.json',
        'script.json',
        'qc-report.json'
      ].filter(f => fs.existsSync(path.join(projectDir, f)))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Unified Regeneration endpoint (Section 21 & 22)
app.post('/api/projects/:id/regenerate', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectDir = req.projectDir || getSafeProjectPath(projectId);
    if (!projectDir) {
      return res.status(400).json({ error: 'Invalid project ID format' });
    }
    const pJson = path.join(projectDir, 'project.json');
    if (!fs.existsSync(pJson)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { userRequest, sceneIndex, narrationText, reRecord } = req.body;

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    const onProgress = (data) => broadcast('progress', data);
    pipeline.on('progress', onProgress);

    const cleanup = () => {
      pipeline.removeListener('progress', onProgress);
      activePipelines.delete(projectId);
    };

    if (sceneIndex !== undefined && sceneIndex !== null) {
      res.json({ success: true, message: `Selective regeneration started for scene ${sceneIndex}` });
      pipeline.regenerateScene(projectId, parseInt(sceneIndex, 10), { narrationText, reRecord }).then(result => {
        broadcast('scene_regenerated', { projectId, sceneIndex, result });
        cleanup();
      }).catch(err => {
        broadcast('error', { projectId, error: err.message });
        cleanup();
      });
    } else {
      const prompt = userRequest || 'Regenerate video with refined pacing and narrative.';
      res.json({ success: true, message: `Natural language regeneration started: "${prompt}"` });
      pipeline.executeNaturalLanguageRegeneration(projectId, prompt).then(result => {
        broadcast('intent_regenerated', { projectId, userRequest: prompt, result });
        cleanup();
      }).catch(err => {
        broadcast('error', { projectId, error: err.message });
        cleanup();
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});


// API: Stream video with range support
app.get('/api/projects/:id/video', (req, res) => {
  const projectDir = req.projectDir || getSafeProjectPath(req.params.id);
  if (!projectDir) {
    return res.status(400).json({ error: 'Invalid project ID format' });
  }
  const videoPath = path.join(projectDir, 'output.mp4');
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found or still rendering.');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    let start = match[1] ? parseInt(match[1], 10) : null;
    let end = match[2] ? parseInt(match[2], 10) : null;

    if (start === null && end === null) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    if (start === null) {
      // Suffix range: bytes=-N
      const suffix = end;
      if (suffix <= 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).send('Range Not Satisfiable');
      }
      start = Math.max(0, fileSize - suffix);
      end = fileSize - 1;
    } else if (end === null) {
      // Open range: bytes=N-
      end = fileSize - 1;
    }

    if (end >= fileSize) {
      end = fileSize - 1;
    }

    if (start < 0 || start > end || start >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

const HOST = process.env.HOST || '127.0.0.1';

// Start listening with automatic port recovery
let portRecoveryAttempted = false;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    if (!portRecoveryAttempted) {
      portRecoveryAttempted = true;
      console.warn(`⚠️ Port ${config.PORT} is currently in use. Automatically freeing port...`);
      try {
        require('child_process').execSync(`fuser -k ${config.PORT}/tcp 2>/dev/null || true`);
      } catch (_) {}
      setTimeout(() => {
        server.listen(config.PORT, HOST);
      }, 600);
      return;
    }
    console.error(`\n❌ Error: Port ${config.PORT} is already in use by another process.`);
    console.error(`💡 Free the port with: fuser -k ${config.PORT}/tcp\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

const gracefulShutdown = () => {
  try {
    wss.clients.forEach(client => client.close());
    server.close(() => process.exit(0));
  } catch (_) {}
  setTimeout(() => process.exit(0), 1000).unref();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

if (require.main === module) {
  server.listen(config.PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🎬 Autonomous Creative Production Studio`);
    console.log(`🚀 Studio UI running at: http://${HOST}:${config.PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server, isAllowedWebSocketOrigin };
