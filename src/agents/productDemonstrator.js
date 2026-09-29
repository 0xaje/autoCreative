/**
 * Product Demonstrator Agent
 * Plans and coordinates autonomous user interactions across the live application.
 */
class ProductDemonstrator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generate an actionable interaction sequence for a specific scene
   */
  planInteraction(scene, sourceAnalysis) {
    const liveData = sourceAnalysis.liveData || {};
    const interactionType = scene.visualPlan?.interaction || 'explore_primary_feature';

    const actions = [];

    if (interactionType === 'explore_primary_feature') {
      // Step 1: Initial focus on hero area
      actions.push({ type: 'move', x: 600, y: 350, duration: 600 });
      actions.push({ type: 'wait', duration: 400 });

      // Step 2: Highlight first action button or nav link
      actions.push({
        type: 'highlight_selector',
        selector: 'button.btn-primary, button, nav a:first-of-type, .hero-cta',
        label: scene.overlay?.lowerThird?.title || 'Interactive Feature',
        duration: 1200
      });

      // Step 3: Click and trigger interaction
      actions.push({
        type: 'click_selector',
        selector: 'button.btn-primary, button, nav a:first-of-type, .hero-cta',
        duration: 500
      });

      // Step 4: Smooth scroll down to view content
      actions.push({ type: 'scroll', y: 450, duration: 900 });
      actions.push({ type: 'wait', duration: 800 });

      // Step 5: Highlight card or metric
      actions.push({
        type: 'highlight_selector',
        selector: '.card, .feature-card, .metric, table',
        label: 'Real-time System Status',
        duration: 1500
      });
      actions.push({ type: 'clear_highlight' });
      actions.push({ type: 'scroll', y: 0, duration: 700 });
    } else {
      // Deep dive feature interaction
      actions.push({ type: 'scroll', y: 250, duration: 600 });
      actions.push({ type: 'move', x: 750, y: 400, duration: 500 });

      // Type into input if exists
      actions.push({
        type: 'type_into',
        selector: 'input[type="text"], input[type="search"], input',
        text: 'Automated Creative Studio',
        duration: 800
      });

      // Click tab or filter
      actions.push({
        type: 'click_selector',
        selector: '[role="tab"], .filter-btn, .tab-btn, button:nth-of-type(2)',
        duration: 500
      });

      actions.push({ type: 'wait', duration: 1000 });
      actions.push({ type: 'scroll', y: 600, duration: 800 });
      actions.push({
        type: 'highlight_selector',
        selector: '.chart, canvas, .metric-container, table tr:nth-of-type(2)',
        label: 'Verified Performance Metric',
        duration: 1200
      });
      actions.push({ type: 'clear_highlight' });
    }

    return actions;
  }

  /**
   * Execute an action sequence inside a Puppeteer page
   */
  async executeSequence(page, actions, targetDurationSeconds) {
    const startTime = Date.now();
    const targetMs = (targetDurationSeconds || 8) * 1000;

    for (const action of actions) {
      if (Date.now() - startTime >= targetMs - 400) break;

      try {
        switch (action.type) {
          case 'move':
            await page.evaluate((x, y, d) => {
              if (window.__creativeCursor) return window.__creativeCursor.moveTo(x, y, d);
            }, action.x, action.y, action.duration || 500);
            await new Promise(r => setTimeout(r, action.duration || 500));
            break;

          case 'click_selector':
            const el = await page.$(action.selector);
            if (el) {
              const box = await el.boundingBox();
              if (box) {
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                await page.evaluate((x, y) => window.__creativeCursor?.moveTo(x, y, 400), cx, cy);
                await new Promise(r => setTimeout(r, 400));
                await page.evaluate((x, y) => window.__creativeCursor?.click(x, y), cx, cy);
                await el.click().catch(() => {});
              }
            } else {
              // Click in place
              await page.evaluate(() => window.__creativeCursor?.click());
            }
            await new Promise(r => setTimeout(r, 300));
            break;

          case 'highlight_selector':
            const targetEl = await page.$(action.selector);
            if (targetEl) {
              const box = await targetEl.boundingBox();
              if (box) {
                await page.evaluate((b, label) => window.__creativeCursor?.highlight(b, label), box, action.label || '');
                await new Promise(r => setTimeout(r, action.duration || 1000));
              }
            }
            break;

          case 'clear_highlight':
            await page.evaluate(() => window.__creativeCursor?.clearHighlight());
            break;

          case 'type_into':
            const input = await page.$(action.selector);
            if (input) {
              await input.click().catch(() => {});
              await input.type(action.text, { delay: 60 }).catch(() => {});
            }
            break;

          case 'scroll':
            await page.evaluate((y, d) => window.__creativeCursor?.smoothScroll(y, d), action.y, action.duration || 600);
            await new Promise(r => setTimeout(r, action.duration || 600));
            break;

          case 'wait':
            await new Promise(r => setTimeout(r, action.duration || 500));
            break;
        }
      } catch (err) {
        // Continue sequence gracefully on non-fatal dom deviations
      }
    }

    // Pad remaining time to match target duration precisely
    const remaining = targetMs - (Date.now() - startTime);
    if (remaining > 50) {
      await new Promise(r => setTimeout(r, remaining));
    }
  }
}

module.exports = ProductDemonstrator;
