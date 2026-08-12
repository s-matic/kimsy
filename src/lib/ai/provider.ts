import type { AssessmentDraft, AssessmentRequest } from "@/lib/ai/schema";

export interface AiRunMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
  fallback: boolean;
}

export interface AiProviderResult {
  draft: AssessmentDraft;
  metadata: AiRunMetadata;
}

export interface AiProvider {
  buildAssessment(input: AssessmentRequest): Promise<AiProviderResult>;
}
