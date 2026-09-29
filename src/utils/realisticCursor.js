/**
 * Script injected into Puppeteer pages to render a realistic, professional cursor
 * and animated visual interaction cues (ripples, spotlights, smooth scroll).
 */

const CURSOR_INJECTION_SCRIPT = `
(function() {
  if (window.__creativeStudioCursorInitialized) return;
  window.__creativeStudioCursorInitialized = true;

  // Create cursor container
  const cursor = document.createElement('div');
  cursor.id = 'studio-virtual-cursor';
  cursor.style.position = 'fixed';
  cursor.style.top = '0';
  cursor.style.left = '0';
  cursor.style.width = '24px';
  cursor.style.height = '24px';
  cursor.style.zIndex = '2147483647';
  cursor.style.pointerEvents = 'none';
  cursor.style.transform = 'translate3d(-100px, -100px, 0)';
  cursor.style.transition = 'transform 0.05s linear';
  cursor.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))';

  // SVG cursor icon
  cursor.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.95c.45 0 .67-.54.35-.85L5.85 2.85a.5.5 0 0 0-.35.36z" fill="#0f172a" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="#6366f1" /></svg>';
  document.documentElement.appendChild(cursor);

  // Spotlight highlight overlay
  const spotlight = document.createElement('div');
  spotlight.id = 'studio-spotlight-overlay';
  spotlight.style.position = 'fixed';
  spotlight.style.pointerEvents = 'none';
  spotlight.style.zIndex = '2147483646';
  spotlight.style.display = 'none';
  spotlight.style.border = '2px solid #6366f1';
  spotlight.style.borderRadius = '8px';
  spotlight.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.6)';
  spotlight.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  document.documentElement.appendChild(spotlight);

  // Spotlight label
  const spotLabel = document.createElement('div');
  spotLabel.id = 'studio-spotlight-label';
  spotLabel.style.position = 'absolute';
  spotLabel.style.bottom = '-32px';
  spotLabel.style.left = '0';
  spotLabel.style.background = '#6366f1';
  spotLabel.style.color = '#ffffff';
  spotLabel.style.fontFamily = 'system-ui, sans-serif';
  spotLabel.style.fontSize = '12px';
  spotLabel.style.fontWeight = '600';
  spotLabel.style.padding = '4px 10px';
  spotLabel.style.borderRadius = '4px';
  spotLabel.style.whiteSpace = 'nowrap';
  spotLabel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  spotlight.appendChild(spotLabel);

  let currentX = 100;
  let currentY = 100;

  window.__creativeCursor = {
    currentX,
    currentY,

    moveTo(targetX, targetY, duration) {
      const d = duration || 600;
      const startX = currentX;
      const startY = currentY;
      const startTime = performance.now();

      return new Promise(function(resolve) {
        function step(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / d, 1);
          const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          currentX = startX + (targetX - startX) * ease;
          currentY = startY + (targetY - startY) * ease;

          cursor.style.transform = 'translate3d(' + currentX + 'px, ' + currentY + 'px, 0)';

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    },

    async click(x, y) {
      if (typeof x === 'number' && typeof y === 'number') {
        await this.moveTo(x, y, 300);
      }

      const ripple = document.createElement('div');
      ripple.style.position = 'fixed';
      ripple.style.left = (currentX + 2) + 'px';
      ripple.style.top = (currentY + 2) + 'px';
      ripple.style.width = '10px';
      ripple.style.height = '10px';
      ripple.style.marginLeft = '-5px';
      ripple.style.marginTop = '-5px';
      ripple.style.borderRadius = '50%';
      ripple.style.border = '2px solid #a855f7';
      ripple.style.background = 'rgba(168, 85, 247, 0.4)';
      ripple.style.pointerEvents = 'none';
      ripple.style.zIndex = '2147483647';
      ripple.style.animation = 'studioClickRipple 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';

      if (!document.getElementById('studio-cursor-styles')) {
        const style = document.createElement('style');
        style.id = 'studio-cursor-styles';
        style.textContent = '@keyframes studioClickRipple { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(4.5); opacity: 0; } }';
        document.head.appendChild(style);
      }

      document.documentElement.appendChild(ripple);
      setTimeout(function() { ripple.remove(); }, 600);
    },

    highlight(rect, label) {
      if (!rect) {
        spotlight.style.display = 'none';
        return;
      }
      spotlight.style.display = 'block';
      spotlight.style.top = (rect.top - 6) + 'px';
      spotlight.style.left = (rect.left - 6) + 'px';
      spotlight.style.width = (rect.width + 12) + 'px';
      spotlight.style.height = (rect.height + 12) + 'px';
      if (label) {
        spotLabel.textContent = label;
        spotLabel.style.display = 'block';
      } else {
        spotLabel.style.display = 'none';
      }
    },

    clearHighlight() {
      spotlight.style.display = 'none';
    },

    smoothScroll(targetY, duration) {
      const d = duration || 800;
      const startY = window.scrollY;
      const startTime = performance.now();

      return new Promise(function(resolve) {
        function step(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / d, 1);
          const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          window.scrollTo(0, startY + (targetY - startY) * ease);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(step);
      });
    }
  };
})();
`;

module.exports = {
  CURSOR_INJECTION_SCRIPT
};
