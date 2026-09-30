const path = require('path');
const fs = require('fs');

// Resolve ffmpeg and ffprobe binaries
let ffmpegPath = '';
let ffprobePath = '';

try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

try {
  ffprobePath = require('@ffprobe-installer/ffprobe').path;
} catch (e) {
  ffprobePath = 'ffprobe';
}

// Locate Chrome / Chromium executable
let chromePath = '/usr/bin/google-chrome';
if (!fs.existsSync(chromePath)) {
  const possiblePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      chromePath = p;
      break;
    }
  }
}

module.exports = {
  PORT: process.env.PORT || 4500,
  ROOT_DIR: path.resolve(__dirname, '..'),
  PROJECTS_DIR: path.resolve(__dirname, '..', 'projects'),
  DEMO_APPS_DIR: path.resolve(__dirname, '..', 'demo-apps'),
  BINARIES: {
    ffmpeg: ffmpegPath,
    ffprobe: ffprobePath,
    chrome: chromePath,
    edgeTts: 'edge-tts'
  },
  DEFAULT_SPECS: {
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    aspect_ratio: '16:9',
    fps: 30,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    videoBitrate: '4500k',
    defaultVoice: 'en-US-ChristopherNeural',
    defaultDuration: 60,
    defaultMode: 'launch'
  },
  RESOLUTIONS: {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 }
  },
  VOICES: [
    { id: 'en-US-ChristopherNeural', name: 'Christopher (Male, Professional Tech & Founder)', lang: 'en-US', gender: 'Male' },
    { id: 'en-US-JennyNeural', name: 'Jenny (Female, Clear & Dynamic)', lang: 'en-US', gender: 'Female' },
    { id: 'en-US-GuyNeural', name: 'Guy (Male, Casual & Engaging)', lang: 'en-US', gender: 'Male' },
    { id: 'en-US-AriaNeural', name: 'Aria (Female, Polished Presenter)', lang: 'en-US', gender: 'Female' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia (Female, Sophisticated British)', lang: 'en-GB', gender: 'Female' }
  ],
  CREATIVE_MODES: {
    presentation: {
      name: 'Product Presentation',
      tagline: 'Professional presentation of a real software product',
      pacing: 'measured',
      style: 'architectural',
      tone: 'authoritative, polished'
    },
    demo: {
      name: 'Product Demo',
      tagline: 'Feature-focused demonstration using real application footage',
      pacing: 'brisk',
      style: 'hands-on',
      tone: 'practical, clear'
    },
    launch: {
      name: 'Launch Video',
      tagline: 'Cinematic introduction with real product footage',
      pacing: 'dynamic',
      style: 'cinematic',
      tone: 'exciting, visionary'
    },
    explainer: {
      name: 'Explainer',
      tagline: 'Explains a technical or conceptual product',
      pacing: 'educational',
      style: 'structured',
      tone: 'informative, accessible'
    },
    tutorial: {
      name: 'Tutorial',
      tagline: 'Step-by-step actionable demonstration',
      pacing: 'deliberate',
      style: 'walkthrough',
      tone: 'instructive, precise'
    },
    social_short: {
      name: 'Social Short',
      tagline: 'High-hook vertical or square short-form version',
      pacing: 'rapid',
      style: 'hook-driven',
      tone: 'punchy, viral',
      defaultAspect: '9:16'
    }
  }
};
