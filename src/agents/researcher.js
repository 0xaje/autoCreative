const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const config = require('../config');
const { ensureDir } = require('../utils/ffmpegHelper');

class Researcher {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Main entry point to research GitHub repository and/or Live application URL.
   */
  async analyzeSource({ githubUrl, liveUrl, localPath, projectDir, onProgress }) {
    ensureDir(projectDir);
    const assetsDir = ensureDir(path.join(projectDir, 'assets'));

    if (onProgress) onProgress({ agent: 'Researcher', message: 'Starting comprehensive source intelligence scan...' });

    let githubData = null;
    let liveUrlData = null;

    // 1. Analyze GitHub repository or local repo if provided
    if (githubUrl || localPath) {
      if (onProgress) onProgress({ agent: 'Researcher', message: 'Analyzing repository structure, documentation, and codebase...' });
      githubData = await this.analyzeRepository(githubUrl || localPath);
    }

    // 2. Analyze Live Application URL if provided
    if (liveUrl) {
      if (onProgress) onProgress({ agent: 'Researcher', message: `Crawling live application at ${liveUrl}...` });
      liveUrlData = await this.analyzeLiveUrl(liveUrl, assetsDir);
    }

    // 3. Synthesize findings
    if (onProgress) onProgress({ agent: 'Researcher', message: 'Synthesizing product capabilities and feature matrix...' });
    const synthesized = this.synthesizeData(githubData, liveUrlData, { githubUrl, liveUrl, localPath });

    // Save source-analysis.json
    const analysisPath = path.join(projectDir, 'source-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(synthesized, null, 2), 'utf8');

    if (onProgress) onProgress({ agent: 'Researcher', message: 'Source analysis completed and saved to source-analysis.json.' });

    return synthesized;
  }

  /**
   * Extract information from GitHub URL or local folder
   */
  async analyzeRepository(target) {
    const data = {
      isRepo: true,
      url: target,
      name: '',
      description: '',
      readmeContent: '',
      packageJson: null,
      detectedTech: [],
      features: []
    };

    // If local directory
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      data.name = path.basename(target);
      const readmePath = path.join(target, 'README.md');
      if (fs.existsSync(readmePath)) {
        data.readmeContent = fs.readFileSync(readmePath, 'utf8');
      }
      const pkgPath = path.join(target, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          data.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (e) {}
      }
    } else if (typeof target === 'string' && (target.startsWith('http://') || target.startsWith('https://'))) {
      // Remote GitHub URL
      // Parse owner/repo
      const match = target.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, '');
        data.name = repo;

        // Attempt to fetch raw README
        const branches = ['main', 'master'];
        for (const branch of branches) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
            const res = await fetch(rawUrl);
            if (res.ok) {
              data.readmeContent = await res.text();
              break;
            }
          } catch (e) {}
        }

        // Attempt to fetch package.json
        for (const branch of branches) {
          try {
            const pkgUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`;
            const res = await fetch(pkgUrl);
            if (res.ok) {
              data.packageJson = await res.json();
              break;
            }
          } catch (e) {}
        }
      }
    }

    // Extract product name & description if available
    if (data.packageJson) {
      if (data.packageJson.name) data.name = data.packageJson.name;
      if (data.packageJson.description) data.description = data.packageJson.description;
      if (data.packageJson.dependencies) {
        data.detectedTech = Object.keys(data.packageJson.dependencies);
      }
    }

    // Parse README for features
    if (data.readmeContent) {
      data.features = this.extractFeaturesFromMarkdown(data.readmeContent);
      if (!data.description) {
        // Grab first non-header paragraph
        const lines = data.readmeContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('![')) {
            data.description = trimmed;
            break;
          }
        }
      }
    }

    return data;
  }

  /**
   * Crawl and inspect Live Application URL using Puppeteer
   */
  async analyzeLiveUrl(url, assetsDir) {
    let browser = null;
    const data = {
      url,
      title: '',
      metaDescription: '',
      headings: [],
      navLinks: [],
      buttons: [],
      interactiveElements: [],
      heroScreenshot: null,
      themeColors: []
    };

    try {
      browser = await puppeteer.launch({
        executablePath: config.BINARIES.chrome,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
        headless: 'new'
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(e => {
        // Fallback with domcontentloaded if networkidle2 times out
        return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      });

      // Capture Hero Screenshot
      const heroPath = path.join(assetsDir, 'hero-landing.png');
      await page.screenshot({ path: heroPath, type: 'png' });
      data.heroScreenshot = heroPath;

      // Extract metadata from DOM
      const extracted = await page.evaluate(() => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

        const headings = Array.from(document.querySelectorAll('h1, h2'))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 3 && t.length < 120)
          .slice(0, 8);

        const navLinks = Array.from(document.querySelectorAll('nav a, header a, a.nav-link'))
          .map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') }))
          .filter(l => l.text.length > 2 && l.text.length < 30)
          .slice(0, 8);

        const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], input[type="submit"]'))
          .map(el => el.textContent.trim() || el.getAttribute('value') || '')
          .filter(t => t.length > 2 && t.length < 35)
          .slice(0, 10);

        // Discovered interactive components
        const interactive = Array.from(document.querySelectorAll('input, select, table, chart, canvas, [role="tab"], .card, .feature-card'))
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            className: el.className || '',
            id: el.id || '',
            rect: el.getBoundingClientRect()
          }))
          .filter(item => item.rect.width > 20 && item.rect.height > 20)
          .slice(0, 15);

        return {
          title: ogTitle || title,
          metaDescription: metaDesc,
          headings,
          navLinks,
          buttons,
          interactiveElements: interactive
        };
      });

      Object.assign(data, extracted);
    } catch (err) {
      console.warn('Researcher live URL crawl warning:', err.message);
      data.crawlError = err.message;
    } finally {
      if (browser) await browser.close();
    }

    return data;
  }

  /**
   * Parse bullet points or headers under Features in README
   */
  extractFeaturesFromMarkdown(content) {
    const features = [];
    const featureRegex = /(?:###?\s*(?:Features|Capabilities|Key Features|Highlights)|##\s*(?:Features|Capabilities))([\s\S]*?)(?:##|$)/i;
    const match = content.match(featureRegex);

    if (match && match[1]) {
      const section = match[1];
      const items = section.split('\n');
      for (const item of items) {
        const trimmed = item.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
          const clean = trimmed.replace(/^[\*\-]\s*(\*\*)?/, '').replace(/\*\*.*$/, '').replace(/[:\.\-]$/, '').trim();
          if (clean.length > 3 && clean.length < 100) {
            features.push(clean);
          }
        }
      }
    }

    // Fallback: search for bold feature headers
    if (features.length === 0) {
      const boldItems = content.match(/\*\*([A-Za-z0-9\s]{3,35})\*\*/g);
      if (boldItems) {
        boldItems.forEach(b => {
          const clean = b.replace(/\*\*/g, '').trim();
          if (clean.length > 4 && !clean.includes('http') && !features.includes(clean)) {
            features.push(clean);
          }
        });
      }
    }

    return features.slice(0, 8);
  }

  /**
   * Synthesize GitHub and Live URL info into unified product knowledge
   */
  synthesizeData(github, live, inputs) {
    let name = '';
    let tagline = '';
    let description = '';

    if (live && live.title) {
      name = live.title.split(/[-–|]/)[0].trim();
      tagline = live.metaDescription || live.headings[0] || '';
    }

    if (!name && github && github.name) {
      name = github.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (!tagline && github && github.description) {
      tagline = github.description;
    }

    if (!name) name = 'Next-Gen Product';
    if (!tagline) tagline = 'Autonomous Creative Solution';

    description = (live && live.metaDescription) || (github && github.description) || tagline;

    const allFeatures = Array.from(new Set([
      ...(github ? github.features : []),
      ...(live ? live.headings.filter(h => h.length > 10 && h !== tagline) : [])
    ])).slice(0, 6);

    return {
      name,
      tagline,
      description,
      inputs,
      features: allFeatures.length > 0 ? allFeatures : [
        'Real-time automated workflow',
        'Intuitive modern interface',
        'Intelligent data synchronization',
        'Production-grade reliability'
      ],
      techStack: github?.detectedTech || ['JavaScript', 'Node.js', 'Modern Web'],
      liveData: live,
      githubData: github,
      heroScreenshot: live?.heroScreenshot || null,
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = Researcher;
