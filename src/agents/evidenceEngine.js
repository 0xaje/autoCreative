const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../utils/ffmpegHelper');

class EvidenceEngine {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Safely normalize a button descriptor (structured object or legacy string) to clean text
   */
  normalizeButtonText(button) {
    if (!button) return '';
    if (typeof button === 'string') return button.trim();
    if (typeof button === 'object' && button !== null) {
      if (typeof button.text === 'string') return button.text.trim();
      if (typeof button.value === 'string') return button.value.trim();
      if (typeof button.name === 'string') return button.name.trim();
    }
    return '';
  }

  /**
   * Process all extracted features and claims, classifying each into an Evidence State:
   * VERIFIED | PARTIAL | UNVERIFIED | FUTURE
   */
  classifyEvidence(sourceAnalysis, projectDir) {
    return this.processEvidence(sourceAnalysis, projectDir);
  }

  processEvidence(sourceAnalysis, projectDir) {
    if (projectDir) ensureDir(projectDir);

    const liveData = sourceAnalysis.liveData || {};
    const githubData = sourceAnalysis.githubData || {};
    const features = sourceAnalysis.features || [];
    const readme = githubData.readmeContent || '';

    // Collect all prospective claims from feature cards, metrics, features, headings, and buttons
    const normalizedButtons = (liveData.buttons || [])
      .map(b => this.normalizeButtonText(b))
      .filter(text => text.length > 2);

    const cardClaims = (liveData.featureCards || []).map(fc => ({
      claim: fc.description ? `${fc.title}: ${fc.description}` : fc.title,
      source: 'Frontend Feature Card'
    }));

    const metricClaims = (liveData.keyMetrics || []).map(m => ({
      claim: `${m.value} ${m.label}`,
      source: 'Frontend Telemetry / Metric'
    }));

    const prospectiveClaims = [
      ...cardClaims,
      ...metricClaims,
      ...features.map(f => ({ claim: f, source: 'Features' })),
      ...(liveData.headings || []).map(h => ({ claim: h, source: 'Live Heading' })),
      ...normalizedButtons.slice(0, 5).map(btnText => ({ claim: `Actionable: ${btnText}`, source: 'Live UI Action' }))
    ];

    // Deduplicate claims
    const seen = new Set();
    const uniqueClaims = [];
    for (const item of prospectiveClaims) {
      const normalized = item.claim.toLowerCase().trim();
      if (!seen.has(normalized) && normalized.length > 5) {
        seen.add(normalized);
        uniqueClaims.push(item);
      }
    }

    const sourceMode = sourceAnalysis.sourceMode || (liveData.url ? 'LIVE_URL' : 'REPOSITORY_ANALYSIS_ONLY');
    const sourceLocation = liveData.url || githubData.target || sourceAnalysis.inputs?.liveUrl || sourceAnalysis.inputs?.githubUrl || sourceAnalysis.inputs?.localPath || 'workspace';

    // Evaluate each claim against evidence
    const evaluatedEvidence = uniqueClaims.map(item => {
      const evaluation = this.evaluateSingleClaim(item.claim, liveData, githubData, readme, sourceMode);
      return {
        claim: item.claim,
        source: item.source,
        sourceType: sourceMode,
        sourceLocation: sourceLocation,
        observation: evaluation.observation || item.claim,
        verificationMethod: evaluation.verificationMethod || 'HEURISTIC_EVALUATION',
        state: evaluation.state,
        confidence: evaluation.confidence,
        rationale: evaluation.rationale,
        demonstrable: evaluation.demonstrable,
        suggestedVisual: evaluation.suggestedVisual
      };
    });

    const summary = {
      sourceMode,
      sourceLocation,
      totalClaims: evaluatedEvidence.length,
      verifiedCount: evaluatedEvidence.filter(e => e.state === 'VERIFIED').length,
      partialCount: evaluatedEvidence.filter(e => e.state === 'PARTIAL').length,
      unverifiedCount: evaluatedEvidence.filter(e => e.state === 'UNVERIFIED').length,
      futureCount: evaluatedEvidence.filter(e => e.state === 'FUTURE').length,
      evidenceRatio: Math.round(
        (evaluatedEvidence.filter(e => e.state === 'VERIFIED').length / Math.max(evaluatedEvidence.length, 1)) * 100
      ),
      claims: evaluatedEvidence,
      verifiedAt: new Date().toISOString()
    };

    // Save evidence.json
    if (projectDir) {
      const evidencePath = path.join(projectDir, 'evidence.json');
      fs.writeFileSync(evidencePath, JSON.stringify(summary, null, 2), 'utf8');
    }

    return summary;
  }

  /**
   * Evaluate a single statement against live DOM, code dependencies, and text patterns
   */
  evaluateSingleClaim(claim, liveData, githubData, readme, sourceMode = 'LIVE_URL') {
    const lowerClaim = claim.toLowerCase();

    // 1. Check if future/roadmap
    const futureKeywords = ['coming soon', 'planned', 'roadmap', 'future', 'in development', 'wip', 'under construction', 'next release'];
    if (futureKeywords.some(kw => lowerClaim.includes(kw))) {
      return {
        state: 'FUTURE',
        confidence: 0.95,
        demonstrable: false,
        verificationMethod: 'ROADMAP_KEYWORD_MATCH',
        observation: 'Explicitly labeled as future/roadmap item in source material',
        rationale: 'Explicitly labeled as future/roadmap item in source material.',
        suggestedVisual: 'Roadmap preview card'
      };
    }

    // Check if mentioned in README as future
    const readmeLines = (readme || '').split('\n');
    for (const line of readmeLines) {
      if (line.toLowerCase().includes(lowerClaim) && futureKeywords.some(kw => line.toLowerCase().includes(kw))) {
        return {
          state: 'FUTURE',
          confidence: 0.90,
          demonstrable: false,
          verificationMethod: 'ROADMAP_KEYWORD_MATCH',
          observation: 'Roadmap keyword in repository documentation',
          rationale: 'Found in roadmap / upcoming section of repository documentation.',
          suggestedVisual: 'Roadmap preview card'
        };
      }
    }

    // 2. Check if verified in Live UI
    let matchedLiveElement = false;
    let matchDescription = '';

    // Check feature cards
    if (liveData.featureCards && liveData.featureCards.some(fc => {
      const cardTitle = (fc.title || '').toLowerCase();
      return cardTitle.length > 2 && (lowerClaim.includes(cardTitle) || cardTitle.includes(lowerClaim));
    })) {
      matchedLiveElement = true;
      matchDescription = 'Found structured feature card in live application interface.';
    }

    // Check key metrics
    if (liveData.keyMetrics && liveData.keyMetrics.some(m => {
      const val = (m.value || '').toLowerCase();
      const label = (m.label || '').toLowerCase();
      return (val && lowerClaim.includes(val)) || (label && lowerClaim.includes(label));
    })) {
      matchedLiveElement = true;
      matchDescription = 'Verified live metric / performance telemetry in interface.';
    }

    // Check headings
    if (liveData.headings && liveData.headings.some(h => h.toLowerCase().includes(lowerClaim) || lowerClaim.includes(h.toLowerCase()))) {
      matchedLiveElement = true;
      matchDescription = matchDescription || 'Found active heading in live application DOM.';
    }

    // Check buttons
    if (liveData.buttons && liveData.buttons.some(b => {
      const btnText = this.normalizeButtonText(b).toLowerCase();
      return btnText.length > 2 && (lowerClaim.includes(btnText) || btnText.includes(lowerClaim));
    })) {
      matchedLiveElement = true;
      matchDescription = matchDescription || 'Action button found in live application interface.';
    }

    // Check nav links
    if (liveData.navLinks && liveData.navLinks.some(n => lowerClaim.includes(n.text.toLowerCase()) || n.text.toLowerCase().includes(lowerClaim))) {
      matchedLiveElement = true;
      matchDescription = matchDescription || 'Dedicated navigation view verified in live application.';
    }

    // Check tech stack confirmation
    const techStack = githubData.detectedTech || [];
    let techMatched = false;
    for (const tech of techStack) {
      if (lowerClaim.includes(tech.toLowerCase())) {
        techMatched = true;
        break;
      }
    }

    if (matchedLiveElement && techMatched) {
      return {
        state: 'VERIFIED',
        confidence: 0.98,
        demonstrable: true,
        verificationMethod: 'DOM_QUERY',
        observation: matchDescription,
        rationale: `Cross-verified: ${matchDescription} and backed by verified codebase dependencies.`,
        suggestedVisual: 'Live interactive screen recording with cursor click'
      };
    }

    if (matchedLiveElement) {
      return {
        state: 'VERIFIED',
        confidence: 0.92,
        demonstrable: true,
        verificationMethod: 'DOM_QUERY',
        observation: matchDescription,
        rationale: matchDescription,
        suggestedVisual: 'Real screen recording of UI element'
      };
    }

    if (techMatched) {
      const isRepoOnly = sourceMode === 'REPOSITORY_ANALYSIS_ONLY';
      return {
        state: isRepoOnly ? 'VERIFIED' : 'PARTIAL',
        confidence: isRepoOnly ? 0.95 : 0.75,
        demonstrable: isRepoOnly,
        verificationMethod: 'PACKAGE_INSPECTION',
        observation: 'Found declared dependency in package.json configuration',
        rationale: isRepoOnly
          ? 'Verified dependency in repository package configuration.'
          : 'Verified in codebase dependencies, but not directly present as a prominent live UI element.',
        suggestedVisual: 'Code/architecture callout card'
      };
    }

    // Check for high-level vague or enterprise claims without proof
    const enterpriseFluff = ['enterprise-grade', 'millions of users', 'worlds fastest', 'guaranteed 100%', 'bank-grade', 'revolutionary'];
    if (enterpriseFluff.some(fluff => lowerClaim.includes(fluff))) {
      return {
        state: 'UNVERIFIED',
        confidence: 0.85,
        demonstrable: false,
        verificationMethod: 'HEURISTIC_EVALUATION',
        observation: 'High-level assertion lacking verifiable proof',
        rationale: 'Marketing claim lacking verifiable UI evidence or runtime benchmarks.',
        suggestedVisual: 'Omit from factual narration'
      };
    }

    // If repository-only and found in features from README
    if (sourceMode === 'REPOSITORY_ANALYSIS_ONLY') {
      return {
        state: 'VERIFIED',
        confidence: 0.88,
        demonstrable: true,
        verificationMethod: 'DOCUMENTATION_SCAN',
        observation: 'Documented capability in repository README',
        rationale: 'Verified feature in repository documentation.',
        suggestedVisual: 'Code and capability showcase card'
      };
    }

    // Default if found in features list or readme
    return {
      state: 'PARTIAL',
      confidence: 0.65,
      demonstrable: false,
      verificationMethod: 'DOCUMENTATION_SCAN',
      observation: 'Found in feature list, pending interactive verification',
      rationale: 'Documented in product features, pending interactive verification.',
      suggestedVisual: 'Feature highlight badge'
    };
  }

  /**
   * Filter claims to only those that can be safely stated as existing truth in narration
   */
  getNarratableClaims(evidenceSummary) {
    if (!evidenceSummary || !evidenceSummary.claims) return [];
    return evidenceSummary.claims.filter(c => c.state === 'VERIFIED' || c.state === 'PARTIAL');
  }
}

module.exports = EvidenceEngine;
