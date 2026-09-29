const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const config = require('../config');
const { ensureDir, getVideoMetadata } = require('../utils/ffmpegHelper');
const { CURSOR_INJECTION_SCRIPT } = require('../utils/realisticCursor');
const ProductDemonstrator = require('./productDemonstrator');

class ScreenRecorder {
  constructor(options = {}) {
    this.options = options;
    this.demonstrator = new ProductDemonstrator();
  }

  /**
   * Record real product footage for a given scene, saving MP4 video and PRD metadata JSON
   */
  async recordSceneFootage({ scene, targetUrl, durationSeconds, resolution, projectModel, projectDir, onProgress }) {
    const recordingsDir = ensureDir(path.join(projectDir, 'recordings'));
    const outputPath = path.join(recordingsDir, `${scene.id}.mp4`);
    const metadataPath = path.join(recordingsDir, `${scene.id}.json`);

    const width = resolution?.width || 1920;
    const height = resolution?.height || 1080;
    const duration = Math.max(durationSeconds || scene.targetDuration || 8, 4);

    if (onProgress) {
      onProgress({
        agent: 'Screen Recorder',
        message: `Recording real application footage for "${scene.title}" (${duration.toFixed(1)}s at ${width}x${height})...`
      });
    }

    let browser = null;
    let ffmpegProc = null;
    const startTime = new Date().toISOString();

    try {
      browser = await puppeteer.launch({
        executablePath: config.BINARIES.chrome,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          `--window-size=${width},${height}`,
          '--hide-scrollbars'
        ],
        headless: 'new'
      });

      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });

      // Navigate to live URL or demo with fallback
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {
        return page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      });

      // Inject realistic virtual cursor
      await page.evaluate(CURSOR_INJECTION_SCRIPT);

      // Inject visual compositor heartbeat to guarantee frame flow in headless Chrome
      await page.evaluate(() => {
        let count = 0;
        const hb = document.createElement('div');
        hb.id = 'studio-frame-pulse';
        hb.style.cssText = 'position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:2147483647;';
        document.body.appendChild(hb);
        setInterval(() => {
          count++;
          hb.style.transform = `translate(${count % 2}px, 0)`;
        }, 30);
      });

      // Start FFmpeg process piping screencast frames
      ffmpegProc = spawn(config.BINARIES.ffmpeg, [
        '-y',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-r', '30',
        '-i', '-',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath
      ]);

      let ffmpegErr = '';
      ffmpegProc.stderr.on('data', d => ffmpegErr += d.toString());

      // Start CDP Screencast session
      const client = await page.target().createCDPSession();
      await client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 90,
        maxWidth: width,
        maxHeight: height,
        everyNthFrame: 1
      });

      let isRecording = true;

      const frameHandler = async ({ data, sessionId }) => {
        if (!isRecording) return;
        try {
          if (ffmpegProc && ffmpegProc.stdin && ffmpegProc.stdin.writable) {
            ffmpegProc.stdin.write(Buffer.from(data, 'base64'));
          }
          await client.send('Page.screencastFrameAck', { sessionId });
        } catch (e) {}
      };

      client.on('Page.screencastFrame', frameHandler);

      // Execute semantic interaction sequence using discovered project workflows
      const actions = this.demonstrator.planInteraction(scene, projectModel || { workflows: [] });
      const actionLogs = await this.demonstrator.executeSequence(page, actions, duration);

      // Stop screencast cleanly
      isRecording = false;
      client.off('Page.screencastFrame', frameHandler);
      await client.send('Page.stopScreencast').catch(() => {});

      if (ffmpegProc && ffmpegProc.stdin && ffmpegProc.stdin.writable) {
        ffmpegProc.stdin.end();
      }

      await new Promise((resolve, reject) => {
        ffmpegProc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg recording error (${code}): ${ffmpegErr.slice(-400)}`));
        });
      });

      await browser.close();
      browser = null;

      const meta = await getVideoMetadata(outputPath);

      // Save PRD recording metadata JSON
      const recordingMetadata = {
        id: scene.id,
        url: targetUrl,
        start_time: startTime,
        duration: meta.duration,
        actions: actionLogs,
        success: true,
        file: `recordings/${path.basename(outputPath)}`
      };
      fs.writeFileSync(metadataPath, JSON.stringify(recordingMetadata, null, 2), 'utf8');

      if (onProgress) {
        onProgress({
          agent: 'Screen Recorder',
          message: `Captured ${meta.duration.toFixed(1)}s real footage: ${path.basename(outputPath)}`
        });
      }

      return {
        outputPath,
        metadataPath,
        duration: meta.duration,
        width: meta.width,
        height: meta.height
      };
    } catch (err) {
      if (browser) await browser.close().catch(() => {});
      if (ffmpegProc && !ffmpegProc.killed) ffmpegProc.kill();
      throw err;
    }
  }
}

module.exports = ScreenRecorder;
