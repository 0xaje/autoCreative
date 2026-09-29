# Autonomous Creative Production Agent 🎬

> A personal AI creative studio that turns a GitHub repository and/or live product URL into a finished, broadcast-ready MP4 video.

---

## 🌟 Overview

The **Autonomous Creative Production Agent** behaves like an autonomous creative studio. Given a GitHub repository, live web application URL, or local project, it:
1. **Understands** the project through code analysis and live DOM crawling.
2. **Enforces the Evidence Rule**: rigorously tags claims as `VERIFIED`, `PARTIAL`, `UNVERIFIED`, or `FUTURE` so unbacked claims never enter narration.
3. **Plans the Story**: structures narrative hooks, problem/solution comparisons, feature demos, and calls to action across 6 creative modes.
4. **Explores & Records Real Product Footage**: drives a headless browser with a realistic simulated cursor, click ripples, and spotlight cues.
5. **Generates Neural Voiceovers & Subtitles**: produces studio-grade speech with millisecond-synced subtitles.
6. **Renders Procedural Motion Graphics**: builds 1080p intro cards, problem/solution splits, lower-thirds, and outro CTAs with cinematic Ken Burns push-in.
7. **Mixes & Ducks Audio**: generates ambient background music beds and automatically ducks soundtrack volume under voice narration.
8. **Assembles & Normalizes Timeline**: composites video scenes, burns lower-third badges, and encodes H.264/AAC 1080p MP4.
9. **Performs Automated Quality Control**: validates stream codecs, sync, resolution, and generates a `qc-report.json`.
10. **Enables Selective Scene Regeneration**: allows re-recording or updating a single scene without re-running unaffected parts.

---

## 🏗️ Autonomous Studio Architecture

```text
User Request
  ↓
[Creative Director]      → Story Arc, Mode Selection & Scene Manifest
  ↓
[Researcher]             → Repo Scan, Live DOM Crawl & Hero Capture
  ↓
[Evidence Engine]        → Claim Classification (VERIFIED / PARTIAL / UNVERIFIED / FUTURE)
  ↓
[Product Demonstrator]   → Autonomous Interaction Planning & Element Targeting
  ↓
[Screen Recorder]        → Headless Chrome CDP Screencast with Realistic Virtual Cursor
  ↓
[Voice Producer]         → Neural TTS (edge-tts) & Synced Subtitles (VTT/JSON)
  ↓
[Motion Designer]        → Broadcast HTML5/CSS Motion Graphics (Intro, Outro, Splits)
  ↓
[Audio Engineer]         → Ambient Soundtrack Generation & Sidechain Audio Ducking
  ↓
[Video Editor]           → Multi-Track Assembly, Lower-Third Overlays & H.264/AAC Rendering
  ↓
[Quality Controller]     → Stream Verification, Bitrate, Resolution & QC Report
  ↓
Final Broadcast MP4 (.mp4)
```

---

## 🚀 Quick Start

### 1. Launch the Studio Web Control Center
```bash
npm start
```
Open **`http://localhost:4500`** in your browser to access the visual studio interface.

Features of the Web Studio:
- **Real-Time Pipeline Flowchart**: Visual status tracking across all 9 agent roles.
- **Cinematic 4K Player**: Live video playback with synchronized subtitle overlay.
- **Multi-Track Scene Timeline**: View individual scene cards, durations, and tags.
- **Selective Scene Regenerator**: Modal to edit narration or re-record a single scene on demand.
- **Evidence Inspector**: Interactive table of all extracted product claims with confidence scores.
- **Production Artifacts**: Instant access to `project.json`, `evidence.json`, `script.json`, `qc-report.json`, and recordings.

---

### 2. Command Line Interface (CLI)
You can also run productions headlessly via the CLI:

```bash
# 1-Click Launch Video using the built-in SaaS Analytics Demo
npm run demo

# Custom Launch Video for a Live URL
node cli.js --live "https://your-product.com" \
            --prompt "Create a 60-second product launch video showcasing real features" \
            --mode launch \
            --duration 60

# Product Demo for a GitHub Repository
node cli.js --github "https://github.com/org/repo" \
            --prompt "Demonstrate core developer workflow and installation" \
            --mode demo \
            --duration 45

# Vertical Social Short (9:16)
node cli.js --live "https://your-product.com" \
            --prompt "High energy 30-second vertical short highlighting the core breakthrough" \
            --mode social_short \
            --aspect 9:16 \
            --duration 30
```

---

## 🎨 Supported Creative Modes

| Mode | Target Style | Narrative Strategy |
| :--- | :--- | :--- |
| **Launch Video** | Cinematic | Visionary hook, problem/solution split, live product reveal, outro CTA. |
| **Product Demo** | Hands-On | Feature-by-feature walkthrough using authentic browser interactions. |
| **Presentation** | Architectural | Problem analysis, technical architecture, verified capabilities, roadmap. |
| **Explainer** | Educational | Concept breakdown, why it matters, how it works under the hood. |
| **Tutorial** | Walkthrough | Step-by-step actionable guide with focused cursor interactions. |
| **Social Short** | Vertical / Punchy | 9:16 format with high-energy 3s hook, rapid demo, and immediate CTA. |

---

## 🛡️ The Evidence Rule

Every substantive product claim extracted from repository documentation or live website crawls is classified into one of four states:

1. **`VERIFIED`**: Proven in the live navigable application DOM or supported by confirmed codebase dependencies. Safe for factual narration.
2. **`PARTIAL`**: Documented in features or code dependencies, but not directly present as an active primary UI button. Qualified in script.
3. **`UNVERIFIED`**: Ambitious marketing promises or enterprise fluff lacking tangible UI or runtime proof. **Strictly excluded from factual narration**.
4. **`FUTURE`**: Items labeled as "roadmap", "planned", or "coming soon". Formatted only as upcoming capabilities.

The engine saves the full breakdown to `evidence.json`.

---

## ⚡ Selective Scene Regeneration

All production artifacts are retained in `projects/<projectId>/`:
```text
projects/<projectId>/
├── project.json            # Complete studio project state & log history
├── source-analysis.json    # Crawled repository and live DOM intelligence
├── evidence.json           # Classified claims and verification rationale
├── scene-manifest.json     # Scene timeline breakdown and visual plans
├── script.json             # Full spoken narration script with cues
├── audio/                  # Scene voiceover tracks, subtitles, master ducked mix
├── recordings/             # High-definition screen recordings from Chrome CDP
├── assets/                 # Procedural motion graphic clips & hero screenshots
├── render/                 # Normalized scene segments & stitched video
├── qc-report.json          # Quality control validation report
└── output.mp4              # Final 1080p broadcast MP4
```

To regenerate an individual scene without restarting the entire production:
```javascript
const ProductionPipeline = require('./src/agents/pipeline');
const pipeline = new ProductionPipeline();

// Regenerates only Scene 3's narration & recording, then fast re-mixes and re-encodes final video
await pipeline.regenerateScene(projectId, 2, {
  narrationText: 'Updated live demonstration showing real-time event streaming.',
  reRecord: true
});
```

---

## 📊 Verification & QC

Every rendered MP4 undergoes automated inspection by the **Quality Controller**:
- Video Stream: H.264 profile, 1920×1080 resolution, ~30 FPS progressive.
- Audio Stream: AAC stereo/mono at 192 kbps.
- Duration Verification: Calibrated within tolerance of the planned timeline.
- Stream Integrity: Faststart (`+faststart`) enabled for instantaneous streaming in web browsers.

Produced by **Google DeepMind Advanced Agentic Coding**.
