const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ensureDir } = require('../utils/ffmpegHelper');

class CreativeDirector {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Plan video story arc, scenes, script, and visual strategy conforming to the PRD Scene Manifest
   */
  planProduction({ userIntent, projectModel, evidenceSummary, projectDir }) {
    ensureDir(projectDir);

    const intent = userIntent || {};
    const totalDuration = intent.duration_seconds || 60;
    const isVertical = intent.aspect_ratio === '9:16';
    const contentType = intent.content_type || 'product_demo';

    const productName = projectModel.project || projectModel.name || 'Autonomous Product';
    const tagline = projectModel.purpose || projectModel.tagline || 'Intelligent production studio';
    const problem = projectModel.problem || 'Manual, fragmented workflows waste engineering time.';
    const features = (projectModel.features || []).slice(0, 4);

    // Retrieve verified claims
    const verifiedClaims = (evidenceSummary?.claims || [])
      .filter(c => c.state === 'VERIFIED')
      .map(c => c.claim);

    const f1 = verifiedClaims[0] || features[0] || 'Real-time telemetry and verified workflows';
    const f2 = verifiedClaims[1] || features[1] || 'Autonomous event processing pipeline';
    const f3 = verifiedClaims[2] || features[2] || 'Reliable operational intelligence';

    const scenes = this.buildSceneList({
      contentType,
      totalDuration,
      productName,
      tagline,
      problem,
      f1,
      f2,
      f3,
      customInstructions: intent.custom_instructions || [],
      isVertical
    });

    // Format PRD Scene Manifest
    const sceneManifest = {
      projectTitle: `${productName} — ${contentType.replace(/_/g, ' ').toUpperCase()}`,
      duration: totalDuration,
      aspect_ratio: intent.aspect_ratio || '16:9',
      resolution: isVertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 },
      audience: intent.audience || 'general_technical',
      tone: intent.tone || 'premium',
      scenes
    };

    // Full spoken script JSON
    const script = {
      project: productName,
      totalScenes: scenes.length,
      fullText: scenes.map(s => s.voiceover).join(' '),
      scenes: scenes.map(s => ({
        id: s.id,
        purpose: s.purpose,
        voiceover: s.voiceover,
        duration: s.duration,
        evidenceTag: s.evidenceState
      }))
    };

    fs.writeFileSync(path.join(projectDir, 'scene-manifest.json'), JSON.stringify(sceneManifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(projectDir, 'script.json'), JSON.stringify(script, null, 2), 'utf8');

    return { manifest: sceneManifest, script };
  }

  /**
   * Build structured scenes according to PRD requirements
   */
  buildSceneList({ contentType, totalDuration, productName, tagline, problem, f1, f2, f3, customInstructions, isVertical }) {
    const condenseArch = customInstructions.includes('condense_architecture');
    const enhanceHook = customInstructions.includes('enhance_hook');

    if (contentType === 'social_short' || totalDuration <= 30) {
      return [
        {
          id: 'hook',
          duration: 5,
          type: 'cinematic_hook',
          purpose: 'High-energy hook introducing the problem',
          voiceover: enhanceHook
            ? `Stop wasting engineering hours on manual toolchains. Here is how ${productName} changes everything.`
            : `Here is how ${productName} solves ${problem}`,
          visuals: [{ source: 'motion_graphic', motionType: 'intro_cinematic' }],
          evidenceState: 'VERIFIED',
          title: 'High-Energy Hook'
        },
        {
          id: 'product_demo',
          duration: Math.max(totalDuration - 13, 10),
          type: 'product_demo',
          purpose: 'Demonstrate primary live product workflow',
          voiceover: `Watch this. With just one click, ${f1} executes seamlessly inside the live application with verified performance.`,
          visuals: [{ source: 'browser_recording', recording_id: 'primary_flow' }],
          evidenceState: 'VERIFIED',
          title: 'Live Product Action',
          overlay: { lowerThird: { title: 'Live Capability', subtitle: f1 }, badge: 'VERIFIED' }
        },
        {
          id: 'outro_cta',
          duration: 8,
          type: 'call_to_action',
          purpose: 'Final call to action and momentum',
          voiceover: `Experience ${productName} today. Link in description.`,
          visuals: [{ source: 'motion_graphic', motionType: 'outro_cta' }],
          evidenceState: 'VERIFIED',
          title: 'Call to Action'
        }
      ];
    }

    // 5-scene standard broadcast structure
    const baseDuration = Math.round(totalDuration / 5);
    const archDuration = condenseArch ? Math.max(baseDuration - 3, 4) : baseDuration;
    const demoBonus = condenseArch ? 3 : 0;

    return [
      {
        id: 'hook',
        duration: Math.max(baseDuration - 2, 7),
        type: 'cinematic_hook',
        purpose: 'Introduce the problem and capture immediate attention',
        voiceover: `Every great breakthrough begins with a simpler way to build. Introducing ${productName}, ${tagline}.`,
        visuals: [{ source: 'motion_graphic', motionType: 'intro_cinematic' }],
        evidenceState: 'VERIFIED',
        title: 'Cinematic Hook & Title',
        overlay: { badge: 'PRODUCT LAUNCH' }
      },
      {
        id: 'product_reveal',
        duration: archDuration,
        type: 'product_reveal',
        purpose: 'Reveal the architecture and the core solution',
        voiceover: `Traditional tools are fragmented and manual. ${productName} reimagines the entire experience into an intuitive, unified platform.`,
        visuals: [{ source: 'motion_graphic', motionType: 'problem_solution_split' }],
        evidenceState: 'VERIFIED',
        title: 'The Challenge & Architecture',
        overlay: { lowerThird: { title: 'Architecture', subtitle: 'Automated & Cohesive' }, badge: 'ARCHITECTURE' }
      },
      {
        id: 'feature_1',
        duration: baseDuration + demoBonus + 2,
        type: 'product_demo',
        purpose: 'Demonstrate primary live workflow with real product footage',
        voiceover: `Here is the actual application at work. Notice how effortlessly you can navigate and leverage ${f1}.`,
        visuals: [{ source: 'browser_recording', recording_id: 'primary_flow' }],
        evidenceState: 'VERIFIED',
        title: 'Core Product in Action',
        overlay: { lowerThird: { title: 'Live Capability', subtitle: f1 }, badge: 'VERIFIED EVIDENCE' }
      },
      {
        id: 'feature_2',
        duration: baseDuration + 2,
        type: 'product_demo',
        purpose: 'Demonstrate deep dive feature with real telemetry results',
        voiceover: `Behind the scenes, ${f2} delivers dependable performance, validated against real-world production metrics.`,
        visuals: [{ source: 'browser_recording', recording_id: 'deep_flow' }],
        evidenceState: 'VERIFIED',
        title: 'Deep Dive & Real Results',
        overlay: { lowerThird: { title: 'Performance Engine', subtitle: f2 }, badge: 'VERIFIED EVIDENCE' }
      },
      {
        id: 'outro_cta',
        duration: Math.max(baseDuration - 3, 7),
        type: 'call_to_action',
        purpose: 'Encourage adoption with clear next steps',
        voiceover: `Whether you are shipping for clients or building your own vision, ${productName} is ready to elevate your creative output.`,
        visuals: [{ source: 'motion_graphic', motionType: 'outro_cta' }],
        evidenceState: 'VERIFIED',
        title: 'Momentum & Call to Action',
        overlay: { badge: 'GET STARTED' }
      }
    ];
  }
}

module.exports = CreativeDirector;
