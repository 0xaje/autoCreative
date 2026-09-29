# Autonomous Creative Production Agent — Scope & Milestone Plan

## 1. Project Objective
Build an autonomous personal creative studio that ingests a GitHub repository and/or live product URL with natural language directives, and outputs a finished, broadcast-quality 1080p MP4 product video without manual intervention.

---

## 2. In-Scope Slices (MVP Build Order)

### Slice 1 — Project Intelligence
* Clone/analyze repository (package.json, README, directory structure, tech stack).
* Crawl live URL (DOM tree, semantic tags, navigation, buttons, forms).
* Produce internal Project Understanding model (`project_model.json`).

### Slice 2 — Intent Engine
* Convert natural language user request into structured `CreativeIntent` model.
* Parse duration, aspect ratio (16:9 Cinema, 9:16 Vertical, 1:1 Square), tone, audience, voice preferences, and custom directives.

### Slice 3 — Evidence Verification Store
* Extract product claims from sources.
* Tag claims with statuses: `VERIFIED`, `PARTIAL`, `UNVERIFIED`, `FUTURE`.
* Strictly exclude unverified claims from final narration.

### Slice 4 — Browser Agent & Screencast Recording
* Chromium browser agent with CDP screencasting.
* Semantic element interaction (prefer accessible roles, button text, labels over coordinates).
* Virtual cursor with Bezier trajectory smoothing, click ripples, and spotlight cues.
* Record clean viewport video files (`storage/recordings/*.mp4`) with action logs.

### Slice 5 — Creative Director & Scene Manifest
* Plan narrative arc, scene sequencing, duration allocation, and visual strategy.
* Output structured `SceneManifest` (`scene-manifest.json`) and synchronized `script.json`.

### Slice 6 — Voice & Audio Synthesis
* Modular voice provider abstraction (`EdgeTTSProvider`, `OpenAIVoiceProvider`, `ElevenLabsVoiceProvider`).
* Generate high-fidelity narration with word-level and sentence-level timed subtitles (`.vtt`).
* Procedural harmonic background music synthesis with automatic sidechain ducking.

### Slice 7 — Composition & Rendering
* Deterministic scene components and motion graphics (Ken Burns push-ins, lower-thirds, callouts, CTA end cards).
* Remotion / FFmpeg composition pipeline encoding H.264/AAC MP4.

### Slice 8 — Quality Control & Inspection
* Automated technical inspection (codecs, resolution, frame rate, duration, audio streams).
* Visual checks (black frames, frozen frames, empty scenes).
* Narrative & claim alignment validation (`qc-report.json`).

### Slice 9 — Natural Language & Selective Regeneration
* Update individual scenes or apply natural language revisions ("Make opening stronger", "Make it 60 seconds", "Make it vertical") without repeating repo discovery.

---

## 3. Definition of Done
The system accepts:
* Project Name
* GitHub URL
* Live URL
* Natural-language request

And automatically returns:
* Finished 1080p MP4 video.
* Quality control PASS report (100/100).
* Interactive web studio with timeline, evidence inspector, project model, and regeneration controls.
