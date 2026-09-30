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
   * Determine secure Chrome launch arguments with sandbox enabled by default.
   * Only disables sandbox when explicitly configured or when running as root container.
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
   * Main entry point: Performs Repository analysis and Product analysis,
   * synthesizing both into the internal Project Model (project_model.json).
   */
  async analyzeSource({ projectName, githubUrl, liveUrl, localPath, isDemo, projectDir, onProgress }) {
    const assetsDir = projectDir ? ensureDir(path.join(projectDir, 'assets')) : null;
    if (projectDir) {
      ensureDir(projectDir);
    }

    // Determine explicit, truthful source mode
    let sourceMode = 'LIVE_URL';
    if (isDemo || (localPath && localPath.includes('demo-apps/saas-analytics'))) {
      sourceMode = 'DEMO';
    } else if (liveUrl) {
      sourceMode = 'LIVE_URL';
    } else if (localPath) {
      const resolved = path.resolve(localPath);
      if (!fs.existsSync(resolved)) {
        const err = new Error(`Local application or repository path not found: ${localPath}`);
        err.code = 'SOURCE_UNAVAILABLE';
        throw err;
      }
      const hasExecutableHtml = fs.statSync(resolved).isDirectory()
        ? (fs.existsSync(path.join(resolved, 'index.html')) ||
           fs.existsSync(path.join(resolved, 'public', 'index.html')) ||
           fs.existsSync(path.join(resolved, 'src', 'public', 'index.html')) ||
           fs.existsSync(path.join(resolved, 'dist', 'index.html')))
        : resolved.endsWith('.html');
      if (githubUrl && hasExecutableHtml) {
        sourceMode = 'REPOSITORY_EXECUTED';
      } else {
        sourceMode = hasExecutableHtml ? 'LOCAL_APP' : 'REPOSITORY_ANALYSIS_ONLY';
      }
    } else if (githubUrl) {
      sourceMode = 'REPOSITORY_ANALYSIS_ONLY';
    } else {
      const err = new Error('No valid source provided. Expected liveUrl, localPath, or githubUrl.');
      err.code = 'SOURCE_EXECUTION_UNAVAILABLE';
      throw err;
    }

    if (onProgress) {
      onProgress({ agent: 'Researcher', message: `Initiating ${sourceMode} intelligence scan...` });
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
      sourceMode,
      inputs: { githubUrl, liveUrl, localPath, isDemo }
    });

    // Save project_model.json and source-analysis.json
    if (projectDir) {
      fs.writeFileSync(path.join(projectDir, 'project_model.json'), JSON.stringify(projectModel, null, 2), 'utf8');
      fs.writeFileSync(path.join(projectDir, 'source-analysis.json'), JSON.stringify(projectModel, null, 2), 'utf8');
    }

    if (onProgress) {
      onProgress({ agent: 'Researcher', message: `Project understanding model successfully built for [${sourceMode}].` });
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

    // Validate local target existence
    if (typeof target === 'string' && !target.startsWith('http://') && !target.startsWith('https://')) {
      const resolved = path.resolve(target);
      if (!fs.existsSync(resolved)) {
        const err = new Error(`Local application or repository path not found: ${target}`);
        err.code = 'SOURCE_UNAVAILABLE';
        throw err;
      }
    }

    // If local directory or file
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
   * Deep Product analysis on live URL with Puppeteer
   * Extracts hero value props, problem statements, structured feature cards, key metrics,
   * multi-section screenshots, and sub-page architecture.
   */
  async analyzeLiveUrl(url, assetsDir) {
    let browser = null;
    const data = {
      url,
      title: '',
      metaDescription: '',
      heroHeadline: '',
      heroSubheadline: '',
      problemStatement: '',
      solutionStatement: '',
      headings: [],
      paragraphs: [],
      navLinks: [],
      buttons: [],
      featureCards: [],
      keyMetrics: [],
      techBadges: [],
      subPages: [],
      interactiveElements: [],
      workflows: [],
      heroScreenshot: null,
      visualAssets: {}
    };

    try {
      const { args: launchArgs, shouldDisableSandbox } = this.getChromeLaunchArgs({ width: 1920, height: 1080 });

      try {
        browser = await puppeteer.launch({
          executablePath: config.BINARIES.chrome,
          args: launchArgs,
          headless: 'new'
        });
      } catch (launchErr) {
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
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate with SPA fallback
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {
        return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      });

      // Allow 1.5s for dynamic SPA framework rendering / animations to settle
      await new Promise(r => setTimeout(r, 1500));

      // 1. Capture Top Hero Screenshot
      if (assetsDir) {
        const heroPath = path.join(assetsDir, 'hero-landing.png');
        await page.screenshot({ path: heroPath, type: 'png' });
        data.heroScreenshot = heroPath;
        data.visualAssets.hero = heroPath;
      }

      // 2. Extract Deep Frontend Semantic DOM Structure
      const extracted = await page.evaluate(() => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

        // Hero headline & subheadline
        const h1El = document.querySelector('h1') || document.querySelector('header h2, .hero h2, [class*="hero"] h2');
        const heroHeadline = h1El ? h1El.textContent.trim().replace(/\s+/g, ' ') : '';

        const subEl = document.querySelector('.hero p, header p, h1 + p, p.lead, p.subtitle, [class*="hero"] p') ||
                      document.querySelector('p');
        const heroSubheadline = subEl ? subEl.textContent.trim().replace(/\s+/g, ' ').slice(0, 300) : '';

        // Headings
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
          .map(el => el.textContent.trim().replace(/\s+/g, ' '))
          .filter(t => t.length > 3 && t.length < 120 && !t.includes('{') && !t.includes('}'))
          .slice(0, 16);

        // Problem Statement & Solution Statements
        let problemStatement = '';
        let solutionStatement = '';
        const allParagraphs = Array.from(document.querySelectorAll('p, blockquote, .problem, .challenge, [class*="problem"], [class*="challenge"]'))
          .map(p => p.textContent.trim().replace(/\s+/g, ' '))
          .filter(t => t.length > 25 && t.length < 400);

        const problemKeywords = ['problem', 'challenge', 'frustrated', 'pain', 'traditional', 'hard to', 'difficult', 'struggling', 'manual', 'waste', 'why we built', 'bottleneck', 'hours spent', 'fragmented'];
        for (const p of allParagraphs) {
          const lower = p.toLowerCase();
          if (problemKeywords.some(kw => lower.includes(kw)) && !problemStatement) {
            problemStatement = p;
            break;
          }
        }

        const solutionKeywords = ['solution', 'introduce', 'introducing', 'empowers', 'enables', 'reimagines', 'built for', 'simplifies', 'automatically', 'all-in-one', 'streamlines'];
        for (const p of allParagraphs) {
          const lower = p.toLowerCase();
          if (solutionKeywords.some(kw => lower.includes(kw)) && !solutionStatement) {
            solutionStatement = p;
            break;
          }
        }

        // Structured Feature Cards
        const cardSelectors = '.card, [class*="feature"], [class*="card"], [class*="benefit"], [class*="pillar"], .grid > div, .flex > div, section article, .metric-card';
        const rawCards = Array.from(document.querySelectorAll(cardSelectors));
        const featureCards = [];
        const seenCardTitles = new Set();

        for (const card of rawCards) {
          const titleEl = card.querySelector('h2, h3, h4, h5, strong, [class*="title"], [class*="heading"]');
          const descEl = card.querySelector('p, [class*="desc"], [class*="text"], span');
          if (titleEl && descEl) {
            const cardTitle = titleEl.textContent.trim().replace(/\s+/g, ' ');
            const cardDesc = descEl.textContent.trim().replace(/\s+/g, ' ');
            const normTitle = cardTitle.toLowerCase();
            if (cardTitle.length >= 3 && cardTitle.length < 60 && cardDesc.length >= 10 && cardDesc.length < 350 && !seenCardTitles.has(normTitle)) {
              seenCardTitles.add(normTitle);
              featureCards.push({
                title: cardTitle,
                description: cardDesc
              });
            }
          }
          if (featureCards.length >= 8) break;
        }

        // Key Metrics & Telemetry Stats
        const keyMetrics = [];
        const statEls = Array.from(document.querySelectorAll('[class*="metric"], [class*="stat"], [class*="counter"], [class*="number"], .stat-item, .metric-card'));
        for (const s of statEls) {
          const valEl = s.querySelector('[class*="val"], [class*="num"], strong, h2, h3, span') || s;
          const labelEl = s.querySelector('[class*="label"], [class*="title"], [class*="desc"], p') || s;
          const valText = valEl.textContent.trim();
          const labelText = labelEl.textContent.trim();
          const matchNum = valText.match(/(\d+[\d\.,]*(?:%|\+|k|x|ms|s|m|gb|tb|fps))/i);
          if (matchNum && labelText.length > 2 && labelText.length < 50) {
            const cleanLabel = labelText.replace(matchNum[0], '').trim();
            if (cleanLabel) {
              keyMetrics.push({ value: matchNum[0], label: cleanLabel });
            }
          }
          if (keyMetrics.length >= 4) break;
        }

        // Navigation links & Buttons
        const navLinks = Array.from(document.querySelectorAll('nav a, header a, a.nav-link, [role="tab"]'))
          .map(el => ({
            text: el.textContent.trim().replace(/\s+/g, ' '),
            href: el.getAttribute('href') || '',
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : 'nav a'
          }))
          .filter(l => l.text.length > 2 && l.text.length < 35)
          .slice(0, 10);

        const buttons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], input[type="submit"]'))
          .map(el => ({
            text: el.textContent.trim().replace(/\s+/g, ' ') || el.getAttribute('value') || '',
            id: el.id || '',
            selector: el.id ? `#${el.id}` : 'button'
          }))
          .filter(b => b.text.length > 2 && b.text.length < 35)
          .slice(0, 10);

        // Tech Stack Badges
        const techBadges = Array.from(document.querySelectorAll('.badge, .tag, [class*="badge"], [class*="tag"], [class*="tech"]'))
          .map(el => el.textContent.trim().replace(/\s+/g, ' '))
          .filter(t => t.length > 1 && t.length < 25 && !t.includes('{'))
          .slice(0, 10);

        // Workflows
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
        if (featureCards.length > 0) {
          workflows.push({
            id: 'feature_walkthrough_flow',
            name: featureCards[0].title,
            targetSelector: cardSelectors,
            actionType: 'highlight_feature',
            description: `Deep walkthrough of ${featureCards[0].title}`
          });
        }
        if (navLinks.length > 1) {
          workflows.push({
            id: 'navigation_flow',
            name: `Explore ${navLinks[1].text}`,
            targetSelector: navLinks[1].selector,
            actionType: 'click_tab',
            description: `Explore secondary view: ${navLinks[1].text}`
          });
        }

        return {
          title: ogTitle || title,
          metaDescription: metaDesc,
          heroHeadline,
          heroSubheadline,
          problemStatement,
          solutionStatement,
          headings,
          paragraphs: allParagraphs.slice(0, 8),
          featureCards,
          keyMetrics,
          techBadges,
          navLinks,
          buttons,
          workflows
        };
      });

      Object.assign(data, extracted);

      // 3. Multi-Section Screenshots & Visual Captures
      if (assetsDir) {
        // Scroll down to middle (features / interactive section)
        await page.evaluate(() => window.scrollBy({ top: 650, behavior: 'instant' }));
        await new Promise(r => setTimeout(r, 600));
        const featPath = path.join(assetsDir, 'section-features.png');
        await page.screenshot({ path: featPath, type: 'png' });
        data.visualAssets.features = featPath;

        // Scroll down further (workflow / dashboard / metrics)
        await page.evaluate(() => window.scrollBy({ top: 750, behavior: 'instant' }));
        await new Promise(r => setTimeout(r, 600));
        const workflowPath = path.join(assetsDir, 'section-workflow.png');
        await page.screenshot({ path: workflowPath, type: 'png' });
        data.visualAssets.workflow = workflowPath;

        // Reset scroll position
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      // 4. Explore up to 2 reachable sub-pages or documentation routes if present
      const subRoutes = (extracted.navLinks || [])
        .filter(l => l.href && (l.href.startsWith('/') || l.href.startsWith(url)) && !l.href.includes('#') && l.href !== url && l.href !== '/')
        .slice(0, 2);

      for (let i = 0; i < subRoutes.length; i++) {
        const subRoute = subRoutes[i];
        try {
          const subPage = await browser.newPage();
          await subPage.setViewport({ width: 1920, height: 1080 });
          const targetUrl = subRoute.href.startsWith('http') ? subRoute.href : new URL(subRoute.href, url).href;
          await subPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await new Promise(r => setTimeout(r, 600));

          const subDetails = await subPage.evaluate(() => {
            const h = Array.from(document.querySelectorAll('h1, h2, h3')).map(e => e.textContent.trim()).filter(Boolean).slice(0, 4);
            const p = Array.from(document.querySelectorAll('p')).map(e => e.textContent.trim()).filter(t => t.length > 20).slice(0, 3);
            return { headings: h, paragraphs: p };
          });

          if (assetsDir) {
            const subShotPath = path.join(assetsDir, `subpage-${i + 1}.png`);
            await subPage.screenshot({ path: subShotPath, type: 'png' });
            data.visualAssets[`subpage_${i + 1}`] = subShotPath;
          }

          data.subPages.push({
            name: subRoute.text,
            url: targetUrl,
            ...subDetails
          });

          await subPage.close();
        } catch (subErr) {
          // Non-blocking sub-page exploration
          console.warn(`[Researcher] Sub-page exploration skipped for ${subRoute?.text || 'route'}:`, subErr.message);
        }
      }
    } catch (err) {
      if (browser) await browser.close().catch(() => {});
      const unreachErr = new Error(`Cannot reach live application at ${url}: ${err.message}`);
      unreachErr.code = 'LIVE_APP_UNREACHABLE';
      unreachErr.details = err.message;
      throw unreachErr;
    } finally {
      if (browser) await browser.close().catch(() => {});
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
  buildProjectModel({ projectName, githubData, liveUrlData, sourceMode, inputs }) {
    let name = projectName || '';
    let purpose = '';
    let problem = '';
    let targetUser = 'Developers, technical founders, and product teams';

    if (liveUrlData && liveUrlData.title) {
      const liveName = liveUrlData.title.split(/[-–|]/)[0].trim();
      if (!name) name = liveName;
    }

    if (!name && githubData && githubData.name) {
      name = githubData.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (!name) name = 'Project Workspace';

    // Purpose & Tagline from real frontend
    if (liveUrlData?.heroSubheadline) {
      purpose = liveUrlData.heroSubheadline;
    } else if (liveUrlData?.metaDescription) {
      purpose = liveUrlData.metaDescription;
    } else if (liveUrlData?.solutionStatement) {
      purpose = liveUrlData.solutionStatement;
    } else if (githubData?.description) {
      purpose = githubData.description;
    } else {
      purpose = 'Next-generation software solution';
    }

    // Problem Statement from real frontend
    if (liveUrlData?.problemStatement) {
      problem = liveUrlData.problemStatement;
    } else if (liveUrlData?.headings?.length > 1) {
      problem = `Developers and teams face high friction and manual bottlenecks with traditional workflows before ${name}.`;
    } else {
      problem = 'Complex workflows require automated, dependable tools.';
    }

    // Extract rich feature list: feature cards, github features, headings
    const cardFeatures = (liveUrlData?.featureCards || []).map(fc => `${fc.title}: ${fc.description}`);
    const headingFeatures = (liveUrlData?.headings || []).filter(h => h.length > 5 && h !== purpose && h !== name);
    const githubFeatures = githubData ? (githubData.features || []) : [];

    const allFeatures = Array.from(new Set([
      ...cardFeatures,
      ...githubFeatures,
      ...headingFeatures
    ])).slice(0, 10);

    const workflows = (liveUrlData?.workflows && liveUrlData.workflows.length > 0)
      ? liveUrlData.workflows
      : [];

    return {
      project: name,
      name,
      purpose,
      tagline: purpose,
      target_user: targetUser,
      problem,
      features: allFeatures,
      featureCards: liveUrlData?.featureCards || [],
      keyMetrics: liveUrlData?.keyMetrics || [],
      subPages: liveUrlData?.subPages || [],
      techBadges: liveUrlData?.techBadges || [],
      workflows,
      integrations: Array.from(new Set([
        ...(githubData?.detectedTech || []),
        ...(liveUrlData?.techBadges || [])
      ])),
      evidence: [],
      sourceMode: sourceMode || 'LIVE_URL',
      inputs,
      liveData: liveUrlData,
      githubData,
      heroScreenshot: liveUrlData?.heroScreenshot || null,
      visualAssets: liveUrlData?.visualAssets || (liveUrlData?.heroScreenshot ? { hero: liveUrlData.heroScreenshot } : {}),
      analyzedAt: new Date().toISOString()
    };
  }
}

module.exports = Researcher;
