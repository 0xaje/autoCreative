const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Execute FFmpeg command asynchronously with structured logging
 */
function runFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    const ffmpegBin = config.BINARIES.ffmpeg;
    const proc = spawn(ffmpegBin, args, {
      cwd: options.cwd || process.cwd()
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
      if (options.onStdout) options.onStdout(d.toString());
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      if (options.onStderr) options.onStderr(d.toString());
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const err = new Error(`FFmpeg exited with code ${code}.\nArgs: ${args.join(' ')}\nStderr:\n${stderr.slice(-1000)}`);
        err.code = code;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

/**
 * Safely parse a frame rate string (e.g. "30/1", "30000/1001", "29.97") without eval.
 * Returns a floating-point number, or null if invalid or non-numeric.
 */
function parseFrameRate(rateStr) {
  if (typeof rateStr !== 'string') return null;
  const trimmed = rateStr.trim();
  if (!trimmed) return null;

  // Handle fractional format "numerator/denominator"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 2) return null;
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    const val = num / den;
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  // Handle direct numeric float/integer
  const val = Number(trimmed);
  return Number.isFinite(val) && val > 0 ? val : null;
}

/**
 * Run ffprobe to get comprehensive JSON metadata
 */
function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    const ffprobeBin = config.BINARIES.ffprobe;
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn(ffprobeBin, args);
    let output = '';
    let errOutput = '';

    proc.stdout.on('data', (d) => output += d.toString());
    proc.stderr.on('data', (d) => errOutput += d.toString());

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${errOutput}`));
      }
      try {
        const parsed = JSON.parse(output);
        const videoStream = parsed.streams.find(s => s.codec_type === 'video');
        const audioStream = parsed.streams.find(s => s.codec_type === 'audio');
        const duration = parseFloat(parsed.format?.duration || videoStream?.duration || 0);

        resolve({
          format: parsed.format,
          duration,
          width: videoStream ? videoStream.width : null,
          height: videoStream ? videoStream.height : null,
          fps: videoStream ? (parseFrameRate(videoStream.r_frame_rate) || parseFrameRate(videoStream.avg_frame_rate)) : null,
          videoCodec: videoStream ? videoStream.codec_name : null,
          audioCodec: audioStream ? audioStream.codec_name : null,
          audioChannels: audioStream ? audioStream.channels : null,
          sizeBytes: parseInt(parsed.format?.size || 0, 10),
          bitrate: parseInt(parsed.format?.bit_rate || 0, 10),
          streams: parsed.streams
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe JSON: ${e.message}`));
      }
    });
  });
}

/**
 * Utility to make sure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

module.exports = {
  runFFmpeg,
  getVideoMetadata,
  getMediaMetadata: getVideoMetadata,
  parseFrameRate,
  ensureDir
};
