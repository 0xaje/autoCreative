// Autonomous Creative Production Studio Client
document.addEventListener('DOMContentLoaded', () => {
  let currentProjectId = null;
  let currentProjectData = null;
  let socket = null;
  let currentAspect = '16:9';
  let activeSubtitles = [];

  // DOM Elements
  const form = document.getElementById('production-form');
  const btnSubmit = document.getElementById('btn-submit');
  const btnQuickDemo = document.getElementById('btn-quick-demo');
  const durationSlider = document.getElementById('input-duration');
  const durationVal = document.getElementById('duration-val');
  const ratioButtons = document.querySelectorAll('.btn-ratio');
  const modeCards = document.querySelectorAll('.mode-card');
  const wsStatus = document.getElementById('ws-status');
  const progressBar = document.getElementById('pipeline-progress-bar');
  const progressText = document.getElementById('pipeline-progress-text');
  const liveTicker = document.getElementById('live-feed-ticker');

  // Video & Player Elements
  const studioVideo = document.getElementById('studio-video');
  const videoPlaceholder = document.getElementById('video-placeholder');
  const captionOverlay = document.getElementById('caption-overlay');
  const toggleCaptions = document.getElementById('toggle-captions');
  const btnDownloadMp4 = document.getElementById('btn-download-mp4');
  const currentProjectTitle = document.getElementById('current-project-title');
  const qcScoreBadge = document.getElementById('qc-score-badge');

  // Tabs & Views
  const tabButtons = document.querySelectorAll('.tab-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const timelineScenesList = document.getElementById('timeline-scenes-list');
  const evidenceTableBody = document.getElementById('evidence-table-body');
  const scriptContainer = document.getElementById('script-container');
  const evidenceStatsPills = document.getElementById('evidence-stats-pills');

  // Modal Elements
  const regenModal = document.getElementById('regen-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnConfirmRegen = document.getElementById('btn-confirm-regen');
  const regenSceneIndex = document.getElementById('regen-scene-index');
  const regenNarrationText = document.getElementById('regen-narration-text');
  const regenRerecordFootage = document.getElementById('regen-rerecord-footage');
  const regenModalTitle = document.getElementById('regen-modal-title');

  // Pipeline Flow Nodes
  const nodeMap = {
    'CREATIVE DIRECTOR': document.getElementById('node-director'),
    'RESEARCHER': document.getElementById('node-researcher'),
    'EVIDENCE ENGINE': document.getElementById('node-evidence'),
    'SCREEN RECORDER': document.getElementById('node-recorder'),
    'VOICE PRODUCER': document.getElementById('node-voice'),
    'MOTION DESIGNER': document.getElementById('node-motion'),
    'AUDIO ENGINEER': document.getElementById('node-audio'),
    'VIDEO EDITOR': document.getElementById('node-editor'),
    'QUALITY CONTROLLER': document.getElementById('node-qc')
  };

  // Initialize WebSocket connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      wsStatus.querySelector('.status-text').textContent = 'Studio Connected';
      wsStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSocketMessage(msg);
      } catch (e) {}
    };

    socket.onclose = () => {
      wsStatus.querySelector('.status-text').textContent = 'Reconnecting...';
      wsStatus.style.borderColor = 'rgba(244, 63, 94, 0.4)';
      setTimeout(connectWebSocket, 3000);
    };
  }

  // Handle incoming WebSocket messages
  function handleSocketMessage(msg) {
    if (msg.event === 'progress') {
      const { projectId, agent, message, percent } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;

      updateProgress(percent, agent, message);
    } else if (msg.event === 'complete') {
      const { projectId, projectData } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;

      onProductionCompleted(projectData);
    } else if (msg.event === 'scene_regenerated') {
      const { projectId, sceneIndex, result } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;

      onSceneRegenerated(sceneIndex, result);
    } else if (msg.event === 'error') {
      alert(`Pipeline Notification: ${msg.data.error || 'Operation failed'}`);
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
    }
  }

  // Update pipeline visual nodes & progress
  function updateProgress(percent, agent, message) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${agent.toUpperCase()} (${percent}%)`;
    liveTicker.textContent = `[${agent}] ${message}`;

    const agentKey = agent.toUpperCase().replace(/^\[REGEN\]\s*/, '');
    Object.keys(nodeMap).forEach(key => {
      const el = nodeMap[key];
      if (!el) return;
      if (key === agentKey) {
        el.classList.add('active');
        el.querySelector('.node-status').textContent = 'Active';
      } else if (el.classList.contains('active')) {
        el.classList.remove('active');
        el.classList.add('completed');
        el.querySelector('.node-status').textContent = 'Done';
      }
    });
  }

  // Production Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const githubUrl = document.getElementById('input-github').value.trim();
    const liveUrl = document.getElementById('input-live').value.trim();
    const prompt = document.getElementById('input-prompt').value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const duration = parseInt(durationSlider.value, 10);
    const voiceId = document.getElementById('select-voice').value;
    const musicStyle = document.getElementById('select-music').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'PRODUCING VIDEO (AUTONOMOUS)...';

    // Reset nodes
    Object.values(nodeMap).forEach(node => {
      if (node) {
        node.classList.remove('active', 'completed');
        node.querySelector('.node-status').textContent = 'Standby';
      }
    });

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl: githubUrl || null,
          liveUrl: liveUrl || null,
          prompt,
          mode,
          duration,
          aspectRatio: currentAspect,
          voiceId,
          musicStyle
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start production');

      currentProjectId = data.projectId;
      updateProgress(5, 'Creative Director', 'Studio initialized project ' + currentProjectId);
    } catch (err) {
      alert(err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
    }
  });

  // 1-Click Instant Demo Button
  btnQuickDemo.addEventListener('click', () => {
    document.getElementById('input-github').value = 'https://github.com/example/pulseflow-analytics';
    document.getElementById('input-live').value = `${window.location.origin}/demo-apps/saas-analytics/index.html`;
    document.getElementById('input-prompt').value = 'Create a 60-second product launch video showcasing PulseFlow live analytics, autonomous scaling, and enterprise telemetry.';
    form.dispatchEvent(new Event('submit'));
  });

  // When production finishes successfully
  function onProductionCompleted(projectData) {
    currentProjectData = projectData;
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'PRODUCE BROADCAST MP4';

    // Mark all nodes completed
    Object.values(nodeMap).forEach(n => {
      if (n) {
        n.classList.remove('active');
        n.classList.add('completed');
        n.querySelector('.node-status').textContent = 'Done';
      }
    });
    progressBar.style.width = '100%';
    progressText.textContent = 'COMPLETED (100%)';
    liveTicker.textContent = `Production ready: ${projectData.manifest?.projectTitle || 'Broadcast MP4'}`;

    // Load Video
    const videoUrl = `/api/projects/${projectData.id}/video?t=${Date.now()}`;
    studioVideo.src = videoUrl;
    studioVideo.style.display = 'block';
    videoPlaceholder.style.display = 'none';

    // Download button
    btnDownloadMp4.href = videoUrl;
    btnDownloadMp4.classList.remove('disabled');

    // Title & QC Badge
    currentProjectTitle.textContent = projectData.manifest?.projectTitle || 'Autonomous Video';
    const score = projectData.qc?.qualityScore || 100;
    qcScoreBadge.textContent = `${score}/100 ${projectData.qc?.verdict || 'PASS'}`;
    qcScoreBadge.className = 'video-badge pass';

    // Render Timeline & Scenes
    renderTimelineScenes(projectData.manifest?.scenes || []);

    // Render Evidence
    renderEvidence(projectData.evidenceSummary, projectData.id);

    // Render Script
    renderScript(projectData.manifest?.scenes || []);

    // Flatten subtitles for synchronized playback
    activeSubtitles = [];
    let cumulativeTime = 0;
    (projectData.manifest?.scenes || []).forEach(scene => {
      if (scene.subtitles && scene.subtitles.length > 0) {
        scene.subtitles.forEach(sub => {
          activeSubtitles.push({
            startSec: cumulativeTime + (sub.startMs / 1000),
            endSec: cumulativeTime + (sub.endMs / 1000),
            text: sub.text
          });
        });
      }
      cumulativeTime += (scene.audioDuration || scene.targetDuration || 5);
    });

    // Auto-play preview
    studioVideo.play().catch(() => {});
  }

  // Synchronized Caption Overlay during video playback
  studioVideo.addEventListener('timeupdate', () => {
    if (!toggleCaptions.checked || activeSubtitles.length === 0) {
      captionOverlay.style.display = 'none';
      return;
    }

    const t = studioVideo.currentTime;
    const currentSub = activeSubtitles.find(s => t >= s.startSec && t <= s.endSec);

    if (currentSub && currentSub.text) {
      captionOverlay.textContent = currentSub.text;
      captionOverlay.style.display = 'block';
    } else {
      captionOverlay.style.display = 'none';
    }
  });

  // Render Multi-Track Scene Cards
  function renderTimelineScenes(scenes) {
    if (!scenes || scenes.length === 0) {
      timelineScenesList.innerHTML = '<div class="timeline-empty">No scenes planned.</div>';
      return;
    }

    timelineScenesList.innerHTML = scenes.map((scene, idx) => `
      <div class="scene-timeline-card" data-index="${idx}">
        <div class="scene-idx">SCENE ${idx + 1}</div>
        <div class="scene-details">
          <h4>${scene.title}</h4>
          <p>${scene.narrationText}</p>
          <div class="scene-tags">
            <span class="tag-badge">${scene.type.replace('_', ' ')}</span>
            <span class="tag-badge verified">${scene.evidenceState || 'VERIFIED'}</span>
            <span class="tag-badge">${(scene.audioDuration || scene.targetDuration || 0).toFixed(1)}s</span>
          </div>
        </div>
        <button class="btn-regen-scene" onclick="window.__openRegenModal(${idx})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
      </div>
    `).join('');
  }

  // Render Evidence Table
  async function renderEvidence(summary, projectId) {
    if (!projectId) return;

    try {
      const res = await fetch(`/projects/${projectId}/evidence.json`);
      if (!res.ok) return;
      const data = await res.json();

      evidenceStatsPills.innerHTML = `
        <span class="pill verified">${data.verifiedCount} Verified</span>
        <span class="pill partial">${data.partialCount} Partial</span>
        <span class="pill unverified">${data.unverifiedCount} Unverified (Excluded)</span>
        <span class="pill future">${data.futureCount} Future Roadmap</span>
      `;

      evidenceTableBody.innerHTML = (data.claims || []).map(c => `
        <tr>
          <td><strong>${c.claim}</strong></td>
          <td><span class="pill ${c.state.toLowerCase()}">${c.state}</span></td>
          <td>${Math.round(c.confidence * 100)}%</td>
          <td style="color: var(--text-secondary);">${c.rationale}</td>
          <td><code>${c.suggestedVisual}</code></td>
        </tr>
      `).join('');
    } catch (e) {}
  }

  // Render Script View
  function renderScript(scenes) {
    if (!scenes || scenes.length === 0) return;
    scriptContainer.innerHTML = scenes.map((s, idx) => `
      <div class="script-scene-block">
        <h5>SCENE ${idx + 1}: ${s.title.toUpperCase()} (${s.evidenceState || 'VERIFIED'})</h5>
        <p>${s.narrationText}</p>
      </div>
    `).join('');
  }

  // Open Selective Regeneration Modal
  window.__openRegenModal = (sceneIndex) => {
    if (!currentProjectData || !currentProjectData.manifest) return;
    const scene = currentProjectData.manifest.scenes[sceneIndex];
    if (!scene) return;

    regenSceneIndex.value = sceneIndex;
    regenModalTitle.textContent = `Regenerate Scene ${sceneIndex + 1}: ${scene.title}`;
    regenNarrationText.value = scene.narrationText;
    regenModal.classList.add('active');
  };

  // Close Modal
  function closeModal() {
    regenModal.classList.remove('active');
  }
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  // Confirm Regeneration
  btnConfirmRegen.addEventListener('click', async () => {
    const sceneIdx = parseInt(regenSceneIndex.value, 10);
    const newText = regenNarrationText.value.trim();
    const reRecord = regenRerecordFootage.checked;

    closeModal();
    btnSubmit.disabled = true;
    btnSubmit.textContent = `REGENERATING SCENE ${sceneIdx + 1}...`;

    try {
      const res = await fetch(`/api/projects/${currentProjectId}/regenerate-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex: sceneIdx,
          narrationText: newText,
          reRecord
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to trigger regeneration');
      }
    } catch (err) {
      alert(`Regeneration Error: ${err.message}`);
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
    }
  });

  // Handle regenerated scene result
  function onSceneRegenerated(sceneIndex, result) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'PRODUCE BROADCAST MP4';

    // Update project state
    if (currentProjectData) {
      currentProjectData.manifest.scenes[sceneIndex] = result.scene;
    }

    // Refresh Video Player
    const videoUrl = `/api/projects/${currentProjectId}/video?t=${Date.now()}`;
    studioVideo.src = videoUrl;
    studioVideo.play().catch(() => {});

    // Re-render views
    renderTimelineScenes(currentProjectData.manifest.scenes);
    renderScript(currentProjectData.manifest.scenes);

    alert(`✅ Scene ${sceneIndex + 1} selectively regenerated and video updated!`);
  }

  // Duration Slider Input
  durationSlider.addEventListener('input', (e) => {
    durationVal.textContent = `${e.target.value}s`;
  });

  // Aspect Ratio Buttons
  ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAspect = btn.dataset.ratio;
    });
  });

  // Mode Selection Cards
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Tab Navigation
  tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      tabButtons.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Start WebSocket
  connectWebSocket();
});
