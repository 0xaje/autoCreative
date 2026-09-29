/**
 * Section 6: Project Schema & Section 7: Project State Machine
 */

import { CreativeIntent } from './intent';

export type ProjectStatus =
  | "CREATED"
  | "ANALYZING"
  | "UNDERSTOOD"
  | "PLANNING"
  | "EXPLORING"
  | "RECORDING"
  | "GENERATING"
  | "COMPOSING"
  | "RENDERING"
  | "QUALITY_CHECK"
  | "COMPLETED"
  | "FAILED";

export interface Project {
  id: string;
  name: string;
  githubUrl?: string;
  liveUrl?: string;
  localPath?: string;
  request: string;
  intent?: CreativeIntent;
  status: ProjectStatus;
  progressPercent?: number;
  currentStage?: ProjectStatus;
  errorCode?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  artifacts?: Record<string, string>;
  finalVideo?: {
    path: string;
    duration: number;
    width: number;
    height: number;
    sizeBytes: number;
  };
}
