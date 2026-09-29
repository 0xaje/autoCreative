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
   * Main entry point: Performs Repository analysis and Product analysis,
   * synthesizing both into the internal Project Model (project_model.json).
   */
  async analyzeSource({ projectName, githubUrl, liveUrl, localPath, projectDir, onProgress }) {
    ensureDir(projectDir);
    const assetsDir = ensureDir(path.join(projectDir, 'assets'));

    if (onProgress) {
      onProgress({ agent: 'Researcher', message: 'Initiating repository and live product intelligence scan...' });
    }

    let githubData = null;
    let liveUrlData = null;

    // 1. Repository Analysis (README, package.json, source tree, APIs, config)
    if (githubUrl || localPath) {
      if (onProgress) {
        onProgress({ agent: 'Researcher', message: 'Analyzing repository structure, dependencies, APIs, and docs...' });
      }
      githubData = await this.analyzeRepository(githubUrl || localPath);
    }

    // 2. Product Analysis (Live DOM, pages, navigation, primary workflows, interactions)
    if (liveUrl) {
      if (onProgress) {
        onProgress({ agent: 'Researcher', message: `Crawling live application at ${liveUrl}...` });
      }
      liveUrlData = await this.analyzeLiveUrl(liveUrl, assetsDir);
    }

    // 3. Synthesize into internal Project Model (project_model.json)
    if (onProgress) {
      onProgress({ agent: 'Researcher', message: 'Building internal project understanding model...' });
    }
    const projectModel = this.buildProjectModel({
      projectName,
      githubData,
      liveUrlData,
      inputs: { githubUrl, liveUrl, localPath }
    });

    // Save project_model.json and source-analysis.json
    fs.writeFileSync(path.join(projectDir, 'project_model.json'), JSON.stringify(projectModel, null, 2), 'utf8');
    fs.writeFileSync(path.join(projectDir, 'source-analysis.json'), JSON.stringify(projectModel, null, 2), 'utf8');

    if (onProgress) {
      onProgress({ agent: 'Researcher', message: 'Project understanding model successfully built and saved.' });
    }

    return projectModel;
  }

  /**
   * Comprehensive repository analysis
   */
  async analyzeRepository(target) {
    const data = {
      isRepo: true,
      target,
      name: '',
      description: '',
      readmeContent: '',
      packageJson: null,
      sourceTree: [],
      detectedTech: [],
      features: [],
      apis: [],
      configs: []
    };

    // If local directory
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      data.name = path.basename(target);

      // 1. Read README.md
      const readmeFiles = ['README.md', 'readme.md', 'README.txt'];
      for (const r of readmeFiles) {
        const p = path.join(target, r);
        if (fs.existsSync(p)) {
          data.readmeContent = fs.readFileSync(p, 'utf8');
          break;
        }
      }

      // 2. Read package.json
      const pkgPath = path.join(target, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          data.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (e) {}
      }

      // 3. Scan source tree & configs
      try {
        const files = fs.readdirSync(target);
        data.sourceTree = files.slice(0, 30);
        data.configs = files.filter(f => f.includes('config') || f.endsWith('.json') || f.endsWith('.yml') || f.startsWith('.env'));
      } catch (e) {}
    } else if (typeof target === 'string' && (target.startsWith('http://') || target.startsWith('https://'))) {
      // Remote GitHub repository
      const match = target.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, '');
        data.name = repo;

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

    if (data.packageJson) {
      if (data.packageJson.name) data.name = data.packageJson.name;
      if (data.packageJson.description) data.description = data.packageJson.description;
      if (data.packageJson.dependencies) {
        data.detectedTech = Object.keys(data.packageJson.dependencies);
      }
    }

    if (data.readmeContent) {
      data.features = this.extractFeaturesFromMarkdown(data.readmeContent);
      if (!data.description) {
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
   * Product analysis on live URL with Puppeteer
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
      workflows: [],
      heroScreenshot: null
    };

    try {
      browser = await puppeteer.launch({
        executablePath: config.BINARIES.chrome,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
        headless: 'new'
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {
        return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      });

      // Capture Hero Screenshot
      const heroPath = path.join(assetsDir, 'hero-landing.png');
      await page.screenshot({ path: heroPath, type: 'png' });
      data.heroScreenshot = heroPath;

      // Extract semantic DOM structure & discover primary workflows
      const extracted = await page.evaluate(() => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 3 && t.length < 120)
          .slice(0, 10);

        const navLinks = Array.from(document.querySelectorAll('nav a, header a, a.nav-link, [role="tab"]'))
          .map(el => ({
            text: el.textContent.trim(),
            href: el.getAttribute('href') || '',
            id: el.id || '',
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : 'nav a'
          }))
          .filter(l => l.text.length > 2 && l.text.length < 30)
          .slice(0, 8);

        const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], input[type="submit"]'))
          .map(el => ({
            text: el.textContent.trim() || el.getAttribute('value') || '',
            id: el.id || '',
            className: el.className || '',
            selector: el.id ? `#${el.id}` : 'button'
          }))
          .filter(b => b.text.length > 2 && b.text.length < 35)
          .slice(0, 10);

        // Discover actionable workflows
        const workflows = [];
        if (buttons.length > 0) {
          workflows.push({
            id: 'primary_action_flow',
            name: buttons[0].text,
            targetSelector: buttons[0].selector,
            actionType: 'click',
            description: `Execute primary user action: ${buttons[0].text}`
          });
        }
        if (navLinks.length > 1) {
          workflows.push({
            id: 'navigation_flow',
            name: `Navigate to ${navLinks[1].text}`,
            targetSelector: navLinks[1].selector,
            actionType: 'click_tab',
            description: `Explore secondary view: ${navLinks[1].text}`
          });
        }

        return {
          title: ogTitle || title,
          metaDescription: metaDesc,
          headings,
          navLinks,
          buttons,
          workflows
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
   * Extract features from Markdown content
   */
  extractFeaturesFromMarkdown(content) {
    const features = [];
    const featureRegex = /(?:###?\s*(?:Features|Capabilities|Key Features|Highlights)|##\s*(?:Features|Capabilities))([\s\S]*?)(?:##|$)/i;
    const match = content.match(featureRegex);

    if (match && match[1]) {
      const items = match[1].split('\n');
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
   * Synthesize data into the exact PRD Project Understanding Model
   */
  buildProjectModel({ projectName, githubData, liveUrlData, inputs }) {
    let name = projectName || '';
    let purpose = '';
    let problem = 'Fragmented tools and slow manual workflows reduce engineering velocity.';
    let targetUser = 'Developers, technical founders, and product teams';

    if (liveUrlData && liveUrlData.title) {
      const liveName = liveUrlData.title.split(/[-–|]/)[0].trim();
      if (!name) name = liveName;
      purpose = liveUrlData.metaDescription || liveUrlData.headings[0] || '';
    }

    if (!name && githubData && githubData.name) {
      name = githubData.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (!purpose && githubData && githubData.description) {
      purpose = githubData.description;
    }

    if (!name) name = 'Autonomous Product';
    if (!purpose) purpose = 'Autonomous intelligence platform designed for modern workflows';

    // Collect all features
    const allFeatures = Array.from(new Set([
      ...(githubData ? githubData.features : []),
      ...(liveUrlData ? (liveUrlData.headings || []).filter(h => h.length > 10 && h !== purpose) : [])
    ])).slice(0, 6);

    const workflows = (liveUrlData?.workflows && liveUrlData.workflows.length > 0)
      ? liveUrlData.workflows
      : [
          {
            id: 'telemetry_overview',
            name: 'Live Telemetry Exploration',
            targetSelector: '#nav-analytics',
            description: 'Explores real-time metrics and verifies interactive controls'
          },
          {
            id: 'stream_deploy',
            name: 'Stream Deployment Action',
            targetSelector: '#btn-deploy',
            description: 'Deploys event stream and observes state transition'
          }
        ];

    return {
      project: name,
      name,
      purpose,
      tagline: purpose,
      target_user: targetUser,
      problem,
      features: allFeatures.length > 0 ? allFeatures : [
        'Real-time automated workflow',
        'Intuitive modern interface',
        'Intelligent data synchronization',
        'Production-grade reliability'
      ],
      workflows,
      integrations: githubData?.detectedTech || ['JavaScript', 'Node.js', 'Modern Web'],
      evidence: [],
      inputs,
      liveData: liveUrlData,
      githubData,
      heroScreenshot: liveUrlData?.heroScreenshot || null,
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = Researcher;
