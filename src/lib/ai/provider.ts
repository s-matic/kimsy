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
  conversation: string;
  configuration: WorkspaceConfiguration;
  sources: AiSourceInput;
}

export interface AssessInput {
  message: string;
  configuration: WorkspaceConfiguration;
  assessment: Assessment;
  sources: AiSourceInput;
}

export type ConfigureStreamEvent =
  | { type: "assistant-delta"; delta: string }
  | { type: "result"; result: OnboardingAiOutput };

export interface ConfigureStreamOptions {
  signal?: AbortSignal;
}

export interface WorkspaceAiProvider {
  configure(input: ConfigureInput): Promise<OnboardingAiOutput>;
  configureStream(input: ConfigureInput, options?: ConfigureStreamOptions): AsyncIterable<ConfigureStreamEvent>;
  assess(input: AssessInput): Promise<AssessmentAiOutput>;
}
