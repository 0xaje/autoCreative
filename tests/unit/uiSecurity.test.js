const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('../../src/public/js/app');

console.log('🧪 Running Unit Test: Studio UI XSS Prevention & Sanitization...');

// 1. Test escapeHtml with standard & edge-case XSS vectors
const vectors = [
  {
    input: '<script>alert("XSS")</script>',
    expected: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
  },
  {
    input: '<img src=x onerror=alert(document.domain)>',
    expected: '&lt;img src=x onerror=alert(document.domain)&gt;'
  },
  {
    input: '<svg/onload=alert(1)>',
    expected: '&lt;svg/onload=alert(1)&gt;'
  },
  {
    input: '" onfocus="alert(1)" autofocus="',
    expected: '&quot; onfocus=&quot;alert(1)&quot; autofocus=&quot;'
  },
  {
    input: '\' onclick=\'stealData()\'',
    expected: '&#39; onclick=&#39;stealData()&#39;'
  },
  {
    input: 'Hello & Welcome <Team> "2026"',
    expected: 'Hello &amp; Welcome &lt;Team&gt; &quot;2026&quot;'
  },
  {
    input: null,
    expected: ''
  },
  {
    input: undefined,
    expected: ''
  },
  {
    input: 12345,
    expected: '12345'
  }
];

for (const { input, expected } of vectors) {
  const result = escapeHtml(input);
  assert.strictEqual(
    result,
    expected,
    `Failed escaping for input: ${input}. Got: ${result}`
  );
  // Ensure no unescaped dangerous characters remain
  assert(!result.includes('<'), `Result must not contain unescaped <: ${result}`);
  assert(!result.includes('>'), `Result must not contain unescaped >: ${result}`);
  assert(!result.includes('"'), `Result must not contain unescaped ": ${result}`);
  assert(!result.includes("'"), `Result must not contain unescaped ': ${result}`);
}
console.log(`✅ Test 1 Passed: All ${vectors.length} XSS vectors cleanly sanitized by escapeHtml`);

// 2. Static Analysis: Verify no unescaped dynamic innerHTML in app.js
const appJsContent = fs.readFileSync(path.resolve(__dirname, '../../src/public/js/app.js'), 'utf8');

// Ensure no inline onclick interpolation with external data
assert(
  !appJsContent.includes("onclick=\"window.__loadArchiveProject('${p.id}')\""),
  'Inline onclick interpolation for __loadArchiveProject must be replaced with event listeners'
);
assert(
  !appJsContent.includes("onclick=\"window.__openRegenModal(${idx})\""),
  'Inline onclick interpolation for __openRegenModal must be replaced with data-index attribute'
);
console.log('✅ Test 2 Passed: Inline onclick event handler interpolations eliminated');

// 3. Verify all key dynamic interpolations use escapeHtml
const requiredEscapedPatterns = [
  'escapeHtml(scene.title',
  'escapeHtml(scene.narrationText',
  'escapeHtml(c.claim',
  'escapeHtml((s.title',
  'escapeHtml(s.narrationText',
  'escapeHtml(f)',
  'escapeHtml(w.name',
  'escapeHtml(p.manifest?.projectTitle',
  'escapeHtml(err.message)'
];

for (const pattern of requiredEscapedPatterns) {
  assert(
    appJsContent.includes(pattern),
    `app.js must use escapeHtml for: ${pattern}`
  );
}
console.log(`✅ Test 3 Passed: All ${requiredEscapedPatterns.length} critical UI panels enforce escapeHtml`);

// 4. Verify simulated malicious project manifest rendering produces zero executable tags
const maliciousScene = {
  title: 'Malicious Hook <script>alert("pwned")</script>',
  narrationText: 'Untrusted voiceover <img src="x" onerror="alert(1)">',
  type: 'exploit_demo',
  evidenceState: 'UNVERIFIED"><script>alert(2)</script>'
};

const renderedCardHtml = `
  <div class="timeline-scene-card" tabindex="0" role="button" aria-label="Seek to Scene 1: ${escapeHtml(maliciousScene.title)}">
    <h4 class="scene-title-text">${escapeHtml(maliciousScene.title)}</h4>
    <p class="scene-narration-snippet">${escapeHtml(maliciousScene.narrationText)}</p>
    <div class="scene-tags-group">
      <span class="pill-tag">${escapeHtml(maliciousScene.type)}</span>
      <span class="pill-tag verified">${escapeHtml(maliciousScene.evidenceState)}</span>
    </div>
  </div>
`;

assert(!renderedCardHtml.includes('<script>'), 'Rendered card must not contain raw <script> tag');
assert(!renderedCardHtml.includes('<img'), 'Rendered card must not contain raw <img tag');
assert(renderedCardHtml.includes('&lt;script&gt;'), 'Script tags were safely escaped to HTML entities');
assert(renderedCardHtml.includes('&lt;img'), 'Img tags were safely escaped to HTML entities');
assert(renderedCardHtml.includes('&quot;'), 'Quotes inside attributes were safely entity-escaped');

console.log('✅ Test 4 Passed: Rendered simulated untrusted project payload produces zero raw HTML tags');

console.log('\n🎉 ALL STUDIO UI SECURITY & XSS SANITIZATION TESTS PASSED!\n');
