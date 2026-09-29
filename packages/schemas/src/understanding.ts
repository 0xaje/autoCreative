/**
 * Section 8: Source Analyzer & Project Understanding
 */

import { Evidence } from './evidence';

export interface Feature {
  id: string;
  name: string;
  description: string;
  category?: string;
  verified?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  targetSelector?: string;
  action?: string;
  steps?: string[];
}

export interface Integration {
  name: string;
  type: string;
  detectedSource?: string;
}

export interface Route {
  path: string;
  method?: string;
  description?: string;
}

export interface ProjectUnderstanding {
  project?: string;
  summary: string;
  problem: string;
  solution: string;
  features: Feature[];
  workflows: Workflow[];
  technologies: string[];
  integrations: Integration[];
  routes: Route[];
  evidence: Evidence[];
  targetUser?: string;
  analyzedAt: string;
}
