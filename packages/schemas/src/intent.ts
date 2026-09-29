/**
 * Section 5: Intent Schema
 */

export type ContentType =
  | "product_demo"
  | "product_presentation"
  | "launch"
  | "tutorial"
  | "explainer"
  | "social_short";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface CreativeIntent {
  contentType: ContentType;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  audience: string;
  tone: string;
  showRealProduct: boolean;
  voiceover: boolean;
  captions: boolean;
  music: boolean;
  creativeFreedom: number;
  additionalInstructions: string[];
  voicePreference?: string;
  voiceId?: string;
}
