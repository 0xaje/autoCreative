# Autonomous Creative Production Agent — Product Requirements Document

## 1. Product Vision
Create a personal AI creative studio where a user can provide something they built and simply say what they want to communicate.
The system handles the creative and technical production work autonomously.

Example:
> "Here's my project. Make a premium 90-second video that makes someone understand what it does and why it matters."

The system understands the project, inspects the real application, decides what matters, creates the story, records the application, produces narration, edits the material, and returns a finished MP4.

---

## 2. Core User Journey
1. **Create Project**: User enters Project name, GitHub URL, Live URL, Creative request.
2. **Analyze**: Repository analysis (README, package manifests, AST/code) & Browser discovery (Chromium, semantic inspection).
3. **Build Project Understanding**: Generates internal truth model (`project_model.json`).
4. **Plan**: Creative Director designs Scene Manifest and script.
5. **Explore & Record**: High-fidelity Chromium screencast with realistic cursor.
6. **Voice & Music**: Neural TTS narration, word-timed subtitles, procedural harmonic ducked music.
7. **Compose & Render**: H.264 / AAC 1080p broadcast MP4.
8. **Quality Control**: Automated technical, visual, and narrative validation.
9. **Natural-Language Regeneration**: Selective modification of artifacts without re-discovery.
