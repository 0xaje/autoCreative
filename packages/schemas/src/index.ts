/**
 * Autonomous Creative Production Agent — Schemas Package
 */

export * from './intent';
export * from './project';
export * from './understanding';
export * from './evidence';
export * from './browser';
export * from './recording';
export * from './scene';
export * from './quality';

/**
 * Runtime validation helpers
 */
export function validateSceneManifest(manifest: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest) return { valid: false, errors: ['Manifest is undefined'] };
  if (!manifest.scenes || !Array.isArray(manifest.scenes)) errors.push('Manifest must contain scenes array');
  if (!manifest.durationSeconds && !manifest.duration) errors.push('Manifest must define duration');
  
  if (manifest.scenes) {
    manifest.scenes.forEach((s: any, idx: number) => {
      if (!s.id) errors.push(`Scene at index ${idx} missing id`);
      if (!s.type) errors.push(`Scene ${s.id || idx} missing type`);
      if (s.durationSeconds === undefined && s.duration === undefined) {
        errors.push(`Scene ${s.id || idx} missing duration`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidence(evidence: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!evidence) return { valid: false, errors: ['Evidence is undefined'] };
  if (!evidence.claim) errors.push('Evidence item missing claim');
  if (!['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'FUTURE'].includes(evidence.status)) {
    errors.push(`Invalid evidence status: ${evidence.status}`);
  }
  return { valid: errors.length === 0, errors };
}
