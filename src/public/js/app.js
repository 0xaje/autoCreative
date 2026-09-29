// Autonomous Creative Production Studio — Client Console
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
  const btnOpenArchive = document.getElementById('btn-open-archive');
  const durationSlider = document.getElementById('input-duration');
  const durationVal = document.getElementById('duration-val');
  const ratioButtons = document.querySelectorAll('.ratio-btn');
  const modeCards = document.querySelectorAll('.mode-option');
  const sourceTabs = document.querySelectorAll('.source-tab');
  const wsStatus = document.getElementById('ws-status');
  const wsStatusText = document.getElementById('ws-status-text');
  const progressText = document.getElementById('pipeline-progress-text');
  const liveTicker = document.getElementById('live-feed-ticker');
  const tickerAgent = document.getElementById('ticker-agent');

  // Video & Monitor Elements
  const monitorFrame = document.getElementById('monitor-frame');
  const studioVideo = document.getElementById('studio-video');
  const videoPlaceholder = document.getElementById('video-placeholder');
  const captionOverlay = document.getElementById('caption-overlay');
  const captionText = document.getElementById('caption-text');
  const toggleCaptions = document.getElementById('toggle-captions');
  const btnDownloadMp4 = document.getElementById('btn-download-mp4');
  const currentProjectTitle = document.getElementById('current-project-title');
  const qcScoreBadge = document.getElementById('qc-score-badge');

  // Tabs & Views
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const timelineScenesList = document.getElementById('timeline-scenes-list');
  const evidenceTableBody = document.getElementById('evidence-table-body');
  const evidenceStatsPills = document.getElementById('evidence-stats-pills');
  const scriptContainer = document.getElementById('script-container');

  // Natural Language Regeneration Elements (PRD Section 16)
  const regenIntentForm = document.getElementById('regen-intent-form');
  const inputRegenPrompt = document.getElementById('input-regen-prompt');
  const btnRegenSubmit = document.getElementById('btn-regen-submit');
  const regenChips = document.querySelectorAll('.regen-chip-btn');

  // Project Truth Model Elements (PRD Section 3)
  const modelProjectName = document.getElementById('model-project-name');
  const modelPurpose = document.getElementById('model-purpose');
  const modelTargetUser = document.getElementById('model-target-user');
  const modelProblem = document.getElementById('model-problem');
  const modelFeaturesList = document.getElementById('model-features-list');
  const modelWorkflowsList = document.getElementById('model-workflows-list');

  // Modals
  const artifactModal = document.getElementById('artifact-modal');
  const btnCloseArtModal = document.getElementById('btn-close-art-modal');
  const btnCloseArtFooter = document.getElementById('btn-close-art-footer');
  const artifactModalTitle = document.getElementById('artifact-modal-title');
  const artifactCodeContent = document.getElementById('artifact-code-content');

  const regenModal = document.getElementById('regen-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnConfirmRegen = document.getElementById('btn-confirm-regen');
  const regenSceneIndex = document.getElementById('regen-scene-index');
  const regenNarrationText = document.getElementById('regen-narration-text');
  const regenRerecordFootage = document.getElementById('regen-rerecord-footage');
  const regenModalTitle = document.getElementById('regen-modal-title');

  const archiveModal = document.getElementById('archive-modal');
  const btnCloseArchive = document.getElementById('btn-close-archive');
  const btnCloseArchiveFooter = document.getElementById('btn-close-archive-footer');
  const archiveProjectsList = document.getElementById('archive-projects-list');

  // 9 Canonical Production Rail Steps
  const railSteps = [
    { id: 'rail-understand', name: 'UNDERSTAND', stages: ['ANALYZING', 'RESEARCHER'] },
    { id: 'rail-verify', name: 'VERIFY', stages: ['CLASSIFYING', 'EVIDENCE ENGINE'] },
    { id: 'rail-direct', name: 'DIRECT', stages: ['PLANNING', 'CREATIVE DIRECTOR'] },
    { id: 'rail-capture', name: 'CAPTURE', stages: ['RECORDING', 'EXPLORING', 'SCREEN RECORDER', 'BROWSER AGENT'] },
    { id: 'rail-create', name: 'CREATE', stages: ['GENERATING_AUDIO', 'GENERATING_MOTION', 'VOICE PRODUCER', 'MOTION DESIGNER'] },
    { id: 'rail-compose', name: 'COMPOSE', stages: ['COMPOSING', 'AUDIO ENGINEER'] },
    { id: 'rail-render', name: 'RENDER', stages: ['RENDERING', 'VIDEO EDITOR'] },
    { id: 'rail-review', name: 'REVIEW', stages: ['QUALITY_CHECK', 'QUALITY CONTROLLER'] },
    { id: 'rail-deliver', name: 'DELIVER', stages: ['COMPLETED'] }
  ];

  // Initialize WebSocket connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (wsStatusText) wsStatusText.textContent = 'Studio Online';
      if (wsStatus) {
        const dot = wsStatus.querySelector('.status-dot');
        if (dot) dot.className = 'status-dot live';
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSocketMessage(msg);
      } catch (e) {
        console.error('Socket message parse error:', e);
      }
    };

    socket.onclose = () => {
      if (wsStatusText) wsStatusText.textContent = 'Reconnecting...';
      if (wsStatus) {
        const dot = wsStatus.querySelector('.status-dot');
        if (dot) dot.className = 'status-dot';
      }
      setTimeout(connectWebSocket, 3000);
    };
  }

  // Handle incoming WebSocket messages
  function handleSocketMessage(msg) {
    if (msg.event === 'progress') {
      const { projectId, agent, message, percent } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;
      updateRailProgress(percent, agent, message);
    } else if (msg.event === 'complete') {
      const { projectId, projectData } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;
      onProductionCompleted(projectData);
    } else if (msg.event === 'scene_regenerated') {
      const { projectId, sceneIndex, result } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;
      onSceneRegenerated(sceneIndex, result);
    } else if (msg.event === 'intent_regenerated') {
      const { projectId, userRequest, result } = msg.data;
      if (currentProjectId && projectId !== currentProjectId) return;
      if (btnRegenSubmit) {
        btnRegenSubmit.disabled = false;
        btnRegenSubmit.textContent = 'Regenerate Video';
      }
      currentProjectData = result.projectData;
      onProductionCompleted(currentProjectData);
      showNotification(`Regeneration complete: "${userRequest}"`);
    } else if (msg.event === 'error') {
      showNotification(`Pipeline Alert: ${msg.data.error || 'Operation failed'}`, true);
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
      if (btnRegenSubmit) {
        btnRegenSubmit.disabled = false;
        btnRegenSubmit.textContent = 'Regenerate Video';
      }
    }
  }

  // Update Production Rail Steps & Ticker
  function updateRailProgress(percent, agent, message) {
    if (progressText) progressText.textContent = `${agent.toUpperCase()} (${percent}%)`;
    if (tickerAgent) tickerAgent.textContent = `${agent.toUpperCase()}:`;
    if (liveTicker) liveTicker.textContent = message;

    const normalizedAgent = (agent || '').toUpperCase();
    let matchedStepIndex = -1;

    for (let i = 0; i < railSteps.length; i++) {
      const step = railSteps[i];
      if (step.stages.some(s => normalizedAgent.includes(s))) {
        matchedStepIndex = i;
        break;
      }
    }

    if (matchedStepIndex === -1) {
      if (percent < 20) matchedStepIndex = 0;
      else if (percent < 35) matchedStepIndex = 1;
      else if (percent < 50) matchedStepIndex = 2;
      else if (percent < 65) matchedStepIndex = 3;
      else if (percent < 75) matchedStepIndex = 4;
      else if (percent < 85) matchedStepIndex = 5;
      else if (percent < 92) matchedStepIndex = 6;
      else if (percent < 98) matchedStepIndex = 7;
      else matchedStepIndex = 8;
    }

    railSteps.forEach((step, idx) => {
      const el = document.getElementById(step.id);
      if (!el) return;
      el.classList.remove('active', 'completed');
      if (idx < matchedStepIndex) {
        el.classList.add('completed');
      } else if (idx === matchedStepIndex) {
        el.classList.add('active');
      }
    });
  }

  // Source Switcher
  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const type = tab.dataset.source;
      const gh = document.getElementById('input-github');
      const live = document.getElementById('input-live');

      if (type === 'repo') {
        gh.style.display = 'block';
        live.style.display = 'block';
        gh.focus();
      } else if (type === 'live') {
        gh.style.display = 'none';
        live.style.display = 'block';
        live.focus();
      } else if (type === 'demo') {
        gh.style.display = 'block';
        live.style.display = 'block';
        gh.value = 'https://github.com/example/pulseflow-analytics';
        live.value = `${window.location.origin}/demo-apps/saas-analytics/index.html`;
      }
    });
  });

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

    // Reset rail steps
    railSteps.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) el.classList.remove('active', 'completed');
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
      updateRailProgress(5, 'RESEARCHER', `Studio initiated project ${currentProjectId}`);
    } catch (err) {
      showNotification(err.message, true);
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
    }
  });

  // Quick Demo / Sample Button
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

    // Mark all steps completed
    railSteps.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) {
        el.classList.remove('active');
        el.classList.add('completed');
      }
    });

    if (progressText) progressText.textContent = 'DELIVERED (100%)';
    if (tickerAgent) tickerAgent.textContent = 'DELIVERED:';
    if (liveTicker) liveTicker.textContent = `Broadcast MP4 ready: ${projectData.manifest?.projectTitle || 'Final Output'}`;

    // Aspect Ratio container adjustment
    const aspect = projectData.inputs?.aspectRatio || projectData.manifest?.aspectRatio || '16:9';
    if (aspect === '9:16') {
      monitorFrame.classList.remove('aspect-16-9');
      monitorFrame.classList.add('aspect-9-16');
    } else {
      monitorFrame.classList.remove('aspect-9-16');
      monitorFrame.classList.add('aspect-16-9');
    }

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
    const score = projectData.qc?.qualityScore || projectData.qcReport?.qualityScore || 100;
    const verdict = projectData.qc?.verdict || projectData.qcReport?.verdict || 'PASS';
    qcScoreBadge.textContent = `${score}/100 ${verdict}`;
    qcScoreBadge.className = 'qc-badge pass';

    // Render Editorial Timeline
    renderEditorialTimeline(projectData.manifest?.scenes || []);

    // Render Project Truth Model
    renderProjectModel(projectData.id);

    // Render Evidence
    renderEvidence(projectData.id);

    // Render Script
    renderScript(projectData.manifest?.scenes || []);

    // Synchronize subtitles and timecode tracking
    activeSubtitles = [];
    activeScenesList = [];
    let cumulativeTime = 0;
    (projectData.manifest?.scenes || []).forEach(scene => {
      const dur = (scene.audioDuration || scene.targetDuration || 5);
      activeScenesList.push({
        ...scene,
        startSec: cumulativeTime,
        endSec: cumulativeTime + dur
      });

      if (scene.subtitles && scene.subtitles.length > 0) {
        scene.subtitles.forEach(sub => {
          activeSubtitles.push({
            startSec: cumulativeTime + (sub.startMs / 1000),
            endSec: cumulativeTime + (sub.endMs / 1000),
            text: sub.text
          });
        });
      }
      cumulativeTime += dur;
    });

    studioVideo.play().catch(() => {});
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Synchronized Subtitle Overlay, Timecode & Active Timeline Scene
  studioVideo.addEventListener('timeupdate', () => {
    const t = studioVideo.currentTime;
    const dur = studioVideo.duration || (currentProjectData?.finalVideo?.duration || 0);

    const timecodeDisplay = document.getElementById('timecode-display');
    if (timecodeDisplay) {
      timecodeDisplay.textContent = `${formatTime(t)} / ${formatTime(dur)}`;
    }

    // Active scene highlighting in timeline
    if (activeScenesList.length > 0) {
      document.querySelectorAll('.timeline-scene-card').forEach((card, idx) => {
        const sc = activeScenesList[idx];
        if (sc && t >= sc.startSec && t < sc.endSec) {
          card.classList.add('active-scene');
        } else {
          card.classList.remove('active-scene');
        }
      });
    }

    if (!toggleCaptions.checked || activeSubtitles.length === 0) {
      captionOverlay.style.display = 'none';
      return;
    }

    const currentSub = activeSubtitles.find(s => t >= s.startSec && t <= s.endSec);

    if (currentSub && currentSub.text) {
      captionText.textContent = currentSub.text;
      captionOverlay.style.display = 'block';
    } else {
      captionOverlay.style.display = 'none';
    }
  });

  // Render Multi-Track Editorial Timeline
  function renderEditorialTimeline(scenes) {
    if (!scenes || scenes.length === 0) {
      timelineScenesList.innerHTML = '<div class="form-hint" style="padding: 16px;">No scenes planned.</div>';
      return;
    }

    timelineScenesList.innerHTML = scenes.map((scene, idx) => `
      <div class="timeline-scene-card" data-index="${idx}" tabindex="0" role="button" aria-label="Seek to Scene ${idx + 1}: ${scene.title}">
        <span class="scene-num-badge">SCENE 0${idx + 1} &bull; ${(scene.audioDuration || scene.targetDuration || 0).toFixed(1)}s</span>
        <h4 class="scene-title-text">${scene.title}</h4>
        <p class="scene-narration-snippet">${scene.narrationText}</p>
        <div class="scene-tags-group">
          <span class="pill-tag">${scene.type.replace('_', ' ')}</span>
          <span class="pill-tag verified">${scene.evidenceState || 'VERIFIED'}</span>
        </div>
        <button type="button" class="btn-scene-regen" onclick="window.__openRegenModal(${idx})">
          Regenerate Scene
        </button>
      </div>
    `).join('');

    // Attach click-to-seek listeners on scene cards
    document.querySelectorAll('.timeline-scene-card').forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-scene-regen')) return;
        const sc = activeScenesList[idx];
        if (sc) {
          studioVideo.currentTime = sc.startSec;
          studioVideo.play().catch(() => {});
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('.btn-scene-regen')) return;
          e.preventDefault();
          const sc = activeScenesList[idx];
          if (sc) {
            studioVideo.currentTime = sc.startSec;
            studioVideo.play().catch(() => {});
          }
        }
      });
    });
  }

  // Render Evidence Inspector
  async function renderEvidence(projectId) {
    if (!projectId) return;

    try {
      const res = await fetch(`/projects/${projectId}/evidence.json`);
      if (!res.ok) return;
      const data = await res.json();

      evidenceStatsPills.innerHTML = `
        <span class="evidence-pill verified">${data.verifiedCount || 0} Verified</span>
        <span class="evidence-pill partial">${data.partialCount || 0} Partial</span>
        <span class="evidence-pill unverified">${data.unverifiedCount || 0} Unverified (Excluded)</span>
        <span class="evidence-pill future">${data.futureCount || 0} Future Roadmap</span>
      `;

      evidenceTableBody.innerHTML = (data.claims || []).map(c => `
        <tr>
          <td><strong style="color: var(--text-primary);">${c.claim}</strong></td>
          <td><span class="evidence-pill ${(c.state || '').toLowerCase()}">${c.state}</span></td>
          <td style="font-family: var(--font-mono);">${Math.round((c.confidence || 0) * 100)}%</td>
          <td style="color: var(--text-secondary);">${c.rationale || '—'}</td>
          <td><code style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-primary);">${c.suggestedVisual || '—'}</code></td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Error rendering evidence:', e);
    }
  }

  // Render Project Truth Model (PRD Section 3)
  async function renderProjectModel(projectId) {
    if (!projectId) return;

    try {
      const res = await fetch(`/projects/${projectId}/project_model.json`);
      if (!res.ok) return;
      const data = await res.json();

      if (modelProjectName) modelProjectName.textContent = data.project || 'Active Project';
      if (modelPurpose) modelPurpose.textContent = data.purpose || 'Autonomous software solution';
      if (modelTargetUser) modelTargetUser.textContent = data.target_user || 'Developers and technical teams';
      if (modelProblem) modelProblem.textContent = data.problem || 'Fragmented workflows and lack of real-time visibility';

      if (modelFeaturesList) {
        if (data.features && data.features.length > 0) {
          modelFeaturesList.innerHTML = data.features.map(f =>
            `<span class="pill-tag verified">${f}</span>`
          ).join('');
        } else {
          modelFeaturesList.innerHTML = '<span class="form-hint">No explicit features listed.</span>';
        }
      }

      if (modelWorkflowsList) {
        if (data.workflows && data.workflows.length > 0) {
          modelWorkflowsList.innerHTML = data.workflows.map(w => `
            <div style="display: flex; justify-content: space-between; padding: 6px 10px; background-color: var(--studio-surface-elevated); border-radius: var(--radius-sm); font-size: 12px;">
              <span style="font-weight: 600; color: var(--text-primary);">${w.name || w.id || 'Interactive Workflow'}</span>
              <span style="font-family: var(--font-mono); color: var(--text-muted);">${w.action || w.target || 'CDP Exploration'}</span>
            </div>
          `).join('');
        } else {
          modelWorkflowsList.innerHTML = '<span class="form-hint">Autonomous workflow discovery logged during browser exploration.</span>';
        }
      }
    } catch (e) {
      console.error('Error loading project model:', e);
    }
  }

  // Render Script
  function renderScript(scenes) {
    if (!scenes || scenes.length === 0) return;
    scriptContainer.innerHTML = scenes.map((s, idx) => `
      <div style="padding: 12px; background-color: var(--studio-surface); border-radius: var(--radius-sm); margin-bottom: 8px;">
        <span class="form-hint" style="font-weight: 700;">SCENE 0${idx + 1}: ${s.title.toUpperCase()} (${s.evidenceState || 'VERIFIED'})</span>
        <p style="margin-top: 6px; font-size: 13px; color: var(--text-primary); line-height: 1.5;">${s.narrationText}</p>
      </div>
    `).join('');
  }

  // Selective Scene Regeneration Modal
  window.__openRegenModal = (sceneIndex) => {
    if (!currentProjectData || !currentProjectData.manifest) return;
    const scene = currentProjectData.manifest.scenes[sceneIndex];
    if (!scene) return;

    regenSceneIndex.value = sceneIndex;
    regenModalTitle.textContent = `Regenerate Scene ${sceneIndex + 1}: ${scene.title}`;
    regenNarrationText.value = scene.narrationText;
    regenModal.classList.add('active');
  };

  function closeModal() {
    regenModal.classList.remove('active');
  }
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  if (btnConfirmRegen) {
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
        showNotification(`Regeneration Error: ${err.message}`, true);
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'PRODUCE BROADCAST MP4';
      }
    });
  }

  function onSceneRegenerated(sceneIndex, result) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'PRODUCE BROADCAST MP4';

    if (currentProjectData && currentProjectData.manifest) {
      currentProjectData.manifest.scenes[sceneIndex] = result.scene;
    }

    const videoUrl = `/api/projects/${currentProjectId}/video?t=${Date.now()}`;
    studioVideo.src = videoUrl;
    studioVideo.play().catch(() => {});

    renderEditorialTimeline(currentProjectData.manifest.scenes);
    renderScript(currentProjectData.manifest.scenes);
    showNotification(`Scene ${sceneIndex + 1} regenerated and master video updated`);
  }

  // Duration Slider
  durationSlider.addEventListener('input', (e) => {
    durationVal.textContent = `${e.target.value}s`;
  });

  // Aspect Ratio Switcher
  ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAspect = btn.dataset.ratio;
    });
  });

  // Strategy Mode Selector
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Workspace Tabs
  tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      tabButtons.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetId = tab.dataset.tab;
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
    });
  });

  // Natural Language Regeneration Presets
  regenChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (inputRegenPrompt) {
        inputRegenPrompt.value = chip.dataset.prompt;
        inputRegenPrompt.focus();
      }
    });
  });

  // Natural Language Regeneration Submit
  if (regenIntentForm) {
    regenIntentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentProjectId) {
        showNotification('Please load or produce a project first.', true);
        return;
      }

      const prompt = inputRegenPrompt.value.trim();
      if (!prompt) return;

      btnRegenSubmit.disabled = true;
      btnRegenSubmit.textContent = 'REGENERATING (AUTONOMOUS)...';

      try {
        const res = await fetch(`/api/projects/${currentProjectId}/regenerate-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userRequest: prompt })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start regeneration');

        updateRailProgress(15, 'CREATIVE DIRECTOR', `Natural language regeneration initiated: "${prompt}"`);
      } catch (err) {
        showNotification(`Regeneration Error: ${err.message}`, true);
        btnRegenSubmit.disabled = false;
        btnRegenSubmit.textContent = 'Regenerate Video';
      }
    });
  }

  // Section 24 Artifact Cards Click
  document.querySelectorAll('.artifact-card').forEach(card => {
    card.addEventListener('click', async () => {
      const fileName = card.dataset.file;
      if (!fileName) return;

      if (!currentProjectId) {
        showNotification('Produce or select a project first to inspect artifacts.', true);
        return;
      }

      artifactModalTitle.textContent = fileName;
      artifactCodeContent.textContent = 'Loading artifact content...';
      artifactModal.classList.add('active');

      try {
        const res = await fetch(`/api/projects/${currentProjectId}/artifacts/${fileName}`);
        if (!res.ok) throw new Error(`Artifact ${fileName} not found on server.`);
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          artifactCodeContent.textContent = JSON.stringify(parsed, null, 2);
        } catch (e) {
          artifactCodeContent.textContent = text;
        }
      } catch (err) {
        artifactCodeContent.textContent = `Error loading artifact: ${err.message}`;
      }
    });
  });

  function closeArtModal() {
    if (artifactModal) artifactModal.classList.remove('active');
  }
  if (btnCloseArtModal) btnCloseArtModal.addEventListener('click', closeArtModal);
  if (btnCloseArtFooter) btnCloseArtFooter.addEventListener('click', closeArtModal);

  // Creative Archive Drawer / Modal
  if (btnOpenArchive) {
    btnOpenArchive.addEventListener('click', async () => {
      archiveModal.classList.add('active');
      archiveProjectsList.innerHTML = '<span class="form-hint">Loading past productions...</span>';

      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to load project archive');
        const data = await res.json();
        const projects = data.projects || [];

        if (projects.length === 0) {
          archiveProjectsList.innerHTML = '<span class="form-hint">No past productions found in archive.</span>';
          return;
        }

        archiveProjectsList.innerHTML = projects.map(p => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: var(--studio-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <div>
              <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${p.manifest?.projectTitle || p.id}</span>
              <div style="margin-top: 4px; display: flex; gap: 8px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
                <span>${p.inputs?.mode || 'launch'}</span>
                <span>&bull;</span>
                <span>${p.inputs?.duration || 60}s</span>
                <span>&bull;</span>
                <span>${p.inputs?.aspectRatio || '16:9'}</span>
                <span>&bull;</span>
                <span style="color: ${p.status === 'COMPLETED' ? 'var(--status-verified)' : 'var(--text-secondary)'};">${p.status}</span>
              </div>
            </div>
            <button type="button" class="btn btn-secondary" onclick="window.__loadArchiveProject('${p.id}')">
              Open in Studio
            </button>
          </div>
        `).join('');
      } catch (err) {
        archiveProjectsList.innerHTML = `<span class="form-hint" style="color: var(--status-error);">Error: ${err.message}</span>`;
      }
    });
  }

  window.__loadArchiveProject = async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Project not found');
      const project = await res.json();
      archiveModal.classList.remove('active');
      currentProjectId = project.id;
      currentProjectData = project;
      onProductionCompleted(project);
      showNotification(`Loaded archived production: ${project.manifest?.projectTitle || project.id}`);
    } catch (e) {
      showNotification(`Failed to load project: ${e.message}`, true);
    }
  };

  function closeArchiveModal() {
    if (archiveModal) archiveModal.classList.remove('active');
  }
  if (btnCloseArchive) btnCloseArchive.addEventListener('click', closeArchiveModal);
  if (btnCloseArchiveFooter) btnCloseArchiveFooter.addEventListener('click', closeArchiveModal);

  // Subtle Notification Toast
  function showNotification(text, isError = false) {
    let toast = document.getElementById('studio-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'studio-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.padding = '10px 16px';
      toast.style.borderRadius = 'var(--radius-sm)';
      toast.style.fontFamily = 'var(--font-mono)';
      toast.style.fontSize = '12px';
      toast.style.zIndex = '999';
      toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
      toast.style.transition = 'all 200ms ease-out';
      document.body.appendChild(toast);
    }

    toast.style.backgroundColor = isError ? 'var(--studio-base)' : 'var(--studio-surface-elevated)';
    toast.style.border = isError ? '1px solid var(--status-error)' : '1px solid var(--border-muted)';
    toast.style.color = isError ? 'var(--status-error)' : 'var(--text-primary)';
    toast.textContent = text;
    toast.style.display = 'block';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 200);
    }, 4000);
  }

  // Load Latest Project on startup
  async function loadInitialProject() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      if (data.projects && data.projects.length > 0) {
        const latest = data.projects.find(p => p.status === 'COMPLETED' || p.finalVideo) || data.projects[0];
        if (latest && (latest.status === 'COMPLETED' || latest.finalVideo)) {
          currentProjectId = latest.id;
          currentProjectData = latest;
          onProductionCompleted(latest);
        }
      }
    } catch (e) {
      console.log('No prior projects loaded:', e);
    }
  }

  // Editorial Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (studioVideo.paused) {
        studioVideo.play().catch(() => {});
      } else {
        studioVideo.pause();
      }
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      studioVideo.currentTime = Math.max(0, studioVideo.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      studioVideo.currentTime = Math.min(studioVideo.duration || 0, studioVideo.currentTime + 5);
    } else if (e.key === 'm' || e.key === 'M') {
      studioVideo.muted = !studioVideo.muted;
      showNotification(studioVideo.muted ? 'Muted' : 'Unmuted');
    }
  });

  connectWebSocket();
  loadInitialProject();
});
