"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initialState } from "@/lib/seed";
import { completionForAnswers, isWithinAppetite } from "@/lib/risk";
import type { AssessmentDraft } from "@/lib/ai/schema";
import type { AppState, OperatingModel, RiskRating } from "@/lib/types";

const STORAGE_KEY = "kimsy-demo-state-v1";

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  setOperatingModel: (model: OperatingModel) => void;
  updateAnswer: (assessmentId: string, questionId: string, answer: string) => void;
  markDraftReady: (assessmentId: string) => void;
  applyAssessmentDraft: (assessmentId: string, draft: AssessmentDraft) => void;
  acceptScenario: (assessmentId: string, scenarioId: string, rating?: RiskRating) => void;
  resolveException: (assessmentId: string, exceptionId: string, resolution: string) => void;
  acceptEvidence: (assessmentId: string, evidenceId: string) => void;
  finalizeAssessment: (assessmentId: string) => void;
  publishDraftFramework: () => void;
  createAssessment: (input: { businessUnit: string; period: string; dueDate: string }) => string;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function newAudit(action: string, target: string, detail: string) {
  return {
    id: `audit-${Date.now()}`,
    actor: "Jordan Lee",
    action,
    target,
    detail,
    at: "Just now",
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // Hydrate before paint so a saved workspace cannot overwrite a user's first action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setState(JSON.parse(saved) as AppState);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setOperatingModel = useCallback((model: OperatingModel) => {
    setState((current) => ({
      ...current,
      organization: {
        ...current.organization,
        operatingModel: model,
        updatedAt: "Just now",
      },
      auditEvents: [
        newAudit(
          "Changed operating model",
          current.organization.name,
          model === "FIRST_LINE_LED"
            ? "New assessments will be first-line-led. Existing cycles retain their original model."
            : "New assessments will be compliance-led. Existing cycles retain their original model.",
        ),
        ...current.auditEvents,
      ],
    }));
  }, []);

  const updateAnswer = useCallback(
    (assessmentId: string, questionId: string, answer: string) => {
      setState((current) => ({
        ...current,
        assessments: current.assessments.map((assessment) => {
          if (assessment.id !== assessmentId) return assessment;
          const questions = assessment.questions.map((question) =>
            question.id === questionId ? { ...question, answer } : question,
          );
          return {
            ...assessment,
            questions,
            completion: completionForAnswers(questions),
            lastUpdated: "Just now",
          };
        }),
      }));
    },
    [],
  );

  const markDraftReady = useCallback((assessmentId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === assessmentId
          ? { ...assessment, status: "AI_DRAFT_READY", lastUpdated: "Just now" }
          : assessment,
      ),
      auditEvents: [
        newAudit("Generated assessment draft", assessmentId, "Structured AI proposals were added for human review."),
        ...current.auditEvents,
      ],
    }));
  }, []);

  const applyAssessmentDraft = useCallback((assessmentId: string, draft: AssessmentDraft) => {
    setState((current) => {
      const assessment = current.assessments.find((item) => item.id === assessmentId);
      const framework = current.frameworkVersions.find(
        (item) => item.version === assessment?.frameworkVersion,
      );
      if (!assessment || !framework) return current;

      const scenarioAssessments = draft.proposals.map((proposal, index) => {
        const risk = framework.scenarios.find((item) => item.id === proposal.scenarioId);
        return {
          id: `sa-${assessmentId}-${index}`,
          scenarioId: proposal.scenarioId,
          relevant: proposal.relevant,
          proposedRating: proposal.proposedRating,
          rationale: proposal.rationale,
          confidence: proposal.confidence,
          controlEffectiveness: proposal.controlEffectiveness,
          withinAppetite: risk
            ? isWithinAppetite(proposal.proposedRating, risk.appetite)
            : false,
          citations: proposal.citations,
          accepted: false,
          changedFromPrior: draft.materialChanges.length > 0,
        };
      });

      const exceptions = draft.proposals.flatMap((proposal, index) => {
        if (!proposal.relevant) return [];
        const scenario = scenarioAssessments[index];
        const risk = framework.scenarios.find((item) => item.id === proposal.scenarioId);
        const generated = [];
        if (!scenario.withinAppetite) {
          generated.push({
            id: `ex-${assessmentId}-${index}-appetite`,
            scenarioAssessmentId: scenario.id,
            kind: "APPETITE_BREACH" as const,
            title: `${risk?.code ?? "Scenario"} exceeds appetite`,
            detail: `The proposed ${proposal.proposedRating} rating exceeds the configured ${risk?.appetite ?? "unknown"} appetite.`,
            severity: "Critical" as const,
            status: "OPEN" as const,
          });
        }
        if (proposal.evidenceGaps.length) {
          generated.push({
            id: `ex-${assessmentId}-${index}-evidence`,
            scenarioAssessmentId: scenario.id,
            kind: "MISSING_EVIDENCE" as const,
            title: "Supporting evidence required",
            detail: proposal.evidenceGaps.join("; "),
            severity: "High" as const,
            status: "OPEN" as const,
          });
        }
        if (proposal.confidence < 70) {
          generated.push({
            id: `ex-${assessmentId}-${index}-confidence`,
            scenarioAssessmentId: scenario.id,
            kind: "LOW_CONFIDENCE" as const,
            title: "Rating needs expert judgment",
            detail: `The AI proposal has ${proposal.confidence}% confidence and requires explicit challenge.`,
            severity: "Medium" as const,
            status: "OPEN" as const,
          });
        }
        return generated;
      });

      return {
        ...current,
        assessments: current.assessments.map((item) =>
          item.id === assessmentId
            ? {
                ...item,
                status: "AI_DRAFT_READY",
                scenarioAssessments,
                exceptions,
                lastUpdated: "Just now",
              }
            : item,
        ),
        auditEvents: [
          newAudit(
            "Generated assessment draft",
            assessment.reference,
            `${scenarioAssessments.length} customer framework scenarios were evaluated; all outputs remain pending human acceptance.`,
          ),
          ...current.auditEvents,
        ],
      };
    });
  }, []);

  const acceptScenario = useCallback(
    (assessmentId: string, scenarioId: string, rating?: RiskRating) => {
      setState((current) => ({
        ...current,
        assessments: current.assessments.map((assessment) =>
          assessment.id === assessmentId
            ? {
                ...assessment,
                status: "IN_REVIEW",
                scenarioAssessments: assessment.scenarioAssessments.map((scenario) =>
                  scenario.id === scenarioId
                    ? { ...scenario, accepted: true, acceptedRating: rating ?? scenario.proposedRating }
                    : scenario,
                ),
              }
            : assessment,
        ),
        auditEvents: [
          newAudit("Accepted scenario proposal", assessmentId, "The AI proposal was explicitly accepted by a compliance officer."),
          ...current.auditEvents,
        ],
      }));
    },
    [],
  );

  const resolveException = useCallback(
    (assessmentId: string, exceptionId: string, resolution: string) => {
      setState((current) => ({
        ...current,
        assessments: current.assessments.map((assessment) =>
          assessment.id === assessmentId
            ? {
                ...assessment,
                exceptions: assessment.exceptions.map((item) =>
                  item.id === exceptionId ? { ...item, status: "RESOLVED", resolution } : item,
                ),
              }
            : assessment,
        ),
        auditEvents: [
          newAudit("Resolved review exception", exceptionId, resolution),
          ...current.auditEvents,
        ],
      }));
    },
    [],
  );

  const acceptEvidence = useCallback((assessmentId: string, evidenceId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === assessmentId
          ? {
              ...assessment,
              evidence: assessment.evidence.map((evidence) =>
                evidence.id === evidenceId ? { ...evidence, status: "ACCEPTED" } : evidence,
              ),
            }
          : assessment,
      ),
      auditEvents: [
        newAudit("Accepted evidence", evidenceId, "Evidence was reviewed and accepted."),
        ...current.auditEvents,
      ],
    }));
  }, []);

  const finalizeAssessment = useCallback((assessmentId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === assessmentId
          ? {
              ...assessment,
              status: "FINALIZED",
              completion: 100,
              finalizedAt: "10 Aug 2026",
              lastUpdated: "Just now",
            }
          : assessment,
      ),
      auditEvents: [
        newAudit(
          "Finalized assessment",
          assessmentId,
          "The assessment was locked and a management report snapshot became available.",
        ),
        ...current.auditEvents,
      ],
    }));
  }, []);

  const publishDraftFramework = useCallback(() => {
    setState((current) => ({
      ...current,
      frameworkVersions: current.frameworkVersions.map((framework) =>
        framework.status === "DRAFT"
          ? { ...framework, status: "PUBLISHED", version: "4.3", publishedAt: "10 Aug 2026" }
          : framework,
      ),
      auditEvents: [
        newAudit("Published framework", "Framework v4.3", "Validated framework content was published as an immutable version."),
        ...current.auditEvents,
      ],
    }));
  }, []);

  const createAssessment = useCallback(
    (input: { businessUnit: string; period: string; dueDate: string }) => {
      const id = `asm-${Date.now()}`;
      setState((current) => {
        const template = current.assessments[0].questions.map((question) => ({ ...question, answer: "" }));
        const model = current.organization.operatingModel;
        return {
          ...current,
          assessments: [
            {
              id,
              reference: `CRA-2026-${String(current.assessments.length + 16).padStart(3, "0")}`,
              businessUnit: input.businessUnit,
              period: input.period,
              dueDate: input.dueDate,
              owner: model === "FIRST_LINE_LED" ? "Unassigned" : "Jordan Lee",
              operatingModelSnapshot: model,
              frameworkVersion:
                current.frameworkVersions.find((framework) => framework.status === "PUBLISHED")?.version ?? "4.2",
              status: "FACT_GATHERING",
              completion: 0,
              questions: template,
              scenarioAssessments: [],
              evidence: [],
              exceptions: [],
              lastUpdated: "Just now",
            },
            ...current.assessments,
          ],
          auditEvents: [
            newAudit(
              "Created assessment cycle",
              input.businessUnit,
              `The ${model === "FIRST_LINE_LED" ? "first-line-led" : "compliance-led"} operating model was snapshotted onto the cycle.`,
            ),
            ...current.auditEvents,
          ],
        };
      });
      return id;
    },
    [],
  );

  const resetDemo = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      setOperatingModel,
      updateAnswer,
      markDraftReady,
      applyAssessmentDraft,
      acceptScenario,
      resolveException,
      acceptEvidence,
      finalizeAssessment,
      publishDraftFramework,
      createAssessment,
      resetDemo,
    }),
    [
      state,
      hydrated,
      setOperatingModel,
      updateAnswer,
      markDraftReady,
      applyAssessmentDraft,
      acceptScenario,
      resolveException,
      acceptEvidence,
      finalizeAssessment,
      publishDraftFramework,
      createAssessment,
      resetDemo,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useKimsy() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useKimsy must be used inside StoreProvider");
  return context;
}
