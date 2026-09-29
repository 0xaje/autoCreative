/**
 * Section 20: Quality Controller
 * Section 21: Regeneration Model
 */

export interface QualityIssue {
  severity: "critical" | "warning" | "info";
  sceneId?: string;
  category: "technical" | "visual" | "narrative" | "product_accuracy";
  message: string;
}

export interface RegenerationRequest {
  sceneId: string;
  reason: string;
  action:
    | "re_record"
    | "rewrite_narration"
    | "replace_asset"
    | "change_timing"
    | "rerender";
  userRequest?: string;
}

export interface QualityReport {
  passed: boolean;
  score?: number;
  qualityScore?: number;
  verdict?: "PASS" | "NEEDS_REVISION" | "FAIL";
  videoPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  audioCodec?: string;
  issues: QualityIssue[];
  regenerationRequests: RegenerationRequest[];
  checkedAt?: string;
}
