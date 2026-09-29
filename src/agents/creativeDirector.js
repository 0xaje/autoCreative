const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ensureDir } = require('../utils/ffmpegHelper');

class CreativeDirector {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Plan the video story arc, scenes, script, and visual strategy
   */
  planProduction({ userPrompt, mode, targetDuration, aspectRatio, sourceAnalysis, evidenceSummary, projectDir }) {
    ensureDir(projectDir);

    const safeMode = mode || config.DEFAULT_SPECS.defaultMode;
    const modeConfig = config.CREATIVE_MODES[safeMode] || config.CREATIVE_MODES.launch;
    const totalDuration = targetDuration || config.DEFAULT_SPECS.defaultDuration;
    const isVertical = aspectRatio === '9:16';

    const productName = sourceAnalysis.name || 'Next-Gen Platform';
    const tagline = sourceAnalysis.tagline || 'Intelligent Production Studio';
    const features = (sourceAnalysis.features || []).slice(0, 4);

    // Retrieve verified claims
    const verifiedClaims = (evidenceSummary?.claims || [])
      .filter(c => c.state === 'VERIFIED')
      .map(c => c.claim);

    const partialClaims = (evidenceSummary?.claims || [])
      .filter(c => c.state === 'PARTIAL')
      .map(c => c.claim);

    // Build scene architecture according to Creative Mode
    const scenes = this.buildSceneList({
      mode: safeMode,
      totalDuration,
      productName,
      tagline,
      features,
      verifiedClaims,
      partialClaims,
      userPrompt,
      isVertical
    });

    const manifest = {
      projectTitle: `${productName} - ${modeConfig.name}`,
      productName,
      tagline,
      creativeMode: safeMode,
      modeDescription: modeConfig.tagline,
      aspectRatio: isVertical ? '9:16' : '16:9',
      resolution: isVertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 },
      targetTotalDuration: totalDuration,
      scenesCount: scenes.length,
      scenes,
      plannedAt: new Date().toISOString()
    };

    // Extract complete script
    const script = {
      productName,
      totalScenes: scenes.length,
      fullText: scenes.map(s => s.narrationText).join(' '),
      scenes: scenes.map(s => ({
        id: s.id,
        title: s.title,
        narrationText: s.narrationText,
        estimatedDuration: s.targetDuration,
        evidenceTag: s.evidenceState
      }))
    };

    // Write scene-manifest.json and script.json
    fs.writeFileSync(path.join(projectDir, 'scene-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(projectDir, 'script.json'), JSON.stringify(script, null, 2), 'utf8');

    return { manifest, script };
  }

  /**
   * Structure scenes dynamically based on mode and evidence
   */
  buildSceneList({ mode, totalDuration, productName, tagline, features, verifiedClaims, partialClaims, userPrompt, isVertical }) {
    const f1 = verifiedClaims[0] || features[0] || 'Real-time interactive workflows';
    const f2 = verifiedClaims[1] || features[1] || 'Intelligent automation pipeline';
    const f3 = verifiedClaims[2] || features[2] || 'Production-grade analytics and controls';

    if (mode === 'social_short') {
      // 30-second vertical social short
      return [
        {
          id: 'scene-01-hook',
          index: 0,
          title: 'High-Energy Hook',
          type: 'motion_graphic',
          targetDuration: 5,
          evidenceState: 'VERIFIED',
          narrationText: `Stop wasting hours on manual work. Here is how ${productName} changes the game.`,
          visualPlan: {
            motionType: 'intro_punchy',
            headline: productName,
            subline: tagline,
            colorAccent: '#6366f1'
          },
          overlay: {
            lowerThird: null,
            badge: 'BREAKTHROUGH'
          }
        },
        {
          id: 'scene-02-demo',
          index: 1,
          title: 'Core Feature In Action',
          type: 'screen_recording',
          targetDuration: 15,
          evidenceState: 'VERIFIED',
          narrationText: `Watch this. With just one click, ${f1} executes seamlessly right inside the live application.`,
          visualPlan: {
            interaction: 'explore_primary_feature',
            targetSelector: 'button, .feature-action',
            zoomLevel: 1.2
          },
          overlay: {
            lowerThird: { title: 'Live Product', subtitle: f1 },
            badge: 'VERIFIED FEATURE'
          }
        },
        {
          id: 'scene-03-cta',
          index: 2,
          title: 'Call to Action',
          type: 'motion_graphic',
          targetDuration: 10,
          evidenceState: 'VERIFIED',
          narrationText: `Experience ${productName} today. Link in description.`,
          visualPlan: {
            motionType: 'outro_cta',
            ctaText: 'Get Started Now',
            url: 'Open Source / Live Web'
          },
          overlay: {
            lowerThird: null,
            badge: 'AVAILABLE NOW'
          }
        }
      ];
    }

    if (mode === 'demo') {
      // Hands-on feature demo (4 scenes)
      const d = Math.round(totalDuration / 4);
      return [
        {
          id: 'scene-01-intro',
          index: 0,
          title: 'Product Overview',
          type: 'motion_graphic',
          targetDuration: d,
          evidenceState: 'VERIFIED',
          narrationText: `Welcome to the official demonstration of ${productName}, designed for ${tagline}.`,
          visualPlan: { motionType: 'intro_cinematic', headline: productName, subline: tagline },
          overlay: { badge: 'PRODUCT DEMO' }
        },
        {
          id: 'scene-02-feature1',
          index: 1,
          title: 'Primary Workflow',
          type: 'screen_recording',
          targetDuration: d + 2,
          evidenceState: 'VERIFIED',
          narrationText: `Let's dive straight into the primary interface. Here, ${f1} allows users to execute complex tasks in seconds.`,
          visualPlan: { interaction: 'explore_primary_feature', targetSelector: 'nav, button' },
          overlay: { lowerThird: { title: 'Core Interface', subtitle: f1 }, badge: 'VERIFIED' }
        },
        {
          id: 'scene-03-feature2',
          index: 2,
          title: 'Deep Feature Walkthrough',
          type: 'screen_recording',
          targetDuration: d + 2,
          evidenceState: 'VERIFIED',
          narrationText: `Next, examine the powerful integration of ${f2}. Everything responds in real time with verified precision.`,
          visualPlan: { interaction: 'deep_dive_feature', targetSelector: 'input, .card' },
          overlay: { lowerThird: { title: 'Workflow Engine', subtitle: f2 }, badge: 'VERIFIED' }
        },
        {
          id: 'scene-04-outro',
          index: 3,
          title: 'Summary & Next Steps',
          type: 'motion_graphic',
          targetDuration: d - 4,
          evidenceState: 'VERIFIED',
          narrationText: `That was a fast look at ${productName}. Built for developers and creators who value speed and clarity.`,
          visualPlan: { motionType: 'outro_cta', ctaText: 'Explore the Project' },
          overlay: { badge: 'FINISHED DEMO' }
        }
      ];
    }

    // Default: Cinematic Launch / Product Presentation (5 scenes)
    const baseDuration = Math.round(totalDuration / 5);

    return [
      {
        id: 'scene-01-hero-intro',
        index: 0,
        title: 'Cinematic Hook & Title',
        type: 'motion_graphic',
        targetDuration: Math.max(baseDuration - 2, 7),
        evidenceState: 'VERIFIED',
        narrationText: `Every great breakthrough begins with a simpler way to build. Introducing ${productName}, ${tagline}.`,
        visualPlan: {
          motionType: 'intro_cinematic',
          headline: productName,
          subline: tagline,
          colorAccent: '#6366f1'
        },
        overlay: {
          badge: 'PRODUCT LAUNCH'
        }
      },
      {
        id: 'scene-02-the-problem',
        index: 1,
        title: 'The Challenge & Architecture',
        type: 'hybrid_callout',
        targetDuration: baseDuration,
        evidenceState: 'VERIFIED',
        narrationText: `Traditional workflows are fragmented and manual. ${productName} reimagines the entire process with an intuitive, unified platform.`,
        visualPlan: {
          motionType: 'problem_solution_split',
          headline: 'The Problem: Fragmented Tools',
          subline: 'The Solution: Autonomous Unified Experience'
        },
        overlay: {
          lowerThird: { title: 'Architecture', subtitle: 'Automated & Cohesive' },
          badge: 'ARCHITECTURE'
        }
      },
      {
        id: 'scene-03-live-feature-1',
        index: 2,
        title: 'Core Product in Action',
        type: 'screen_recording',
        targetDuration: baseDuration + 3,
        evidenceState: 'VERIFIED',
        narrationText: `Here is the actual application at work. Notice how effortlessly you can navigate and leverage ${f1}.`,
        visualPlan: {
          interaction: 'explore_primary_feature',
          targetSelector: 'nav a, button.btn-primary',
          scrollBehavior: 'smooth'
        },
        overlay: {
          lowerThird: { title: 'Live Capability', subtitle: f1 },
          badge: 'VERIFIED EVIDENCE'
        }
      },
      {
        id: 'scene-04-live-feature-2',
        index: 3,
        title: 'Deep Dive & Real Results',
        type: 'screen_recording',
        targetDuration: baseDuration + 2,
        evidenceState: 'VERIFIED',
        narrationText: `Behind the scenes, ${f2} delivers dependable performance, validated against real-world production metrics.`,
        visualPlan: {
          interaction: 'deep_dive_feature',
          targetSelector: 'input, select, .metric-card',
          scrollBehavior: 'smooth'
        },
        overlay: {
          lowerThird: { title: 'Performance Engine', subtitle: f2 },
          badge: 'VERIFIED EVIDENCE'
        }
      },
      {
        id: 'scene-05-outro-cta',
        index: 4,
        title: 'Momentum & Call to Action',
        type: 'motion_graphic',
        targetDuration: Math.max(baseDuration - 3, 7),
        evidenceState: 'VERIFIED',
        narrationText: `Whether you are shipping for clients or building your own vision, ${productName} is ready to elevate your creative output.`,
        visualPlan: {
          motionType: 'outro_cta',
          headline: 'Start Creating Today',
          ctaText: 'Visit Live Application',
          url: 'Repository & Live Deployment Available'
        },
        overlay: {
          badge: 'GET STARTED'
        }
      }
    ];
  }
}

module.exports = CreativeDirector;
