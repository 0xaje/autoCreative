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

module.exports = {
  PROJECT_ID_PATTERN,
  isValidProjectId,
  getSafeProjectPath,
  getSafeArtifactPath
};
