const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { getVideoMetadata } = require('../utils/ffmpegHelper');

/**
 * Base Voice Provider Interface
 */
class BaseVoiceProvider {
  async synthesize({ text, voiceId, mediaOut, subOut }) {
    throw new Error('synthesize() must be implemented by VoiceProvider subclass');
  }
}

/**
 * Edge TTS Provider (Free, Neural, High-Quality, Subtitle Sync)
 */
class EdgeTTSProvider extends BaseVoiceProvider {
  async synthesize({ text, voiceId, mediaOut, subOut }) {
    const voice = voiceId || config.DEFAULT_SPECS.defaultVoice;

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
          resolve({
            provider: 'edge-tts',
            voice,
            mediaOut,
            subOut
          });
        } else {
          reject(new Error(`EdgeTTS failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn edge-tts: ${err.message}`));
      });
    });
  }
}

/**
 * OpenAI Voice Provider (Uses OpenAI Audio Speech API if OPENAI_API_KEY present)
 */
class OpenAIVoiceProvider extends BaseVoiceProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
  }

  async synthesize({ text, voiceId, mediaOut, subOut }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = voiceId && ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voiceId.toLowerCase())
      ? voiceId.toLowerCase()
      : 'alloy';

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3'
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI TTS error (${res.status}): ${errText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(mediaOut, buffer);

    // Approximate basic subtitle line
    const meta = await getVideoMetadata(mediaOut);
    const dur = meta.duration || 5;
    const vtt = `WEBVTT\n\n1\n00:00:00.100 --> 00:00:${dur.toFixed(3).padStart(6, '0')}\n${text}\n`;
    fs.writeFileSync(subOut, vtt, 'utf8');

    return { provider: 'openai', voice, mediaOut, subOut };
  }
}

/**
 * ElevenLabs Voice Provider (Uses ElevenLabs API if ELEVENLABS_API_KEY present)
 */
class ElevenLabsVoiceProvider extends BaseVoiceProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY;
  }

  async synthesize({ text, voiceId, mediaOut, subOut }) {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voice = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs TTS error: ${err}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(mediaOut, buffer);

    const meta = await getVideoMetadata(mediaOut);
    const dur = meta.duration || 5;
    const vtt = `WEBVTT\n\n1\n00:00:00.100 --> 00:00:${dur.toFixed(3).padStart(6, '0')}\n${text}\n`;
    fs.writeFileSync(subOut, vtt, 'utf8');

    return { provider: 'elevenlabs', voice, mediaOut, subOut };
  }
}

/**
 * Voice Provider Factory
 */
class VoiceProviderFactory {
  static getProvider(preferredProvider) {
    const p = (preferredProvider || '').toLowerCase();
    if (p === 'openai' && process.env.OPENAI_API_KEY) {
      return new OpenAIVoiceProvider();
    }
    if (p === 'elevenlabs' && process.env.ELEVENLABS_API_KEY) {
      return new ElevenLabsVoiceProvider();
    }
    // Default to robust, high-quality EdgeTTS
    return new EdgeTTSProvider();
  }
}

module.exports = {
  BaseVoiceProvider,
  EdgeTTSProvider,
  OpenAIVoiceProvider,
  ElevenLabsVoiceProvider,
  VoiceProviderFactory
};
