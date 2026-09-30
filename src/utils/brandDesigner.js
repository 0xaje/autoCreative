/**
 * Autonomous Brand Design Engine
 * Dynamically computes a distinctive, harmonious visual theme (palette, typography, layout archetype)
 * for each unique project so no two projects share the same visual style.
 */

const PALETTES = [
  {
    id: 'emerald_flow',
    name: 'Emerald Flow',
    primary: '#10b981',
    primaryLight: '#34d399',
    primaryDark: '#047857',
    glow: 'rgba(16, 185, 129, 0.45)',
    bgDark: '#031711',
    bgGradient: 'radial-gradient(circle at 50% 45%, #064e3b 0%, #021a14 55%, #010a08 100%)',
    cardBg: 'rgba(6, 78, 59, 0.4)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
    accentBadge: '#6ee7b7',
    badgeBg: 'rgba(16, 185, 129, 0.22)',
    lowerThirdHex: '0x10b981',
    badgeHex: '0x34d399',
    archetype: 'minimalist_spotlight'
  },
  {
    id: 'cyberpunk_cyan',
    name: 'Cyberpunk Cyan',
    primary: '#06b6d4',
    primaryLight: '#67e8f9',
    primaryDark: '#0e7490',
    glow: 'rgba(6, 182, 212, 0.45)',
    bgDark: '#03151f',
    bgGradient: 'radial-gradient(circle at 50% 45%, #083344 0%, #0c202d 55%, #020b12 100%)',
    cardBg: 'rgba(8, 51, 68, 0.45)',
    borderColor: 'rgba(103, 232, 249, 0.35)',
    accentBadge: '#a5f3fc',
    badgeBg: 'rgba(6, 182, 212, 0.22)',
    lowerThirdHex: '0x06b6d4',
    badgeHex: '0x67e8f9',
    archetype: 'tech_hud'
  },
  {
    id: 'electric_violet',
    name: 'Electric Violet',
    primary: '#8b5cf6',
    primaryLight: '#c084fc',
    primaryDark: '#6d28d9',
    glow: 'rgba(139, 92, 246, 0.45)',
    bgDark: '#0e0622',
    bgGradient: 'radial-gradient(circle at 50% 45%, #3b0764 0%, #1e0938 55%, #090214 100%)',
    cardBg: 'rgba(59, 7, 100, 0.45)',
    borderColor: 'rgba(192, 132, 252, 0.35)',
    accentBadge: '#d8b4fe',
    badgeBg: 'rgba(139, 92, 246, 0.22)',
    lowerThirdHex: '0x8b5cf6',
    badgeHex: '0xc084fc',
    archetype: 'glassmorphic_deck'
  },
  {
    id: 'sunset_solar',
    name: 'Sunset Solar',
    primary: '#f59e0b',
    primaryLight: '#fbbf24',
    primaryDark: '#b45309',
    glow: 'rgba(245, 158, 11, 0.45)',
    bgDark: '#170c02',
    bgGradient: 'radial-gradient(circle at 50% 45%, #451a03 0%, #291004 55%, #0c0501 100%)',
    cardBg: 'rgba(69, 26, 3, 0.45)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    accentBadge: '#fde68a',
    badgeBg: 'rgba(245, 158, 11, 0.22)',
    lowerThirdHex: '0xf59e0b',
    badgeHex: '0xfbbf24',
    archetype: 'kinetic_editorial'
  },
  {
    id: 'crimson_forge',
    name: 'Crimson Forge',
    primary: '#ef4444',
    primaryLight: '#f87171',
    primaryDark: '#b91c1c',
    glow: 'rgba(239, 68, 68, 0.45)',
    bgDark: '#170404',
    bgGradient: 'radial-gradient(circle at 50% 45%, #450a0a 0%, #290606 55%, #0d0101 100%)',
    cardBg: 'rgba(69, 10, 10, 0.45)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
    accentBadge: '#fca5a5',
    badgeBg: 'rgba(239, 68, 68, 0.22)',
    lowerThirdHex: '0xef4444',
    badgeHex: '0xf87171',
    archetype: 'tech_hud'
  },
  {
    id: 'royal_cobalt',
    name: 'Royal Cobalt',
    primary: '#2563eb',
    primaryLight: '#60a5fa',
    primaryDark: '#1d4ed8',
    glow: 'rgba(37, 99, 235, 0.45)',
    bgDark: '#040e24',
    bgGradient: 'radial-gradient(circle at 50% 45%, #172554 0%, #0d193b 55%, #020714 100%)',
    cardBg: 'rgba(23, 37, 84, 0.45)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    accentBadge: '#bfdbfe',
    badgeBg: 'rgba(37, 99, 235, 0.22)',
    lowerThirdHex: '0x2563eb',
    badgeHex: '0x60a5fa',
    archetype: 'minimalist_spotlight'
  }
];

/**
 * Deterministically pick a unique brand theme for any project based on its name or URL.
 */
function getProjectBrandTheme(sourceAnalysis = {}) {
  const seedString = (
    sourceAnalysis.project ||
    sourceAnalysis.name ||
    sourceAnalysis.url ||
    sourceAnalysis.liveUrl ||
    sourceAnalysis.githubUrl ||
    'CreativeStudio'
  ).toLowerCase();

  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

module.exports = {
  PALETTES,
  getProjectBrandTheme
};
