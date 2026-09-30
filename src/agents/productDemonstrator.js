/**
 * Semantic Browser Demonstrator Agent
 * Executes resilient, semantic user interactions (by button text, role, label, placeholder)
 * with graceful recovery from failed interactions.
 */
class ProductDemonstrator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Plan semantic action sequence based on scene purpose and discovered workflows
   */
  planInteraction(scene, sourceAnalysis) {
    const workflows = sourceAnalysis.workflows || [];
    const featureCards = sourceAnalysis.featureCards || [];
    const keyMetrics = sourceAnalysis.keyMetrics || [];
    const interactionType = scene.visualPlan?.interaction || 'explore_primary_feature';
    const actions = [];

    // Lead-in time
    actions.push({ type: 'wait', duration: 500, label: 'Lead-in observation' });

    if (interactionType === 'explore_primary_feature') {
      // Prioritize semantic button or primary action
      const primaryWf = workflows[0];
      const cardTitle0 = featureCards[0]?.title;

      // 1. Move to and highlight primary interactive element
      actions.push({
        type: 'semantic_highlight',
        semanticQuery: {
          roles: ['button', 'link'],
          textHints: [primaryWf?.name, cardTitle0, 'Deploy', 'Start', 'Explore', 'Overview', 'Dashboard'].filter(Boolean),
          fallbackSelector: 'button.btn-primary, button, nav a:first-of-type'
        },
        label: scene.overlay?.lowerThird?.title || cardTitle0 || 'Interactive Control',
        duration: 1200
      });

      // 2. Click the primary semantic target
      actions.push({
        type: 'semantic_click',
        semanticQuery: {
          roles: ['button', 'link'],
          textHints: [primaryWf?.name, cardTitle0, 'Deploy', 'Start', 'Explore', 'Overview'].filter(Boolean),
          fallbackSelector: 'button.btn-primary, button, nav a:first-of-type'
        },
        duration: 600
      });

      // 3. Smooth scroll through content
      actions.push({ type: 'scroll', y: 400, duration: 800, label: 'Scroll to metrics' });
      actions.push({ type: 'wait', duration: 600 });

      // 4. Highlight live telemetry card
      const metricHints = keyMetrics.map(m => m.label).filter(Boolean);
      actions.push({
        type: 'semantic_highlight',
        semanticQuery: {
          roles: ['table', 'region', 'group'],
          textHints: [...metricHints, 'Throughput', 'Metrics', 'Status', 'Streams'],
          fallbackSelector: '.metric-card, .card, table, canvas'
        },
        label: keyMetrics[0] ? `${keyMetrics[0].value} ${keyMetrics[0].label}` : 'Live Telemetry & Status',
        duration: 1500
      });

      actions.push({ type: 'clear_highlight' });
      actions.push({ type: 'scroll', y: 0, duration: 700 });
    } else {
      // Deep dive feature interaction
      const secondaryWf = workflows[1] || workflows[0];
      const cardTitle1 = featureCards[1]?.title || featureCards[0]?.title;
      const searchTarget = cardTitle1 || sourceAnalysis.features?.[0] || sourceAnalysis.project || 'Explore';

      actions.push({ type: 'scroll', y: 250, duration: 600 });

      // Type into search/input if available
      actions.push({
        type: 'semantic_type',
        semanticQuery: {
          placeholderHints: ['Search', 'Filter', 'Enter', 'Query'],
          fallbackSelector: 'input[type="text"], input[type="search"], input'
        },
        text: searchTarget,
        duration: 800
      });

      // Click tab or filter button
      actions.push({
        type: 'semantic_click',
        semanticQuery: {
          roles: ['tab', 'button'],
          textHints: [secondaryWf?.name, cardTitle1, '24 Hours', 'Analytics', 'Pipelines', 'Filter'].filter(Boolean),
          fallbackSelector: '[role="tab"], .tab-btn, button:nth-of-type(2)'
        },
        duration: 600
      });

      actions.push({ type: 'wait', duration: 900 });
      actions.push({ type: 'scroll', y: 550, duration: 800 });

      actions.push({
        type: 'semantic_highlight',
        semanticQuery: {
          fallbackSelector: '.chart-section, table, .table-container, canvas'
        },
        label: 'Verified Real-Time Signal',
        duration: 1400
      });

      actions.push({ type: 'clear_highlight' });
    }

    // Lead-out time
    actions.push({ type: 'wait', duration: 500, label: 'Lead-out settlement' });

    return actions;
  }

  /**
   * Execute semantic interaction sequence with recovery
   */
  async executeSequence(page, actions, targetDurationSeconds) {
    const startTime = Date.now();
    const targetMs = (targetDurationSeconds || 8) * 1000;
    const executedActionsLog = [];

    for (const action of actions) {
      if (Date.now() - startTime >= targetMs - 300) break;

      const actLog = { type: action.type, label: action.label || '', timestamp: (Date.now() - startTime) / 1000 };

      try {
        switch (action.type) {
          case 'semantic_click':
            const clickedBox = await this.findSemanticElement(page, action.semanticQuery);
            if (clickedBox) {
              const cx = clickedBox.x + clickedBox.width / 2;
              const cy = clickedBox.y + clickedBox.height / 2;
              await page.evaluate((x, y) => window.__creativeCursor?.moveTo(x, y, 400), cx, cy);
              await new Promise(r => setTimeout(r, 400));
              await page.evaluate((x, y) => window.__creativeCursor?.click(x, y), cx, cy);
              await page.mouse.click(cx, cy).catch(() => {});
            } else {
              await page.evaluate(() => window.__creativeCursor?.click());
            }
            await new Promise(r => setTimeout(r, action.duration || 300));
            break;

          case 'semantic_highlight':
            const hlBox = await this.findSemanticElement(page, action.semanticQuery);
            if (hlBox) {
              await page.evaluate((b, l) => window.__creativeCursor?.highlight(b, l), hlBox, action.label || '');
              await new Promise(r => setTimeout(r, action.duration || 1000));
            }
            break;

          case 'semantic_type':
            const typeBox = await this.findSemanticElement(page, action.semanticQuery);
            if (typeBox) {
              const cx = typeBox.x + typeBox.width / 2;
              const cy = typeBox.y + typeBox.height / 2;
              await page.evaluate((x, y) => window.__creativeCursor?.moveTo(x, y, 400), cx, cy);
              await page.mouse.click(cx, cy).catch(() => {});
              await page.keyboard.type(action.text, { delay: 50 }).catch(() => {});
            }
            break;

          case 'clear_highlight':
            await page.evaluate(() => window.__creativeCursor?.clearHighlight());
            break;

          case 'scroll':
            await page.evaluate((y, d) => window.__creativeCursor?.smoothScroll(y, d), action.y, action.duration || 600);
            await new Promise(r => setTimeout(r, action.duration || 600));
            break;

          case 'wait':
            await new Promise(r => setTimeout(r, action.duration || 500));
            break;
        }
        actLog.success = true;
      } catch (err) {
        actLog.success = false;
        actLog.error = err.message;
      }

      executedActionsLog.push(actLog);
    }

    // Pad remaining time to exactly match required scene duration
    const remaining = targetMs - (Date.now() - startTime);
    if (remaining > 50) {
      await new Promise(r => setTimeout(r, remaining));
    }

    return executedActionsLog;
  }

  /**
   * Semantic element locator: searches by accessible text, aria-label, role, or fallback selector
   */
  async findSemanticElement(page, query = {}) {
    if (!query) return null;

    try {
      const box = await page.evaluate((q) => {
        const textHints = q.textHints || [];
        const fallbackSel = q.fallbackSelector || '';

        // 1. Search buttons and links by text hints
        if (textHints.length > 0) {
          const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"], h1, h2, h3, .metric-card, .card'));
          for (const hint of textHints) {
            if (!hint) continue;
            const match = candidates.find(el => {
              const text = el.textContent || '';
              const aria = el.getAttribute('aria-label') || '';
              return text.toLowerCase().includes(hint.toLowerCase()) || aria.toLowerCase().includes(hint.toLowerCase());
            });
            if (match) {
              const rect = match.getBoundingClientRect();
              if (rect.width > 10 && rect.height > 10) {
                return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
              }
            }
          }
        }

        // 2. Search inputs by placeholder
        if (q.placeholderHints && q.placeholderHints.length > 0) {
          const inputs = Array.from(document.querySelectorAll('input, textarea'));
          for (const ph of q.placeholderHints) {
            const inputMatch = inputs.find(i => (i.placeholder || '').toLowerCase().includes(ph.toLowerCase()));
            if (inputMatch) {
              const rect = inputMatch.getBoundingClientRect();
              return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            }
          }
        }

        // 3. Fallback selector
        if (fallbackSel) {
          const el = document.querySelector(fallbackSel);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 10) {
              return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            }
          }
        }

        return null;
      }, query);

      return box;
    } catch (e) {
      return null;
    }
  }
}

module.exports = ProductDemonstrator;
