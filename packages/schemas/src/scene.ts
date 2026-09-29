/**
 * Section 13: Creative Director Contract
 * Section 14: Scene Contract
 * Section 15: Visual Plan
 */

export type SceneType =
  | "hook"
  | "problem"
  | "product_reveal"
  | "product_demo"
  | "feature"
  | "architecture"
  | "result"
  | "transition"
  | "cinematic"
  | "ending";

export interface VisualPlan {
  source:
    | "browser_recording"
    | "screenshot"
    | "generated_image"
    | "generated_video"
    | "motion_graphic"
    | "text";
  assetId?: string;
  instruction?: string;
  emphasis?: string[];
  recordingId?: string;
}

export interface Transition {
  type: "fade" | "slide" | "zoom" | "cut";
  durationSeconds: number;
}

export interface MusicInstruction {
  style: "cinematic" | "upbeat" | "ambient" | "none";
  intensity: number;
  entryPointSeconds?: number;
  ducking: boolean;
}

export interface CaptionInstruction {
  enabled: boolean;
  style?: "bottom_pill" | "dynamic_words" | "minimal";
  fontSize?: number;
}

export interface SubtitleWord {
  startMs: number;
  endMs: number;
  text: string;
}

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  durationSeconds: number;
  duration?: number;
  narration?: string;
  narrationText?: string;
  voiceover?: string;
  visualPlan: VisualPlan[];
  transition?: Transition;
  music?: MusicInstruction;
  captions?: CaptionInstruction;
  subtitles?: SubtitleWord[];
  audioPath?: string;
  audioDuration?: number;
  videoPath?: string;
  evidenceState?: string;
}

export interface SceneManifest {
  version: number;
  projectId?: string;
  projectTitle?: string;
  durationSeconds: number;
  duration?: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  resolution: {
    width: number;
    height: number;
  };
  scenes: Scene[];
  plannedAt?: string;
}
