const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ensureDir, getVideoMetadata } = require('../utils/ffmpegHelper');
const { VoiceProviderFactory } = require('../providers/voiceProvider');

class VoiceProducer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Produce narration audio and synchronized subtitles for an individual scene
   */
  async produceSceneVoice({ scene, voiceId, provider = 'edge-tts', projectDir, onProgress }) {
    const audioDir = ensureDir(path.join(projectDir, 'audio'));
    const voice = voiceId || config.DEFAULT_SPECS.defaultVoice;
    const mediaOut = path.join(audioDir, `${scene.id}-voice.mp3`);
    const subOut = path.join(audioDir, `${scene.id}-sub.vtt`);

    if (onProgress) {
      onProgress({
        agent: 'Voice Producer',
        message: `Synthesizing neural voice for "${scene.title}" with voice ${voice} (${provider})...`
      });
    }

    const cleanText = (scene.narrationText || '').trim();
    if (!cleanText) {
      throw new Error(`Scene ${scene.id} has empty narration text`);
    }

    const voiceProvider = VoiceProviderFactory.getProvider(provider);
    await voiceProvider.synthesize({
      text: cleanText,
      voiceId: voice,
      mediaOut,
      subOut
    });

    const meta = await getVideoMetadata(mediaOut);
    const subtitles = this.parseVtt(subOut);

    return {
      audioPath: mediaOut,
      subtitlesPath: subOut,
      duration: meta.duration || scene.targetDuration || 5,
      subtitles
    };
  }

  /**
   * Parse VTT subtitle file into structured cue objects with millisecond timings
   */
  parseVtt(vttPath) {
    if (!fs.existsSync(vttPath)) return [];
    const content = fs.readFileSync(vttPath, 'utf8');
    const cues = [];
    const lines = content.split('\n');

    let currentCue = null;
    const timeRegex = /(\d{2}:\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3})/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(timeRegex);

      if (match) {
        if (currentCue) cues.push(currentCue);
        currentCue = {
          startTimeStr: match[1],
          endTimeStr: match[2],
          startMs: this.timeToMs(match[1]),
          endMs: this.timeToMs(match[2]),
          text: ''
        };
      } else if (currentCue && line && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && isNaN(Number(line))) {
        currentCue.text = currentCue.text ? `${currentCue.text} ${line}` : line;
      }
    }

    if (currentCue) cues.push(currentCue);
    return cues;
  }

  timeToMs(str) {
    const parts = str.replace(',', '.').split(':');
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
}

module.exports = VoiceProducer;
