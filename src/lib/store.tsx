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
import { calculateValues } from "@/lib/scoring";
import { emptyState, sampleState } from "@/lib/seed";
import type {
  AppState,
  Assessment,
  FieldValue,
  Persona,
  RegisterChangeProposal,
  SourceDocument,
  WorkspaceConfiguration,
} from "@/lib/types";

const STORAGE_KEY = "kimsy-workspace-v2";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withConfigurationDefaults(configuration: WorkspaceConfiguration) {
  return {
    ...configuration,
    agent: configuration.agent ?? { allowedWebSources: [] },
  };
}

function timestamp() {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function blankRows(configuration: WorkspaceConfiguration, assessmentId: string) {
  return configuration.scenarios.map((scenario) => ({
    id: `row-${assessmentId}-${scenario.id}`,
    scenarioId: scenario.id,
    applicable: true,
    values: calculateValues(configuration, {}),
    rationale: "",
    citations: [],
    lastEditedBy: "HUMAN" as const,
    updatedAt: "Just now",
  }));
}

function alignAssessment(assessment: Assessment, configuration: WorkspaceConfiguration): Assessment {
  const existing = new Map(assessment.rows.map((row) => [row.scenarioId, row]));
  return {
    ...assessment,
    rows: configuration.scenarios.map((scenario) => {
      const row = existing.get(scenario.id);
      if (row) return { ...row, values: calculateValues(configuration, row.values) };
      return blankRows({ ...configuration, scenarios: [scenario] }, assessment.id)[0];
    }),
  };
}

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  completeOnboarding: (configuration: WorkspaceConfiguration) => void;
  updateConfiguration: (configuration: WorkspaceConfiguration) => void;
  loadSample: () => void;
  resetWorkspace: () => void;
  createAssessment: (unitId: string, period: string, initialBrief?: string) => string;
  updateRowValue: (assessmentId: string, rowId: string, fieldId: string, value: FieldValue) => void;
  updateRowRationale: (assessmentId: string, rowId: string, rationale: string) => void;
  setRowApplicability: (assessmentId: string, rowId: string, applicable: boolean) => void;
  recordAiProposal: (input: {
    assessmentId: string;
    userText: string;
    assistantText: string;
    proposal: RegisterChangeProposal;
    sources: SourceDocument[];
  }) => void;
  applyProposal: (assessmentId: string, scenarioIds: string[]) => void;
  discardProposal: (assessmentId: string) => void;
  completeAssessment: (assessmentId: string) => void;
  submitForReview: (assessmentId: string) => void;
  reviewAssessment: (assessmentId: string, decision: "APPROVE" | "RETURN", comment: string) => void;
  setPersona: (persona: Persona) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState;
        // Hydration is intentionally completed before paint so saved work cannot be overwritten.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.version === 2) setState({ ...parsed, configuration: withConfigurationDefaults(parsed.configuration) });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const completeOnboarding = useCallback((configuration: WorkspaceConfiguration) => {
    setState({
      version: 2,
      onboarded: true,
      configuration: clone(configuration),
      assessments: [],
      persona: "ASSESSOR",
    });
  }, []);

  const updateConfiguration = useCallback((configuration: WorkspaceConfiguration) => {
    setState((current) => ({
      ...current,
      configuration: clone(configuration),
      assessments: current.assessments.map((assessment) => alignAssessment(assessment, configuration)),
    }));
  }, []);

  const loadSample = useCallback(() => setState(clone(sampleState)), []);
  const resetWorkspace = useCallback(() => setState(clone(emptyState)), []);

  const createAssessment = useCallback((unitId: string, period: string, initialBrief?: string) => {
    const id = `assessment-${Date.now()}`;
    setState((current) => ({
      ...current,
      assessments: [
        {
          id,
          unitId,
          period,
          status: "DRAFT",
          rows: blankRows(current.configuration, id),
          messages: [
            ...(initialBrief ? [{
              id: `message-brief-${Date.now()}`,
              role: "USER" as const,
              text: initialBrief,
              createdAt: `Today, ${timestamp()}`,
            }] : []),
            {
              id: `message-${Date.now()}`,
              role: "ASSISTANT",
              text: initialBrief
                ? "I’ve carried your initial brief into this assessment. Add any source material or context, and I’ll propose register updates for you to review."
                : "Tell me what changed, paste your notes, or attach the material you want me to assess. I’ll propose register updates for you to review.",
              createdAt: `Today, ${timestamp()}`,
            },
          ],
          sources: [],
          pendingProposal: null,
          reviewComment: "",
          updatedAt: "Just now",
        },
        ...current.assessments,
      ],
    }));
    return id;
  }, []);

  const updateRowValue = useCallback((assessmentId: string, rowId: string, fieldId: string, value: FieldValue) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id !== assessmentId ? assessment : {
        ...assessment,
        status: assessment.status === "RETURNED" ? "DRAFT" : assessment.status,
        rows: assessment.rows.map((row) => row.id !== rowId ? row : {
          ...row,
          values: calculateValues(current.configuration, { ...row.values, [fieldId]: value }),
          lastEditedBy: "HUMAN",
          updatedAt: "Just now",
        }),
        updatedAt: "Just now",
      }),
    }));
  }, []);

  const updateRowRationale = useCallback((assessmentId: string, rowId: string, rationale: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id !== assessmentId ? assessment : {
        ...assessment,
        rows: assessment.rows.map((row) => row.id !== rowId ? row : { ...row, rationale, lastEditedBy: "HUMAN", updatedAt: "Just now" }),
        updatedAt: "Just now",
      }),
    }));
  }, []);

  const setRowApplicability = useCallback((assessmentId: string, rowId: string, applicable: boolean) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id !== assessmentId ? assessment : {
        ...assessment,
        rows: assessment.rows.map((row) => row.id !== rowId ? row : { ...row, applicable, lastEditedBy: "HUMAN", updatedAt: "Just now" }),
        updatedAt: "Just now",
      }),
    }));
  }, []);

  const recordAiProposal = useCallback((input: {
    assessmentId: string;
    userText: string;
    assistantText: string;
    proposal: RegisterChangeProposal;
    sources: SourceDocument[];
  }) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id !== input.assessmentId ? assessment : {
        ...assessment,
        messages: [
          ...assessment.messages,
          {
            id: `message-user-${Date.now()}`,
            role: "USER",
            text: input.userText || "Review the attached material.",
            createdAt: `Today, ${timestamp()}`,
            sourceNames: input.sources.map((source) => source.name),
          },
          {
            id: `message-assistant-${Date.now() + 1}`,
            role: "ASSISTANT",
            text: input.assistantText,
            createdAt: `Today, ${timestamp()}`,
          },
        ],
        sources: [...assessment.sources, ...input.sources.filter((source) => !assessment.sources.some((item) => item.name === source.name))],
        pendingProposal: input.proposal,
        updatedAt: "Just now",
      }),
    }));
  }, []);

  const applyProposal = useCallback((assessmentId: string, scenarioIds: string[]) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => {
        if (assessment.id !== assessmentId || !assessment.pendingProposal) return assessment;
        const selected = new Set(scenarioIds);
        const changes = new Map(assessment.pendingProposal.changes.map((change) => [change.scenarioId, change]));
        return {
          ...assessment,
          rows: assessment.rows.map((row) => {
            const change = changes.get(row.scenarioId);
            if (!change || !selected.has(row.scenarioId)) return row;
            const proposedValues = Object.fromEntries(change.values.map((item) => [item.fieldId, item.value]));
            return {
              ...row,
              applicable: change.applicable,
              values: calculateValues(current.configuration, { ...row.values, ...proposedValues }),
              rationale: change.rationale,
              citations: change.citations,
              lastEditedBy: "AI" as const,
              updatedAt: "Just now",
            };
          }),
          pendingProposal: null,
          updatedAt: "Just now",
        };
      }),
    }));
  }, []);

  const discardProposal = useCallback((assessmentId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id === assessmentId ? { ...assessment, pendingProposal: null } : assessment),
    }));
  }, []);

  const completeAssessment = useCallback((assessmentId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id === assessmentId ? { ...assessment, status: "COMPLETED", updatedAt: "Just now" } : assessment),
    }));
  }, []);

  const submitForReview = useCallback((assessmentId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id === assessmentId ? { ...assessment, status: "READY_FOR_REVIEW", reviewComment: "", updatedAt: "Just now" } : assessment),
    }));
  }, []);

  const reviewAssessment = useCallback((assessmentId: string, decision: "APPROVE" | "RETURN", comment: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id === assessmentId ? {
        ...assessment,
        status: decision === "APPROVE" ? "APPROVED" : "RETURNED",
        reviewComment: comment,
        updatedAt: "Just now",
      } : assessment),
    }));
  }, []);

  const setPersona = useCallback((persona: Persona) => setState((current) => ({ ...current, persona })), []);

  const value = useMemo<StoreValue>(() => ({
    state,
    hydrated,
    completeOnboarding,
    updateConfiguration,
    loadSample,
    resetWorkspace,
    createAssessment,
    updateRowValue,
    updateRowRationale,
    setRowApplicability,
    recordAiProposal,
    applyProposal,
    discardProposal,
    completeAssessment,
    submitForReview,
    reviewAssessment,
    setPersona,
  }), [
    state,
    hydrated,
    completeOnboarding,
    updateConfiguration,
    loadSample,
    resetWorkspace,
    createAssessment,
    updateRowValue,
    updateRowRationale,
    setRowApplicability,
    recordAiProposal,
    applyProposal,
    discardProposal,
    completeAssessment,
    submitForReview,
    reviewAssessment,
    setPersona,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useKimsy() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useKimsy must be used inside StoreProvider");
  return value;
}
