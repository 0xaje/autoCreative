/**
 * Section 12: Recording Model
 */

import { BrowserAction } from './browser';

export interface Recording {
  id: string;
  sceneId: string;
  sourceUrl: string;
  filePath: string;
  durationSeconds: number;
  viewport: {
    width: number;
    height: number;
  };
  actions: BrowserAction[];
  success: boolean;
  fileSizeBytes?: number;
  recordedAt?: string;
}
