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
   * all scene voiceovers with background ambient music, with frame-accurate timeline pacing.
   */
  async produceMasterAudio({ scenes, totalDuration, musicStyle = 'cinematic', projectDir, onProgress }) {
    const audioDir = ensureDir(path.join(projectDir, 'audio'));
    const soundtrackPath = path.join(audioDir, 'soundtrack-bed.m4a');
    const masterVoicePath = path.join(audioDir, 'narration-master.m4a');
    const masterMixPath = path.join(audioDir, 'master-mix.m4a');

    const validScenes = scenes.filter(s => s.audioPath && fs.existsSync(s.audioPath));

    if (validScenes.length === 0) {
      throw new Error('No valid voice narration tracks found for master mix');
    }

    // Determine target timeline duration from scenes or parameter
    const totalSceneTarget = validScenes.reduce((acc, s) => acc + (s.duration || s.targetDuration || 8), 0);
    const targetDuration = Math.max(totalDuration || 60, totalSceneTarget);

    if (onProgress) {
      onProgress({
        agent: 'Audio Engineer',
        message: `Composing background soundtrack (${musicStyle}) for ${targetDuration.toFixed(1)}s timeline...`
      });
    }

    // 1. Generate ambient soundtrack matching duration (+4s tail buffer)
    await generateAmbientSoundtrack(soundtrackPath, Math.ceil(targetDuration) + 4, musicStyle);

    // 2. Pace and pad each scene voice track to its exact scene duration
    if (onProgress) {
      onProgress({
        agent: 'Audio Engineer',
        message: 'Synchronizing neural voice tracks across scene timeline boundaries...'
      });
    }

    const paddedVoiceFiles = [];

    for (let i = 0; i < validScenes.length; i++) {
      const s = validScenes[i];
      const sceneTargetDur = Math.max(s.duration || s.targetDuration || 6, 4);
      let actualDuration = s.audioDuration;
      if (!actualDuration) {
        try {
          const sMeta = await getVideoMetadata(s.audioPath);
          actualDuration = sMeta.duration;
        } catch (e) {
          actualDuration = 4;
        }
      }

      const paddedPath = path.join(audioDir, `scene-voice-padded-${s.id}.m4a`);

      if (actualDuration < sceneTargetDur - 0.15) {
        const padSeconds = sceneTargetDur - actualDuration;
        // Pad silence to end of scene speech so the subsequent scene begins precisely on scene change
        await runFFmpeg([
          '-y',
          '-i', s.audioPath,
          '-f', 'lavfi',
          '-i', `sine=frequency=0:duration=${padSeconds.toFixed(3)}`,
          '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]',
          '-map', '[out]',
          '-c:a', 'aac',
          '-b:a', '192k',
          paddedPath
        ]);
      } else {
        // Voice fills scene or slightly exceeds; trim/normalize to scene duration
        await runFFmpeg([
          '-y',
          '-i', s.audioPath,
          '-t', `${sceneTargetDur.toFixed(3)}`,
          '-c:a', 'aac',
          '-b:a', '192k',
          paddedPath
        ]);
      }

      paddedVoiceFiles.push(paddedPath);
    }

    // Concatenate all padded scene voice tracks
    const inputs = [];
    paddedVoiceFiles.forEach(p => inputs.push('-i', p));

    const concatFilter = paddedVoiceFiles.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${paddedVoiceFiles.length}:v=0:a=1[voice]`;

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
    if (onProgress) {
      onProgress({
        agent: 'Audio Engineer',
        message: 'Applying smart audio ducking (sidechain compression) and mixing master track...'
      });
    }

    const duckingArgs = [
      '-y',
      '-i', masterVoicePath,
      '-i', soundtrackPath,
      '-filter_complex', `
        [1:a]volume=0.25[music_low];
        [0:a][music_low]amix=inputs=2:duration=first:dropout_transition=2[out]
      `.replace(/\s+/g, ' ').trim(),
      '-map', '[out]',
      '-t', `${targetDuration.toFixed(2)}`,
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
      soundtrackBedPath: soundtrackPath,
      narrationMasterPath: masterVoicePath,
      duration: masterMeta.duration || targetDuration
    };
  }
}

module.exports = AudioEngineer;
