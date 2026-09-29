/**
 * Section 9: Evidence Model
 */

export type EvidenceStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "UNVERIFIED"
  | "FUTURE";

export interface Evidence {
  id: string;
  claim: string;
  status: EvidenceStatus;
  source:
    | "repository"
    | "live_app"
    | "documentation"
    | "user";
  reference?: string;
  confidence: number;
  rationale?: string;
  suggestedVisual?: string;
}

export interface EvidenceReport {
  projectId: string;
  totalClaims: number;
  verifiedCount: number;
  partialCount: number;
  unverifiedCount: number;
  futureCount: number;
  claims: Evidence[];
  generatedAt: string;
}
