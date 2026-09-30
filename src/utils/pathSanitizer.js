const fs = require('fs');
const path = require('path');
const config = require('../config');

// Strict project ID pattern: allowed prefixes proj_, cli_, or test_ followed by safe alphanumeric/underscore/hyphen
const PROJECT_ID_PATTERN = /^(proj|cli|test)_[A-Za-z0-9_-]+$/;

/**
 * Validates that a project ID matches the strict safe format
 * Disallows path traversal characters (., /, \) or special symbols
 * @param {string} projectId 
 * @returns {boolean}
 */
function isValidProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return false;
  return PROJECT_ID_PATTERN.test(projectId.trim());
}

/**
 * Returns a safely resolved absolute project path within PROJECTS_DIR,
 * or null if invalid or traversal detected.
 * @param {string} projectId 
 * @param {string} [baseDir] 
 * @returns {string|null}
 */
function getSafeProjectPath(projectId, baseDir = config.PROJECTS_DIR) {
  if (!isValidProjectId(projectId)) {
    return null;
  }
  const cleanId = projectId.trim();
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, cleanId);

  // Path traversal check: must stay strictly inside resolvedBase
  if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
    return null;
  }

  return resolvedPath;
}

/**
 * Returns a safely resolved absolute artifact path within a project,
 * or null if invalid or traversal detected.
 * @param {string} projectId 
 * @param {string} artifactName 
 * @param {string} [baseDir] 
 * @returns {string|null}
 */
function getSafeArtifactPath(projectId, artifactName, baseDir = config.PROJECTS_DIR) {
  const projectDir = getSafeProjectPath(projectId, baseDir);
  if (!projectDir || !artifactName || typeof artifactName !== 'string') {
    return null;
  }

  const safeName = path.basename(artifactName.trim());
  if (!safeName || safeName === '.' || safeName === '..') {
    return null;
  }

  const resolvedArtifact = path.resolve(projectDir, safeName);
  if (!resolvedArtifact.startsWith(projectDir + path.sep)) {
    return null;
  }

  return resolvedArtifact;
}

/**
 * Checks whether an IP string is a private, loopback, or link-local address
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const cleanIp = ip.replace(/^\[|\]$/g, '').trim();

  // IPv6 checks
  if (cleanIp === '::1' || cleanIp === '::') return true;
  if (/^fe[89ab][0-9a-f]:/i.test(cleanIp)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp)) return true; // fc00::/7 unique local

  // IPv4 mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const ipv4Mapped = cleanIp.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const targetIpv4 = ipv4Mapped ? ipv4Mapped[1] : cleanIp;

  // Decimal / Hex integer IPv4 representations (e.g. 2130706433 or 0x7f000001)
  if (/^\d+$/.test(targetIpv4)) {
    const num = parseInt(targetIpv4, 10);
    const o1 = (num >>> 24) & 255;
    const o2 = (num >>> 16) & 255;
    if (o1 === 127 || o1 === 10 || o1 === 0 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168) || (o1 === 169 && o2 === 254)) {
      return true;
    }
  }
  if (/^0x[0-9a-f]+$/i.test(targetIpv4)) {
    const num = parseInt(targetIpv4, 16);
    const o1 = (num >>> 24) & 255;
    const o2 = (num >>> 16) & 255;
    if (o1 === 127 || o1 === 10 || o1 === 0 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168) || (o1 === 169 && o2 === 254)) {
      return true;
    }
  }

  const parts = targetIpv4.split('.');
  if (parts.length === 4) {
    const nums = parts.map(p => parseInt(p, 10));
    if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = nums;
    if (a === 0 || a === 127) return true; // 0.0.0.0/8, 127.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (metadata)
  }

  return false;
}

/**
 * Validates a liveUrl to guard against SSRF
 * @param {string} urlStr
 * @param {object} [options]
 * @returns {{ valid: boolean, error?: string, parsedUrl?: URL }}
 */
function validateLiveUrl(urlStr, { allowInternal = false } = {}) {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'liveUrl must be a non-empty string' };
  }

  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Invalid URL protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (!allowInternal) {
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return { valid: false, error: 'Requests to localhost or local domain names are not permitted.' };
    }
    if (hostname === 'metadata.google.internal' || hostname === 'instance-data') {
      return { valid: false, error: 'Requests to cloud metadata endpoints are strictly forbidden.' };
    }
    if (isPrivateIp(hostname)) {
      return { valid: false, error: 'Requests to private, loopback, or link-local IP addresses are forbidden.' };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Validates a githubUrl
 * @param {string} urlStr
 * @returns {{ valid: boolean, error?: string, parsedUrl?: URL }}
 */
function validateGithubUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'githubUrl must be a non-empty string' };
  }
  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch (e) {
    return { valid: false, error: 'Invalid GitHub URL format' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'GitHub URL must use HTTP or HTTPS protocol' };
  }
  return { valid: true, parsedUrl: parsed };
}

/**
 * Validates and resolves localPath against an allow-list of base directories
 * @param {string} localPath
 * @param {string[]} [allowedRoots]
 * @returns {{ valid: boolean, error?: string, resolvedPath?: string }}
 */
function validateLocalPath(localPath, allowedRoots = [config.DEMO_APPS_DIR, config.PROJECTS_DIR, process.cwd()]) {
  if (!localPath || typeof localPath !== 'string') {
    return { valid: false, error: 'localPath must be a non-empty string' };
  }

  const resolved = path.resolve(localPath.trim());
  const isAllowed = allowedRoots.some(root => {
    const absRoot = path.resolve(root);
    return resolved === absRoot || resolved.startsWith(absRoot + path.sep);
  });

  if (!isAllowed) {
    return { valid: false, error: 'localPath is outside the allow-listed project directories' };
  }

  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `localPath does not exist: ${localPath}` };
  }

  return { valid: true, resolvedPath: resolved };
}

module.exports = {
  PROJECT_ID_PATTERN,
  isValidProjectId,
  getSafeProjectPath,
  getSafeArtifactPath,
  isPrivateIp,
  validateLiveUrl,
  validateGithubUrl,
  validateLocalPath
};

