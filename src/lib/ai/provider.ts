import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { Assessment, WorkspaceConfiguration } from "@/lib/types";
import type { AssessmentAiOutput, OnboardingAiOutput } from "@/lib/ai/schema";

export interface AiSourceInput {
  text: string;
  images: ResponseInputContent[];
}

export interface ConfigureInput {
  stage: "ORGANIZATION" | "WORKFLOW" | "SCENARIOS" | "DESIGN";
  message: string;
  configuration: WorkspaceConfiguration;
  sources: AiSourceInput;
}

export interface AssessInput {
  message: string;
  configuration: WorkspaceConfiguration;
  assessment: Assessment;
  sources: AiSourceInput;
}

export interface WorkspaceAiProvider {
  configure(input: ConfigureInput): Promise<OnboardingAiOutput>;
  assess(input: AssessInput): Promise<AssessmentAiOutput>;
}
