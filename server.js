const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const config = require('./src/config');
const ProductionPipeline = require('./src/agents/pipeline');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') return; // Handled on server
  console.error('WebSocket server error:', err);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use('/projects', express.static(config.PROJECTS_DIR));
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

// API: List projects
app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(config.PROJECTS_DIR)) {
      return res.json({ projects: [] });
    }
    const dirs = fs.readdirSync(config.PROJECTS_DIR);
    const projects = [];

    for (const dir of dirs) {
      const pJson = path.join(config.PROJECTS_DIR, dir, 'project.json');
      if (fs.existsSync(pJson)) {
        try {
          const data = JSON.parse(fs.readFileSync(pJson, 'utf8'));
          projects.push(data);
        } catch (e) {}
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
  const pJson = path.join(config.PROJECTS_DIR, req.params.id, 'project.json');
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

    const projectId = `proj_${Date.now()}`;
    const pipeline = new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    pipeline.on('progress', (data) => broadcast('progress', data));
    pipeline.on('complete', (data) => broadcast('complete', data));
    pipeline.on('error', (data) => broadcast('error', data));

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
    const { sceneIndex, narrationText, visualPlan, voiceId, reRecord } = req.body;

    if (sceneIndex === undefined || sceneIndex === null) {
      return res.status(400).json({ error: 'sceneIndex is required' });
    }

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);
    pipeline.on('progress', (data) => broadcast('progress', data));

    res.json({ success: true, message: `Selective regeneration started for scene ${sceneIndex}` });

    pipeline.regenerateScene(projectId, parseInt(sceneIndex, 10), {
      narrationText,
      visualPlan,
      voiceId,
      reRecord
    }).then(result => {
      broadcast('scene_regenerated', { projectId, sceneIndex, result });
    }).catch(err => {
      console.error(`Scene regeneration error on project ${projectId}:`, err);
      broadcast('error', { projectId, error: err.message });
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
    const { userRequest } = req.body;

    if (!userRequest) {
      return res.status(400).json({ error: 'userRequest is required (e.g. "Make the opening stronger", "Make it 60 seconds", "Make it vertical")' });
    }

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);

    pipeline.on('progress', (data) => broadcast('progress', data));
    pipeline.on('error', (data) => broadcast('error', data));

    res.json({
      success: true,
      message: `Autonomous natural language regeneration started for: "${userRequest}"`
    });

    pipeline.executeNaturalLanguageRegeneration(projectId, userRequest).then(result => {
      broadcast('intent_regenerated', { projectId, userRequest, result });
    }).catch(err => {
      console.error(`Regeneration error on project ${projectId}:`, err);
      broadcast('error', { projectId, error: err.message });
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
    const safeName = path.basename(name);
    const filePath = path.join(config.PROJECTS_DIR, id, safeName);

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
  const pJson = path.join(config.PROJECTS_DIR, req.params.id, 'project.json');
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
  const projectDir = path.join(config.PROJECTS_DIR, req.params.id);
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
    const { userRequest, sceneIndex, narrationText, reRecord } = req.body;

    const pipeline = activePipelines.get(projectId) || new ProductionPipeline();
    activePipelines.set(projectId, pipeline);
    pipeline.on('progress', (data) => broadcast('progress', data));

    if (sceneIndex !== undefined && sceneIndex !== null) {
      res.json({ success: true, message: `Selective regeneration started for scene ${sceneIndex}` });
      pipeline.regenerateScene(projectId, parseInt(sceneIndex, 10), { narrationText, reRecord }).then(result => {
        broadcast('scene_regenerated', { projectId, sceneIndex, result });
      }).catch(err => broadcast('error', { projectId, error: err.message }));
    } else {
      const prompt = userRequest || 'Regenerate video with refined pacing and narrative.';
      res.json({ success: true, message: `Natural language regeneration started: "${prompt}"` });
      pipeline.executeNaturalLanguageRegeneration(projectId, prompt).then(result => {
        broadcast('intent_regenerated', { projectId, userRequest: prompt, result });
      }).catch(err => broadcast('error', { projectId, error: err.message }));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});


// API: Stream video with range support
app.get('/api/projects/:id/video', (req, res) => {
  const videoPath = path.join(config.PROJECTS_DIR, req.params.id, 'output.mp4');
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found or still rendering.');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
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
        server.listen(config.PORT);
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

server.listen(config.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎬 Autonomous Creative Production Studio`);
  console.log(`🚀 Studio UI running at: http://localhost:${config.PORT}`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
