const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { ensureDir, getVideoMetadata } = require('../utils/ffmpegHelper');

class VoiceProducer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Produce narration audio and synchronized subtitles for an individual scene
   */
  async produceSceneVoice({ scene, voiceId, projectDir, onProgress }) {
    const audioDir = ensureDir(path.join(projectDir, 'audio'));
    const voice = voiceId || config.DEFAULT_SPECS.defaultVoice;
    const mediaOut = path.join(audioDir, `${scene.id}-voice.mp3`);
    const subOut = path.join(audioDir, `${scene.id}-sub.vtt`);

    if (onProgress) {
      onProgress({
        agent: 'Voice Producer',
        message: `Synthesizing neural voice for "${scene.title}" with voice ${voice}...`
      });
    }

    const cleanText = (scene.narrationText || '').trim();
    if (!cleanText) {
      throw new Error(`Scene ${scene.id} has empty narration text`);
    }

    // Call edge-tts
    await this.callEdgeTts({
      text: cleanText,
      voice,
      mediaOut,
      subOut
    });

    // Probe duration
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
   * Execute edge-tts CLI command
   */
  callEdgeTts({ text, voice, mediaOut, subOut }) {
    return new Promise((resolve, reject) => {
      const args = [
        '--voice', voice,
        '--text', text,
        '--write-media', mediaOut,
        '--write-subtitles', subOut
      ];

      const proc = spawn('edge-tts', args);
      let stderr = '';

      proc.stderr.on('data', d => stderr += d.toString());

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(mediaOut)) {
          resolve();
        } else {
          // If edge-tts failed or network issue, fallback to ffmpeg speech synthesis / tone
          reject(new Error(`edge-tts failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn edge-tts: ${err.message}`));
      });
    });
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
