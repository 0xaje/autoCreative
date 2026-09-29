const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const config = require('../config');
const { ensureDir, getVideoMetadata, runFFmpeg } = require('../utils/ffmpegHelper');

class MotionDesigner {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Render broadcast-grade motion graphic video clip for intro, problem/solution, or outro CTA.
   * Uses high-resolution HTML/CSS rendering combined with a cinematic Ken Burns zoompan push-in.
   */
  async renderMotionClip({ scene, sourceAnalysis, durationSeconds, resolution, projectDir, onProgress }) {
    const assetsDir = ensureDir(path.join(projectDir, 'assets'));
    const outputPath = path.join(assetsDir, `${scene.id}-motion.mp4`);
    const tempSnapshotPath = path.join(assetsDir, `${scene.id}-frame.png`);

    const width = resolution?.width || 1920;
    const height = resolution?.height || 1080;
    const duration = Math.max(durationSeconds || scene.targetDuration || 6, 3);
    const motionType = scene.visualPlan?.motionType || 'intro_cinematic';

    if (onProgress) {
      onProgress({
        agent: 'Motion Designer',
        message: `Rendering motion graphics (${motionType}) for "${scene.title}" (${duration.toFixed(1)}s at ${width}x${height})...`
      });
    }

    const htmlContent = this.generateMotionHtml({
      motionType,
      scene,
      sourceAnalysis,
      width,
      height
    });

    let browser = null;

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
      await page.setViewport({ width, height });
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Take pristine full-res screenshot of the motion design
      await page.screenshot({ path: tempSnapshotPath, type: 'png' });
      await browser.close();
      browser = null;

      // Animate the motion card with cinematic zoompan (slow zoom in from 1.0 to 1.05)
      // d=1 means 1 frame step per input, -r 30 produces 30fps
      const filter = `scale=${width}:${height},zoompan=z='min(zoom+0.0006,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}`;

      const args = [
        '-y',
        '-loop', '1',
        '-i', tempSnapshotPath,
        '-t', `${duration}`,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-movflags', '+faststart',
        outputPath
      ];

      await runFFmpeg(args);

      if (fs.existsSync(tempSnapshotPath)) {
        fs.unlinkSync(tempSnapshotPath);
      }

      const meta = await getVideoMetadata(outputPath);
      return {
        outputPath,
        duration: meta.duration
      };
    } catch (err) {
      if (browser) await browser.close().catch(() => {});
      if (fs.existsSync(tempSnapshotPath)) fs.unlinkSync(tempSnapshotPath).catch(() => {});
      throw err;
    }
  }

  /**
   * Procedural HTML/CSS template generator for motion graphics
   */
  generateMotionHtml({ motionType, scene, sourceAnalysis, width, height }) {
    const productName = sourceAnalysis.name || 'Autonomous Studio';
    const tagline = sourceAnalysis.tagline || 'Next-Gen Creative Production';

    const techStack = sourceAnalysis.integrations || sourceAnalysis.githubData?.detectedTech || [];
    const features = sourceAnalysis.features || [];
    const sourceTree = sourceAnalysis.githubData?.sourceTree || ['src/', 'package.json', 'README.md'];
    const featureName = scene.overlay?.lowerThird?.subtitle || scene.title || 'Verified Architecture';

    if (motionType === 'code_walkthrough') {
      const techBadges = techStack.slice(0, 6).map(t =>
        `<span style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(129, 140, 248, 0.4); padding: 8px 18px; border-radius: 8px; font-size: 16px; font-weight: 600; color: #c7d2fe;">${t}</span>`
      ).join('');

      const treeItems = sourceTree.slice(0, 8).map(f =>
        `<div style="display: flex; align-items: center; gap: 10px; font-family: monospace; font-size: 16px; color: #94a3b8; padding: 4px 0;"><span style="color: #6366f1;">📄</span> ${f}</div>`
      ).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: #090d16;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
            }
            .container {
              display: flex;
              gap: 40px;
              width: 100%;
              max-width: 1300px;
            }
            .left-col {
              flex: 1.2;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .right-col {
              flex: 0.8;
              background: rgba(15, 23, 42, 0.8);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 20px;
              padding: 32px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .badge {
              display: inline-block;
              padding: 8px 20px;
              background: rgba(99, 102, 241, 0.2);
              border: 1px solid rgba(129, 140, 248, 0.4);
              border-radius: 9999px;
              color: #a5b4fc;
              font-size: 15px;
              font-weight: 700;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            h2 {
              font-size: 52px;
              font-weight: 900;
              letter-spacing: -1px;
              line-height: 1.15;
              margin-bottom: 20px;
              background: linear-gradient(135deg, #ffffff, #c7d2fe);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 22px;
              color: #94a3b8;
              line-height: 1.6;
              margin-bottom: 32px;
            }
            .tech-wrap {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="left-col">
              <div class="badge">REPOSITORY ARCHITECTURE</div>
              <h2>${productName}</h2>
              <p>Verified codebase structure and technical dependencies powering autonomous execution.</p>
              <div class="tech-wrap">
                ${techBadges || '<span style="color:#94a3b8;">Standard Production Stack</span>'}
              </div>
            </div>
            <div class="right-col">
              <div style="font-size: 14px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">Verified Repository Structure</div>
              <div style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.06);">
                ${treeItems}
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (motionType === 'feature_card_flow') {
      const featPills = features.slice(0, 4).map(f =>
        `<div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 16px;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(99, 102, 241, 0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #a5b4fc;">✓</div>
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${f}</div>
            <div style="font-size: 14px; color: #94a3b8; margin-top: 4px;">Verified capability from repository documentation</div>
          </div>
        </div>`
      ).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: #090d16;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
            }
            .badge {
              display: inline-block;
              padding: 8px 20px;
              background: rgba(16, 185, 129, 0.2);
              border: 1px solid rgba(52, 211, 153, 0.4);
              border-radius: 9999px;
              color: #6ee7b7;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            h2 {
              font-size: 48px;
              font-weight: 900;
              background: linear-gradient(135deg, #ffffff, #cbd5e1);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              width: 100%;
              max-width: 1100px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="badge">VERIFIED CAPABILITIES</div>
            <h2>${featureName}</h2>
          </div>
          <div class="grid">
            ${featPills || '<div style="color:#94a3b8; text-align:center; grid-column: span 2;">Verified architecture features</div>'}
          </div>
        </body>
        </html>
      `;
    }

    if (motionType === 'outro_cta') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: radial-gradient(circle at 50% 40%, #1e1b4b 0%, #030712 100%);
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              position: relative;
            }
            .grid-bg {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
              background-size: 60px 60px;
              opacity: 0.7;
            }
            .glow-orb {
              position: absolute;
              width: 700px;
              height: 700px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%);
              filter: blur(50px);
            }
            .card {
              position: relative;
              z-index: 10;
              text-align: center;
              padding: 56px 80px;
              background: rgba(15, 23, 42, 0.75);
              backdrop-filter: blur(25px);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 28px;
              box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.3);
              max-width: 960px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 24px;
              background: rgba(99, 102, 241, 0.2);
              border: 1px solid rgba(129, 140, 248, 0.45);
              border-radius: 9999px;
              color: #c7d2fe;
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            h1 {
              font-size: 64px;
              font-weight: 900;
              margin-bottom: 16px;
              letter-spacing: -1px;
              background: linear-gradient(135deg, #ffffff 40%, #c7d2fe 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 24px;
              color: #94a3b8;
              margin-bottom: 38px;
              line-height: 1.5;
            }
            .actions {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 20px;
            }
            .btn-primary {
              padding: 18px 40px;
              background: linear-gradient(135deg, #6366f1, #4f46e5);
              border-radius: 14px;
              color: white;
              font-size: 22px;
              font-weight: 700;
              box-shadow: 0 10px 30px -5px rgba(79, 70, 229, 0.6);
            }
            .btn-secondary {
              padding: 18px 36px;
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.18);
              border-radius: 14px;
              color: #e2e8f0;
              font-size: 20px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="grid-bg"></div>
          <div class="glow-orb"></div>
          <div class="card">
            <div class="badge">OFFICIAL RELEASE</div>
            <h1>${productName}</h1>
            <p>${tagline}</p>
            <div class="actions">
              <div class="btn-primary">Explore Live Application</div>
              <div class="btn-secondary">Production Verified</div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (motionType === 'problem_solution_split') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: #090d16;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
            }
            .header {
              text-align: center;
              margin-bottom: 48px;
            }
            .header h2 {
              font-size: 48px;
              font-weight: 800;
              margin-bottom: 12px;
              background: linear-gradient(135deg, #ffffff, #cbd5e1);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .cards {
              display: flex;
              gap: 40px;
              width: 100%;
              max-width: 1300px;
            }
            .column {
              flex: 1;
              padding: 44px;
              border-radius: 24px;
              backdrop-filter: blur(20px);
            }
            .problem {
              background: rgba(239, 68, 68, 0.06);
              border: 1px solid rgba(239, 68, 68, 0.25);
            }
            .solution {
              background: rgba(16, 185, 129, 0.08);
              border: 1px solid rgba(16, 185, 129, 0.35);
              box-shadow: 0 0 40px rgba(16, 185, 129, 0.18);
            }
            .tag {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              margin-bottom: 22px;
            }
            .problem .tag { background: rgba(239, 68, 68, 0.25); color: #f87171; }
            .solution .tag { background: rgba(16, 185, 129, 0.25); color: #34d399; }
            .column h3 { font-size: 30px; margin-bottom: 16px; font-weight: 800; }
            .column p { font-size: 20px; color: #94a3b8; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Architectural Reimagination</h2>
          </div>
          <div class="cards">
            <div class="column problem">
              <div class="tag">The Challenge</div>
              <h3>Fragmented Tooling</h3>
              <p>Teams lose valuable hours jumping between screen recorders, complex timeline editors, script writers, and manual render pipelines.</p>
            </div>
            <div class="column solution">
              <div class="tag">The Solution</div>
              <h3>${productName}</h3>
              <p>An autonomous creative studio that explores real applications, captures authentic footage, generates narration, and renders finished MP4s automatically.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Default: Cinematic Intro Title Card
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: ${width}px;
            height: ${height}px;
            background: radial-gradient(circle at 50% 50%, #17153a 0%, #030712 100%);
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
          }
          .grid-pattern {
            position: absolute;
            inset: 0;
            background-size: 60px 60px;
            background-image:
              linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          }
          .glow {
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 65%);
            filter: blur(60px);
          }
          .hero-container {
            position: relative;
            z-index: 10;
            text-align: center;
            padding: 0 60px;
          }
          .badge {
            display: inline-block;
            padding: 10px 26px;
            background: rgba(99, 102, 241, 0.22);
            border: 1px solid rgba(129, 140, 248, 0.5);
            border-radius: 9999px;
            color: #c7d2fe;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 30px;
            box-shadow: 0 0 25px rgba(99, 102, 241, 0.4);
          }
          h1 {
            font-size: 84px;
            font-weight: 900;
            letter-spacing: -2px;
            line-height: 1.1;
            margin-bottom: 24px;
            background: linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 10px 40px rgba(0,0,0,0.6);
          }
          p {
            font-size: 28px;
            color: #94a3b8;
            max-width: 950px;
            margin: 0 auto;
            line-height: 1.5;
            font-weight: 400;
          }
        </style>
      </head>
      <body>
        <div class="grid-pattern"></div>
        <div class="glow"></div>
        <div class="hero-container">
          <div class="badge">OFFICIAL PRESENTATION</div>
          <h1>${productName}</h1>
          <p>${tagline}</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = MotionDesigner;
