const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const config = require('../config');
const { ensureDir, getVideoMetadata, runFFmpeg } = require('../utils/ffmpegHelper');
const { getProjectBrandTheme } = require('../utils/brandDesigner');

/**
 * Strict Content Security Policy for motion graphics rendering in headless Chrome.
 * Prohibits script execution, object/plugin loading, and external network resources.
 */
const STRICT_CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; font-src data:; img-src data:; script-src \'none\'; object-src \'none\'; base-uri \'none\';">';

/**
 * Sanitize untrusted external string data before interpolation into motion HTML.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class MotionDesigner {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Determine Chrome arguments with least-privilege sandboxing principles.
   * Avoids --no-sandbox unless explicitly requested via options, environment variable,
   * or when running in root container environments where kernel namespaces are unavailable.
   */
  getChromeLaunchArgs({ width = 1920, height = 1080, forceNoSandbox = false } = {}) {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const shouldDisableSandbox = forceNoSandbox ||
      this.options.noSandbox === true ||
      process.env.CHROME_NO_SANDBOX === 'true' ||
      isRoot;

    const args = [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--window-size=${width},${height}`,
      '--hide-scrollbars'
    ];

    if (shouldDisableSandbox) {
      args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    return { args, shouldDisableSandbox };
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
    const { args: launchArgs, shouldDisableSandbox } = this.getChromeLaunchArgs({ width, height });

    try {
      try {
        browser = await puppeteer.launch({
          executablePath: config.BINARIES.chrome,
          args: launchArgs,
          headless: 'new'
        });
      } catch (launchErr) {
        // Fallback: If sandbox fails to initialize (e.g. in restricted CI/Docker without user namespaces),
        // gracefully retry with --no-sandbox so rendering does not fail in unprivileged containers.
        if (!shouldDisableSandbox && (launchErr.message.includes('sandbox') || launchErr.message.includes('setuid') || launchErr.message.includes('zygote'))) {
          browser = await puppeteer.launch({
            executablePath: config.BINARIES.chrome,
            args: [...launchArgs, '--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
          });
        } else {
          throw launchErr;
        }
      }

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
   * Procedural HTML/CSS template generator for motion graphics with dynamic Brand Design Identity
   */
  generateMotionHtml({ motionType, scene, sourceAnalysis = {}, width, height }) {
    const rawProductName = sourceAnalysis.project || sourceAnalysis.name || scene?.title || 'Autonomous Studio';
    const rawTagline = sourceAnalysis.purpose || sourceAnalysis.tagline || 'Next-Gen Creative Production';
    const theme = scene?.theme || getProjectBrandTheme(sourceAnalysis);

    const productName = escapeHtml(rawProductName);
    const tagline = escapeHtml(rawTagline);
    const themeName = escapeHtml(theme.name || '');

    const techStack = [...new Set([...(sourceAnalysis.techBadges || []), ...(sourceAnalysis.integrations || []), ...(sourceAnalysis.githubData?.detectedTech || [])])];
    const features = sourceAnalysis.features || [];
    const featureCards = sourceAnalysis.featureCards || [];
    const keyMetrics = sourceAnalysis.keyMetrics || [];
    const visualAssets = sourceAnalysis.visualAssets || {};
    const sourceTree = sourceAnalysis.githubData?.sourceTree || ['src/', 'package.json', 'README.md'];
    const featureName = escapeHtml(scene?.overlay?.lowerThird?.subtitle || scene?.title || 'Verified Architecture');

    if (motionType === 'code_walkthrough') {
      const techBadges = techStack.slice(0, 6).map(t =>
        `<span style="background: ${theme.badgeBg}; border: 1px solid ${theme.borderColor}; padding: 8px 18px; border-radius: 8px; font-size: 16px; font-weight: 600; color: ${theme.accentBadge};">${escapeHtml(t)}</span>`
      ).join('');

      const treeItems = sourceTree.slice(0, 8).map(f =>
        `<div style="display: flex; align-items: center; gap: 10px; font-family: monospace; font-size: 16px; color: #94a3b8; padding: 4px 0;"><span style="color: ${theme.primary};">📄</span> ${escapeHtml(f)}</div>`
      ).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgDark};
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
              position: relative;
            }
            .grid-bg {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
              background-size: 50px 50px;
            }
            .glow-spot {
              position: absolute;
              width: 600px;
              height: 600px;
              border-radius: 50%;
              background: ${theme.glow};
              filter: blur(80px);
            }
            .container {
              position: relative;
              z-index: 10;
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
              background: ${theme.cardBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 20px;
              padding: 32px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
              backdrop-filter: blur(20px);
            }
            .badge {
              display: inline-block;
              padding: 8px 20px;
              background: ${theme.badgeBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 9999px;
              color: ${theme.accentBadge};
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
              background: linear-gradient(135deg, #ffffff, ${theme.primaryLight});
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
          <div class="grid-bg"></div>
          <div class="glow-spot"></div>
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
              <div style="font-size: 14px; font-weight: 700; color: ${theme.accentBadge}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">Verified Repository Structure</div>
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
      const featPills = featureCards.length > 0
        ? featureCards.slice(0, 4).map(c =>
          `<div style="background: ${theme.cardBg}; border: 1px solid ${theme.borderColor}; border-radius: 16px; padding: 22px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); display: flex; align-items: flex-start; gap: 16px; backdrop-filter: blur(15px);">
            <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 10px; background: ${theme.badgeBg}; display: flex; align-items: center; justify-content: center; font-size: 18px; color: ${theme.primary}; font-weight: bold;">✓</div>
            <div>
              <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${escapeHtml(c.title || '')}</div>
              <div style="font-size: 14px; color: #94a3b8; margin-top: 6px; line-height: 1.4;">${escapeHtml(c.description || 'Verified live application capability')}</div>
            </div>
          </div>`
        ).join('')
        : features.slice(0, 4).map(f =>
          `<div style="background: ${theme.cardBg}; border: 1px solid ${theme.borderColor}; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 16px; backdrop-filter: blur(15px);">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: ${theme.badgeBg}; display: flex; align-items: center; justify-content: center; font-size: 20px; color: ${theme.primary}; font-weight: bold;">✓</div>
            <div>
              <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${escapeHtml(f)}</div>
              <div style="font-size: 14px; color: #94a3b8; margin-top: 4px;">Verified capability from repository intelligence</div>
            </div>
          </div>`
        ).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgDark};
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
              position: relative;
            }
            .grid-bg {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
              background-size: 50px 50px;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              position: relative;
              z-index: 10;
            }
            .badge {
              display: inline-block;
              padding: 8px 20px;
              background: ${theme.badgeBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 9999px;
              color: ${theme.accentBadge};
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            h2 {
              font-size: 48px;
              font-weight: 900;
              background: linear-gradient(135deg, #ffffff, ${theme.primaryLight});
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              width: 100%;
              max-width: 1100px;
              position: relative;
              z-index: 10;
            }
          </style>
        </head>
        <body>
          <div class="grid-bg"></div>
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
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgGradient};
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
              background: ${theme.glow};
              filter: blur(60px);
            }
            .card {
              position: relative;
              z-index: 10;
              text-align: center;
              padding: 56px 80px;
              background: ${theme.cardBg};
              backdrop-filter: blur(25px);
              border: 1px solid ${theme.borderColor};
              border-radius: 28px;
              box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px ${theme.glow};
              max-width: 960px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 24px;
              background: ${theme.badgeBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 9999px;
              color: ${theme.accentBadge};
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
              background: linear-gradient(135deg, #ffffff 40%, ${theme.primaryLight} 100%);
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
              background: linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark});
              border-radius: 14px;
              color: white;
              font-size: 22px;
              font-weight: 700;
              box-shadow: 0 10px 30px -5px ${theme.glow};
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
            <div class="badge">OFFICIAL PRESENTATION</div>
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
      const problemTitle = escapeHtml(sourceAnalysis.problemTitle || 'Operational Friction');
      const problem = escapeHtml(sourceAnalysis.problem || 'Fragmented workflows and manual processes create bottlenecks that cost engineering teams valuable velocity and focus.');
      const solutionPurpose = escapeHtml(sourceAnalysis.purpose || rawTagline || 'A high-performance unified platform engineered to eliminate operational friction and deliver verified results.');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgDark};
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 60px;
              overflow: hidden;
              position: relative;
            }
            .grid-bg {
              position: absolute;
              inset: 0;
              background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
              background-size: 50px 50px;
            }
            .header {
              text-align: center;
              margin-bottom: 48px;
              position: relative;
              z-index: 10;
            }
            .header h2 {
              font-size: 48px;
              font-weight: 800;
              margin-bottom: 12px;
              background: linear-gradient(135deg, #ffffff, ${theme.primaryLight});
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .cards {
              display: flex;
              gap: 40px;
              width: 100%;
              max-width: 1300px;
              position: relative;
              z-index: 10;
            }
            .column {
              flex: 1;
              padding: 44px;
              border-radius: 24px;
              backdrop-filter: blur(20px);
            }
            .problem {
              background: rgba(239, 68, 68, 0.08);
              border: 1px solid rgba(239, 68, 68, 0.28);
            }
            .solution {
              background: ${theme.cardBg};
              border: 1px solid ${theme.borderColor};
              box-shadow: 0 0 40px ${theme.glow};
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
            .solution .tag { background: ${theme.badgeBg}; color: ${theme.primaryLight}; }
            .column h3 { font-size: 30px; margin-bottom: 16px; font-weight: 800; }
            .column p { font-size: 20px; color: #94a3b8; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="grid-bg"></div>
          <div class="header">
            <h2>Architectural Reimagination</h2>
          </div>
          <div class="cards">
            <div class="column problem">
              <div class="tag">The Challenge</div>
              <h3>${problemTitle}</h3>
              <p>${problem}</p>
            </div>
            <div class="column solution">
              <div class="tag">The Solution</div>
              <h3>${productName}</h3>
              <p>${solutionPurpose}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Default: Dynamic Cinematic Intro Card formatted to the project's visual archetype
    if (theme.archetype === 'tech_hud') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgDark};
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
              background-size: 40px 40px;
              background-image:
                linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            }
            .hud-bracket-tl { position: absolute; top: 40px; left: 40px; font-family: monospace; font-size: 20px; color: ${theme.primary}; }
            .hud-bracket-tr { position: absolute; top: 40px; right: 40px; font-family: monospace; font-size: 20px; color: ${theme.primary}; }
            .hud-bracket-bl { position: absolute; bottom: 40px; left: 40px; font-family: monospace; font-size: 20px; color: ${theme.primary}; }
            .hud-bracket-br { position: absolute; bottom: 40px; right: 40px; font-family: monospace; font-size: 20px; color: ${theme.primary}; }
            .telemetry-bar {
              position: absolute;
              top: 48px;
              font-family: monospace;
              font-size: 14px;
              color: ${theme.primaryLight};
              letter-spacing: 2px;
              text-transform: uppercase;
            }
            .hero-card {
              position: relative;
              z-index: 10;
              text-align: center;
              padding: 60px 80px;
              background: ${theme.cardBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 16px;
              box-shadow: 0 0 60px ${theme.glow};
              backdrop-filter: blur(20px);
            }
            .badge {
              display: inline-block;
              padding: 8px 24px;
              background: ${theme.badgeBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 4px;
              color: ${theme.accentBadge};
              font-family: monospace;
              font-size: 15px;
              font-weight: 700;
              letter-spacing: 3px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            h1 {
              font-size: 80px;
              font-weight: 900;
              letter-spacing: -2px;
              line-height: 1.1;
              margin-bottom: 20px;
              background: linear-gradient(135deg, #ffffff 40%, ${theme.primaryLight} 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 26px;
              color: #94a3b8;
              max-width: 900px;
              margin: 0 auto;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="grid-pattern"></div>
          <div class="hud-bracket-tl">┌─ [SYS.ONLINE]</div>
          <div class="hud-bracket-tr">[CORE.READY] ─┐</div>
          <div class="hud-bracket-bl">└─ [TEL.VERIFIED]</div>
          <div class="hud-bracket-br">[BROADCAST.MP4] ─┘</div>
          <div class="telemetry-bar">PLATFORM INTELLIGENCE // ${themeName.toUpperCase()} // REGION: GLOBAL</div>
          <div class="hero-card">
            <div class="badge">SYS // VERIFIED LAUNCH</div>
            <h1>${productName}</h1>
            <p>${tagline}</p>
          </div>
        </body>
        </html>
      `;
    }

    if (theme.archetype === 'glassmorphic_deck') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgGradient};
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              position: relative;
            }
            .orb-1 {
              position: absolute;
              width: 650px;
              height: 650px;
              top: -100px;
              left: -100px;
              border-radius: 50%;
              background: ${theme.glow};
              filter: blur(80px);
            }
            .orb-2 {
              position: absolute;
              width: 500px;
              height: 500px;
              bottom: -50px;
              right: -50px;
              border-radius: 50%;
              background: ${theme.glow};
              filter: blur(90px);
            }
            .glass-deck {
              position: relative;
              z-index: 10;
              text-align: center;
              padding: 70px 90px;
              background: ${theme.cardBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 32px;
              backdrop-filter: blur(30px);
              box-shadow: 0 30px 80px rgba(0,0,0,0.7), 0 0 40px ${theme.glow};
              max-width: 1000px;
            }
            .badge {
              display: inline-block;
              padding: 10px 28px;
              background: ${theme.badgeBg};
              border: 1px solid ${theme.borderColor};
              border-radius: 9999px;
              color: ${theme.accentBadge};
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 3px;
              text-transform: uppercase;
              margin-bottom: 26px;
            }
            h1 {
              font-size: 82px;
              font-weight: 900;
              letter-spacing: -2px;
              line-height: 1.1;
              margin-bottom: 22px;
              background: linear-gradient(135deg, #ffffff 40%, ${theme.primaryLight} 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 26px;
              color: #cbd5e1;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="orb-1"></div>
          <div class="orb-2"></div>
          <div class="glass-deck">
            <div class="badge">OFFICIAL PRESENTATION</div>
            <h1>${productName}</h1>
            <p>${tagline}</p>
          </div>
        </body>
        </html>
      `;
    }

    if (theme.archetype === 'kinetic_editorial') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${STRICT_CSP_META}
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              width: ${width}px;
              height: ${height}px;
              background: ${theme.bgGradient};
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              position: relative;
            }
            .diagonal-stripe {
              position: absolute;
              width: 200%;
              height: 160px;
              background: linear-gradient(90deg, transparent, ${theme.primaryDark}, transparent);
              opacity: 0.25;
              transform: rotate(-12deg);
            }
            .content {
              position: relative;
              z-index: 10;
              text-align: center;
              padding: 60px 80px;
            }
            .tag-banner {
              display: inline-block;
              padding: 10px 30px;
              background: ${theme.primary};
              color: #030712;
              border-radius: 8px;
              font-size: 18px;
              font-weight: 800;
              letter-spacing: 3px;
              text-transform: uppercase;
              margin-bottom: 28px;
              box-shadow: 0 10px 25px ${theme.glow};
            }
            h1 {
              font-size: 92px;
              font-weight: 900;
              letter-spacing: -3px;
              line-height: 1.05;
              margin-bottom: 24px;
              background: linear-gradient(135deg, #ffffff 50%, ${theme.primaryLight} 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 28px;
              color: #e2e8f0;
              max-width: 950px;
              margin: 0 auto;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="diagonal-stripe"></div>
          <div class="content">
            <div class="tag-banner">PRODUCT PRESENTATION</div>
            <h1>${productName}</h1>
            <p>${tagline}</p>
          </div>
        </body>
        </html>
      `;
    }

    // Default archetype: Minimalist Spotlight & Horizon
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        ${STRICT_CSP_META}
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: ${width}px;
            height: ${height}px;
            background: ${theme.bgGradient};
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
          }
          .horizon-line {
            position: absolute;
            width: 100%;
            height: 2px;
            top: 50%;
            background: linear-gradient(90deg, transparent, ${theme.primary}, transparent);
            opacity: 0.6;
          }
          .glow {
            position: absolute;
            width: 850px;
            height: 850px;
            background: radial-gradient(circle, ${theme.glow} 0%, transparent 65%);
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
            padding: 10px 28px;
            background: ${theme.badgeBg};
            border: 1px solid ${theme.borderColor};
            border-radius: 9999px;
            color: ${theme.accentBadge};
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 30px;
            box-shadow: 0 0 25px ${theme.glow};
          }
          h1 {
            font-size: 86px;
            font-weight: 900;
            letter-spacing: -2px;
            line-height: 1.1;
            margin-bottom: 24px;
            background: linear-gradient(135deg, #ffffff 40%, ${theme.primaryLight} 100%);
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
        <div class="horizon-line"></div>
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

MotionDesigner.escapeHtml = escapeHtml;
MotionDesigner.STRICT_CSP_META = STRICT_CSP_META;

module.exports = MotionDesigner;
