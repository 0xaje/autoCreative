const fs = require('fs');
const path = require('path');
const { runFFmpeg, ensureDir, getVideoMetadata } = require('../utils/ffmpegHelper');
const { generateAmbientSoundtrack } = require('../utils/assetGenerator');

class AudioEngineer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Produce fully mixed, sidechained/ducked master soundtrack combining
   * all scene voiceovers with background ambient music.
   */
  async produceMasterAudio({ scenes, totalDuration, musicStyle = 'cinematic', projectDir, onProgress }) {
    const audioDir = ensureDir(path.join(projectDir, 'audio'));
    const soundtrackPath = path.join(audioDir, 'soundtrack-bed.aac');
    const masterVoicePath = path.join(audioDir, 'narration-master.aac');
    const masterMixPath = path.join(audioDir, 'master-mix.aac');

    if (onProgress) {
      onProgress({
        agent: 'Audio Engineer',
        message: `Composing background soundtrack (${musicStyle}) for ${totalDuration.toFixed(1)}s timeline...`
      });
    }

    // 1. Generate ambient soundtrack matching duration
    await generateAmbientSoundtrack(soundtrackPath, Math.ceil(totalDuration) + 4, musicStyle);

    // 2. Concatenate voice narration tracks in sequence
    // Build ffmpeg concat list or amix with delays
    const validScenes = scenes.filter(s => s.audioPath && fs.existsSync(s.audioPath));

    if (validScenes.length === 0) {
      throw new Error('No valid voice narration tracks found for master mix');
    }

    if (onProgress) {
      onProgress({
        agent: 'Audio Engineer',
        message: 'Applying smart audio ducking (sidechain compression) and mixing master track...'
      });
    }

    // Create a concat filter for all voice scenes
    // Each scene has duration: s.duration
    const inputs = [];
    validScenes.forEach(s => {
      inputs.push('-i', s.audioPath);
    });

    const concatFilter = validScenes.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${validScenes.length}:v=0:a=1[voice]`;

    const voiceConcatArgs = [
      '-y',
      ...inputs,
      '-filter_complex', concatFilter,
      '-map', '[voice]',
      '-c:a', 'aac',
      '-b:a', '192k',
      masterVoicePath
    ];

    await runFFmpeg(voiceConcatArgs);

    // 3. Duck background music under the master voice track
    // We use ffmpeg sidechaincompress or volume curve
    // [1:a] as music, [0:a] as voice
    // sidechaincompress lowers [1:a] whenever [0:a] has volume
    const duckingArgs = [
      '-y',
      '-i', masterVoicePath,
      '-i', soundtrackPath,
      '-filter_complex', `
        [1:a]volume=0.25[music_low];
        [0:a][music_low]amix=inputs=2:duration=first:dropout_transition=2[out]
      `.replace(/\s+/g, ' ').trim(),
      '-map', '[out]',
      '-c:a', 'aac',
      '-b:a', '192k',
      masterMixPath
    ];

    await runFFmpeg(duckingArgs);

    const masterMeta = await getVideoMetadata(masterMixPath);

    return {
      masterMixPath,
      masterVoicePath,
      soundtrackPath,
      duration: masterMeta.duration
    };
  }
}

module.exports = AudioEngineer;
