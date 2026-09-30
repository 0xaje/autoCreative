const fs = require('fs');
const path = require('path');
const config = require('../config');
const { runFFmpeg, ensureDir, getVideoMetadata } = require('../utils/ffmpegHelper');

/**
 * Safely escape all characters with special meaning in FFmpeg drawtext filter:
 * backslash, single-quote, colon, percent, comma, semicolon, square brackets, and newlines.
 */
function escapeDrawtext(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '')
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/[\r\n]+/g, ' ');
}

/**
 * Sanitize color inputs to valid hex or CSS color tokens, preventing filter graph syntax injection.
 */
function sanitizeColor(color, defaultColor) {
  if (!color || typeof color !== 'string') return defaultColor;
  const trimmed = color.trim();
  if (/^(0x|#)?[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/.test(trimmed)) {
    return trimmed;
  }
  return defaultColor;
}

class VideoEditor {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Assemble full multi-track video timeline and render master MP4
   */
  async composeAndRender({ scenes, masterAudioPath, resolution, projectDir, onProgress }) {
    const renderDir = ensureDir(path.join(projectDir, 'render'));
    const finalMp4Path = path.join(renderDir, 'production-master.mp4');

    const width = resolution?.width || 1920;
    const height = resolution?.height || 1080;

    if (onProgress) {
      onProgress({
        agent: 'Video Editor',
        message: `Assembling multi-scene timeline (${scenes.length} scenes) at ${width}x${height}...`
      });
    }

    // Step 1: Normalize each scene clip so that its duration exactly matches its allocated timeline duration
    // and its video dimensions match target resolution
    const normalizedSceneClips = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const videoSource = scene.videoPath;
      const targetDuration = Math.max(scene.duration || scene.targetDuration || 5, Math.ceil(scene.audioDuration || 0));

      const normalizedPath = path.join(renderDir, `norm-${scene.id}.mp4`);

      if (onProgress) {
        onProgress({
          agent: 'Video Editor',
          message: `Synchronizing Scene ${i + 1}/${scenes.length} ("${scene.title}") to ${targetDuration.toFixed(1)}s...`
        });
      }

      await this.normalizeSceneClip({
        inputVideo: videoSource,
        outputVideo: normalizedPath,
        targetDuration,
        width,
        height,
        scene
      });

      normalizedSceneClips.push(normalizedPath);
    }

    // Step 2: Concatenate all normalized video clips
    const concatListPath = path.join(renderDir, 'concat_list.txt');
    const concatContent = normalizedSceneClips.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf8');

    const concatenatedVideo = path.join(renderDir, 'scenes-concatenated.mp4');

    if (onProgress) {
      onProgress({
        agent: 'Video Editor',
        message: 'Stitching synchronized scene tracks and applying color grading...'
      });
    }

    await runFFmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      concatenatedVideo
    ]);

    // Step 3: Combine stitched video with master ducked audio track
    if (onProgress) {
      onProgress({
        agent: 'Video Editor',
        message: 'Muxing master ducked audio track with 1080p H.264 stream...'
      });
    }

    const totalTargetDuration = scenes.reduce((acc, s) => acc + Math.max(s.duration || s.targetDuration || 5, Math.ceil(s.audioDuration || 0)), 0);

    const masterArgs = [
      '-y',
      '-i', concatenatedVideo,
      '-i', masterAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', `${totalTargetDuration.toFixed(2)}`,
      '-shortest',
      '-movflags', '+faststart',
      finalMp4Path
    ];

    await runFFmpeg(masterArgs);

    // Also copy to root project output.mp4
    const projectRootMp4 = path.join(projectDir, 'output.mp4');
    fs.copyFileSync(finalMp4Path, projectRootMp4);

    const finalMeta = await getVideoMetadata(finalMp4Path);

    if (onProgress) {
      onProgress({
        agent: 'Video Editor',
        message: `Successfully rendered final broadcast MP4 (${finalMeta.duration.toFixed(1)}s, ${(finalMeta.sizeBytes / 1024 / 1024).toFixed(2)} MB)`
      });
    }

    return {
      finalMp4Path,
      projectRootMp4,
      duration: finalMeta.duration,
      width: finalMeta.width,
      height: finalMeta.height,
      sizeBytes: finalMeta.sizeBytes
    };
  }

  /**
   * Adjust video duration, pad/freeze end frame if needed, scale to target resolution
   */
  async normalizeSceneClip({ inputVideo, outputVideo, targetDuration, width, height, scene }) {
    const meta = await getVideoMetadata(inputVideo);
    const sourceDuration = meta.duration || 1;

    // Build filter complex:
    // Scale and pad to fit target resolution (e.g. 1920x1080)
    // If sourceDuration < targetDuration, extend with tpad holding last frame
    let filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;

    if (sourceDuration < targetDuration) {
      const padDuration = targetDuration - sourceDuration + 0.1;
      filter += `,tpad=stop_mode=clone:stop_duration=${padDuration}`;
    }

    // Trim exactly to targetDuration
    filter += `,trim=duration=${targetDuration},setpts=PTS-STARTPTS`;

    // Add subtle lower third banner if specified in scene overlay
    if (scene.overlay && scene.overlay.lowerThird) {
      const title = escapeDrawtext(scene.overlay.lowerThird.title || '');
      const subtitle = escapeDrawtext(scene.overlay.lowerThird.subtitle || '');
      const badge = escapeDrawtext(scene.overlay.badge || 'VERIFIED');

      const accentColor = sanitizeColor(scene.overlay.color, '0x6366f1');
      const badgeColor = sanitizeColor(scene.overlay.badgeHex, '0xa5b4fc');
      const boxY = height - 160;
      filter += `,drawbox=x=60:y=${boxY}:w=540:h=90:color=black@0.65:t=fill`;
      filter += `,drawbox=x=60:y=${boxY}:w=6:h=90:color=${accentColor}@1.0:t=fill`;
      filter += `,drawtext=text='${badge}':x=85:y=${boxY + 12}:fontsize=16:fontcolor=${badgeColor}:font=sans`;
      filter += `,drawtext=text='${title}':x=85:y=${boxY + 36}:fontsize=24:fontcolor=white:font=sans`;
      filter += `,drawtext=text='${subtitle}':x=85:y=${boxY + 65}:fontsize=16:fontcolor=0x94a3b8:font=sans`;
    }

    const args = [
      '-y',
      '-i', inputVideo,
      '-vf', filter,
      '-t', `${targetDuration}`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      outputVideo
    ];

    await runFFmpeg(args);
  }
}

module.exports = VideoEditor;
VideoEditor.escapeDrawtext = escapeDrawtext;
VideoEditor.sanitizeColor = sanitizeColor;
