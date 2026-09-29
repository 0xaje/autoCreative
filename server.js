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
    const { githubUrl, liveUrl, localPath, prompt, mode, duration, aspectRatio, voiceId, musicStyle } = req.body;

    if (!githubUrl && !liveUrl && !localPath) {
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
      broadcast('error', { projectId, error: err.message });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Start listening
server.listen(config.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎬 Autonomous Creative Production Studio`);
  console.log(`🚀 Studio UI running at: http://localhost:${config.PORT}`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
