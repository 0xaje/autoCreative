const fs = require('fs');
const path = require('path');
const { runFFmpeg, ensureDir } = require('./ffmpegHelper');

/**
 * Generate a rich, cinematic ambient background music track using procedural FFmpeg synthesis.
 * This guarantees pristine audio beds without requiring third-party audio downloads or API keys.
 */
async function generateAmbientSoundtrack(outputPath, durationSeconds = 60, style = 'cinematic') {
  ensureDir(path.dirname(outputPath));

  // Determine chord frequencies based on style
  // Cinematic Tech (D Minor 9 chord: D2=73.42, A2=110, F3=174.61, C4=261.63, E4=329.63)
  const d = Math.max(durationSeconds, 5);

  let filterComplex = '';
  let inputs = [];

  if (style === 'upbeat') {
    // Brighter F Major 7 chord (F2=87.31, C3=130.81, A3=220, E4=329.63)
    inputs = [
      ['-f', 'lavfi', '-i', `sine=frequency=87.31:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=130.81:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=220:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=329.63:d=${d}`]
    ];
    filterComplex = `
      [0:a]volume=0.25[a0];
      [1:a]volume=0.2[a1];
      [2:a]volume=0.18,tremolo=f=4:d=0.3[a2];
      [3:a]volume=0.15,flanger=delay=8:depth=2:regen=30:width=70[a3];
      [a0][a1][a2][a3]amix=inputs=4:dropout_transition=2[mixed];
      [mixed]lowpass=f=1200,afade=t=in:ss=0:d=2.5,afade=t=out:st=${d - 3}:d=3,volume=0.35[out]
    `;
  } else {
    // Deep Cinematic / Ambient Tech (D minor 9)
    inputs = [
      ['-f', 'lavfi', '-i', `sine=frequency=73.42:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=110.00:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=174.61:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=261.63:d=${d}`],
      ['-f', 'lavfi', '-i', `sine=frequency=329.63:d=${d}`]
    ];
    filterComplex = `
      [0:a]volume=0.28[b0];
      [1:a]volume=0.22,flanger=delay=12:depth=3:regen=40:width=80[b1];
      [2:a]volume=0.18,tremolo=f=2:d=0.25[b2];
      [3:a]volume=0.16,flanger=delay=6:depth=4:regen=20:width=60[b3];
      [4:a]volume=0.12,chorus=0.7:0.9:55:0.4:0.25:2[b4];
      [b0][b1][b2][b3][b4]amix=inputs=5:dropout_transition=2[mixed];
      [mixed]lowpass=f=950,afade=t=in:ss=0:d=3,afade=t=out:st=${d - 3.5}:d=3.5,volume=0.32[out]
    `;
  }

  const flattenedInputs = inputs.flat();
  const args = [
    '-y',
    ...flattenedInputs,
    '-filter_complex', filterComplex.replace(/\s+/g, ' ').trim(),
    '-map', '[out]',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath
  ];

  await runFFmpeg(args);
  return outputPath;
}

/**
 * Generate UI sound effects (swoosh or soft confirmation ping)
 */
async function generateSfx(type, outputPath) {
  ensureDir(path.dirname(outputPath));

  if (type === 'swoosh') {
    // 0.4s noise filtered frequency sweep
    const args = [
      '-y',
      '-f', 'lavfi', '-i', 'anoisesrc=d=0.4:c=pink:r=48000',
      '-filter_complex', '[0:a]bandpass=f=600:width_type=h:w=300,afade=t=in:ss=0:d=0.15,afade=t=out:st=0.15:d=0.25,volume=0.4[out]',
      '-map', '[out]',
      '-c:a', 'aac',
      outputPath
    ];
    await runFFmpeg(args);
  } else {
    // Soft chime ping (880Hz A5 fading out)
    const args = [
      '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=880:d=0.6',
      '-filter_complex', '[0:a]afade=t=in:ss=0:d=0.02,afade=t=out:st=0.05:d=0.55,volume=0.25[out]',
      '-map', '[out]',
      '-c:a', 'aac',
      outputPath
    ];
    await runFFmpeg(args);
  }

  return outputPath;
}

module.exports = {
  generateAmbientSoundtrack,
  generateSfx
};
