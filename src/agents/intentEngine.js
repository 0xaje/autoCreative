const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../utils/ffmpegHelper');

class IntentEngine {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Parse free-form natural language creative request into a structured Intent Model
   */
  parseIntent(userPrompt, overrides = {}, projectDir) {
    if (projectDir) ensureDir(projectDir);

    const text = (userPrompt || '').toLowerCase();

    // 1. Content Type Detection
    let contentType = 'product_demo';
    if (text.includes('launch') || text.includes('reveal') || text.includes('announcement')) {
      contentType = 'launch_video';
    } else if (text.includes('presentation') || text.includes('architecture') || text.includes('overview')) {
      contentType = 'product_presentation';
    } else if (text.includes('explain') || text.includes('investor') || text.includes('concept')) {
      contentType = 'explainer';
    } else if (text.includes('tutorial') || text.includes('how to') || text.includes('step by step') || text.includes('guide')) {
      contentType = 'tutorial';
    } else if (text.includes('vertical') || text.includes('short') || text.includes('9:16') || text.includes('reel') || text.includes('tiktok') || text.includes('x video')) {
      contentType = 'social_short';
    } else if (text.includes('demo') || text.includes('workflow') || text.includes('feature')) {
      contentType = 'product_demo';
    }

    // 2. Duration Parsing
    let durationSeconds = 60;
    const secMatch = text.match(/(\d+)\s*[-]?\s*(?:seconds?|secs?|s\b)/);
    const minMatch = text.match(/(\d+(?:\.\d+)?)\s*[-]?\s*(?:minutes?|mins?|m\b)/);

    if (secMatch) {
      durationSeconds = parseInt(secMatch[1], 10);
    } else if (minMatch) {
      durationSeconds = Math.round(parseFloat(minMatch[1]) * 60);
    } else if (contentType === 'social_short') {
      durationSeconds = 30;
    }

    // Clamp between 15s and 180s, guarding against NaN or non-finite values
    if (!Number.isFinite(durationSeconds)) {
      durationSeconds = 60;
    }
    durationSeconds = Math.max(15, Math.min(180, durationSeconds));

    // 3. Aspect Ratio Parsing
    let aspectRatio = '16:9';
    if (text.includes('vertical') || text.includes('9:16') || text.includes('portrait') || text.includes('reel') || text.includes('tiktok') || contentType === 'social_short') {
      aspectRatio = '9:16';
    } else if (text.includes('square') || text.includes('1:1')) {
      aspectRatio = '1:1';
    }

    // 4. Audience Detection
    let audience = 'general_technical';
    if (text.includes('investor') || text.includes('venture') || text.includes('vc')) {
      audience = 'investors';
    } else if (text.includes('developer') || text.includes('engineer') || text.includes('coder') || text.includes('builder')) {
      audience = 'developers';
    } else if (text.includes('creator') || text.includes('designer')) {
      audience = 'creators';
    } else if (text.includes('customer') || text.includes('consumer') || text.includes('end user')) {
      audience = 'general_public';
    }

    // 5. Tone Parsing
    let tone = 'premium';
    if (text.includes('cinematic') || text.includes('epic') || text.includes('movie')) {
      tone = 'cinematic';
    } else if (text.includes('technical') || text.includes('deep dive') || text.includes('in-depth')) {
      tone = 'technical';
    } else if (text.includes('casual') || text.includes('friendly') || text.includes('conversational')) {
      tone = 'casual';
    } else if (text.includes('punchy') || text.includes('energetic') || text.includes('fast-paced')) {
      tone = 'energetic';
    }

    // 6. Voice Preferences
    let voicePreference = 'male_professional';
    let voiceId = 'en-US-ChristopherNeural';
    if (text.includes('female') || text.includes('woman') || text.includes('jenny')) {
      voicePreference = 'female_clear';
      voiceId = 'en-US-JennyNeural';
    } else if (text.includes('british') || text.includes('uk') || text.includes('sonia')) {
      voicePreference = 'british_sophisticated';
      voiceId = 'en-GB-SoniaNeural';
    } else if (text.includes('casual') || text.includes('founder') || text.includes('guy')) {
      voicePreference = 'male_casual';
      voiceId = 'en-US-GuyNeural';
    } else if (text.includes('presenter') || text.includes('aria')) {
      voicePreference = 'female_presenter';
      voiceId = 'en-US-AriaNeural';
    }

    // 7. Custom Directives
    const customInstructions = [];
    if (text.includes('show the product more') || text.includes('show real product') || text.includes('more product')) {
      customInstructions.push('maximize_product_screentime');
    }
    if (text.includes('don\'t spend too much time') || text.includes('less architecture') || text.includes('skip architecture')) {
      customInstructions.push('condense_architecture');
    }
    if (text.includes('stronger opening') || text.includes('make the opening stronger') || text.includes('punchy hook')) {
      customInstructions.push('enhance_hook');
    }
    if (text.includes('faster') || text.includes('brisk')) {
      customInstructions.push('faster_pacing');
    }
    if (text.includes('show more of the dashboard') || text.includes('more dashboard') || text.includes('focus on dashboard')) {
      customInstructions.push('show_more_dashboard');
    }
    if (text.includes('remove the cinematic intro') || text.includes('skip intro') || text.includes('no cinematic')) {
      customInstructions.push('remove_cinematic_intro');
    }
    if (text.includes('change the ending') || text.includes('better ending') || text.includes('stronger cta') || text.includes('new ending')) {
      customInstructions.push('change_ending');
    }
    if (text.includes('more technical') || text.includes('for developers') || text.includes('developer demo')) {
      customInstructions.push('more_technical');
    }

    // Safely evaluate duration override
    let finalDuration = durationSeconds;
    if (overrides.duration !== undefined && overrides.duration !== null) {
      const parsedOverride = parseInt(overrides.duration, 10);
      if (Number.isFinite(parsedOverride)) {
        finalDuration = Math.max(15, Math.min(180, parsedOverride));
      }
    }

    // Apply explicit user overrides from form/API
    const intent = {
      content_type: overrides.contentType || overrides.mode || contentType,
      duration_seconds: finalDuration,
      aspect_ratio: overrides.aspectRatio || aspectRatio,
      audience: overrides.audience || audience,
      tone: overrides.tone || tone,
      show_real_product: overrides.showRealProduct !== false,
      voiceover: overrides.voiceover !== false,
      captions: overrides.captions !== false,
      music: overrides.music !== false,
      creative_freedom: overrides.creativeFreedom !== undefined ? overrides.creativeFreedom : 0.35,
      voice_id: overrides.voiceId || voiceId,
      voice_preference: voicePreference,
      custom_instructions: customInstructions,
      raw_prompt: userPrompt,
      parsed_at: new Date().toISOString()
    };

    if (projectDir) {
      fs.writeFileSync(path.join(projectDir, 'intent.json'), JSON.stringify(intent, null, 2), 'utf8');
    }

    return intent;
  }
}

module.exports = IntentEngine;
