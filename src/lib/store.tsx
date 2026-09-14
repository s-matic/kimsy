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
  AuditChange,
  AuditEvent,
  ConversationMessage,
  FieldValue,
  Persona,
  RegisterChangeProposal,
  ScenarioThread,
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

function auditTimestamp() {
  return new Date().toISOString();
}

function scenarioThread(scenarioId: string): ScenarioThread {
  return { scenarioId, messages: [], sources: [], pendingProposal: null };
}

function scenarioThreads(configuration: WorkspaceConfiguration) {
  return Object.fromEntries(configuration.scenarios.map((scenario) => [scenario.id, scenarioThread(scenario.id)]));
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
    scenarioThreads: Object.fromEntries(configuration.scenarios.map((scenario) => [
      scenario.id,
      assessment.scenarioThreads[scenario.id] ?? scenarioThread(scenario.id),
    ])),
  };
}


interface LegacyAssessment extends Omit<Assessment, "initialBrief" | "scenarioThreads" | "auditEvents"> {
  messages?: ConversationMessage[];
  sources?: SourceDocument[];
  pendingProposal?: RegisterChangeProposal | null;
}

interface LegacyAppState extends Omit<AppState, "version" | "assessments"> {
  version: 2;
  assessments: LegacyAssessment[];
}

export function migrateState(saved: AppState | LegacyAppState): AppState {
  if (saved.version === 3) {
    const configuration = withConfigurationDefaults(saved.configuration);
    return {
      ...saved,
      configuration,
      assessments: saved.assessments.map((assessment) => alignAssessment(assessment, configuration)),
    };
  }

  const configuration = withConfigurationDefaults(saved.configuration);
  return {
    ...saved,
    version: 3,
    configuration,
    assessments: saved.assessments.map((assessment) => {
      const threads = scenarioThreads(configuration);
      const firstScenarioId = assessment.rows.find((row) => row.applicable)?.scenarioId
        ?? assessment.rows[0]?.scenarioId;
      if (firstScenarioId && threads[firstScenarioId]) {
        threads[firstScenarioId] = {
          scenarioId: firstScenarioId,
          messages: assessment.messages ?? [],
          sources: assessment.sources ?? [],
          pendingProposal: null,
        };
      }
      assessment.pendingProposal?.changes.forEach((change) => {
        const thread = threads[change.scenarioId];
        if (!thread) return;
        threads[change.scenarioId] = {
          ...thread,
          pendingProposal: { ...assessment.pendingProposal!, changes: [change] },
        };
      });
      const migrated: Assessment = {
        id: assessment.id,
        unitId: assessment.unitId,
        period: assessment.period,
        status: assessment.status,
        rows: assessment.rows,
        initialBrief: "",
        scenarioThreads: threads,
        auditEvents: [],
        reviewComment: assessment.reviewComment,
        updatedAt: assessment.updatedAt,
      };
      return alignAssessment(migrated, configuration);
    }),
  };
}

function fieldChanges(
  before: Record<string, FieldValue>,
  after: Record<string, FieldValue>,
  configuration: WorkspaceConfiguration,
) {
  return configuration.fields.flatMap((field): AuditChange[] => {
    const previous = before[field.id] ?? null;
    const next = after[field.id] ?? null;
    return JSON.stringify(previous) === JSON.stringify(next)
      ? []
      : [{ fieldId: field.id, label: field.label, before: previous, after: next }];
  });
}

function auditEvent(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
  const createdAt = auditTimestamp();
  return { ...input, id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt };
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
    scenarioId: string;
    userText: string;
    assistantText: string;
    proposal: RegisterChangeProposal;
    sources: SourceDocument[];
  }) => void;
  applyProposal: (assessmentId: string, scenarioId: string) => void;
  discardProposal: (assessmentId: string, scenarioId: string) => void;
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
        const parsed = JSON.parse(saved) as AppState | LegacyAppState;
        // Hydration is intentionally completed before paint so saved work cannot be overwritten.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.version === 2 || parsed.version === 3) setState(migrateState(parsed));
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
      version: 3,
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
          initialBrief: initialBrief ?? "",
          scenarioThreads: scenarioThreads(current.configuration),
          auditEvents: [],
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
      assessments: current.assessments.map((assessment) => {
        if (assessment.id !== assessmentId) return assessment;
        const row = assessment.rows.find((candidate) => candidate.id === rowId);
        if (!row) return assessment;
        const nextValues = calculateValues(current.configuration, { ...row.values, [fieldId]: value });
        const changes = fieldChanges(row.values, nextValues, current.configuration);
        if (!changes.length) return assessment;
        const event = auditEvent({
          scenarioId: row.scenarioId,
          actor: current.configuration.review.assessorName || "Workspace owner",
          actorType: "HUMAN",
          source: "MANUAL",
          action: "FIELD_UPDATED",
          changes,
          citations: [],
        });
        return {
          ...assessment,
          status: assessment.status === "RETURNED" ? "DRAFT" : assessment.status,
          rows: assessment.rows.map((candidate) => candidate.id !== rowId ? candidate : {
            ...candidate,
            values: nextValues,
            lastEditedBy: "HUMAN",
            updatedAt: "Just now",
          }),
          auditEvents: [event, ...assessment.auditEvents],
          updatedAt: "Just now",
        };
      }),
    }));
  }, []);

  const updateRowRationale = useCallback((assessmentId: string, rowId: string, rationale: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => {
        if (assessment.id !== assessmentId) return assessment;
        const row = assessment.rows.find((candidate) => candidate.id === rowId);
        if (!row || row.rationale === rationale) return assessment;
        const event = auditEvent({
          scenarioId: row.scenarioId,
          actor: current.configuration.review.assessorName || "Workspace owner",
          actorType: "HUMAN",
          source: "MANUAL",
          action: "RATIONALE_UPDATED",
          changes: [{ fieldId: "rationale", label: "Assessment rationale", before: row.rationale, after: rationale }],
          citations: [],
        });
        return {
          ...assessment,
          status: assessment.status === "RETURNED" ? "DRAFT" : assessment.status,
          rows: assessment.rows.map((candidate) => candidate.id !== rowId ? candidate : { ...candidate, rationale, lastEditedBy: "HUMAN", updatedAt: "Just now" }),
          auditEvents: [event, ...assessment.auditEvents],
          updatedAt: "Just now",
        };
      }),
    }));
  }, []);

  const setRowApplicability = useCallback((assessmentId: string, rowId: string, applicable: boolean) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => {
        if (assessment.id !== assessmentId) return assessment;
        const row = assessment.rows.find((candidate) => candidate.id === rowId);
        if (!row || row.applicable === applicable) return assessment;
        const event = auditEvent({
          scenarioId: row.scenarioId,
          actor: current.configuration.review.assessorName || "Workspace owner",
          actorType: "HUMAN",
          source: "MANUAL",
          action: "APPLICABILITY_UPDATED",
          changes: [{ fieldId: "applicable", label: "Applicability", before: row.applicable, after: applicable }],
          citations: [],
        });
        return {
          ...assessment,
          status: assessment.status === "RETURNED" ? "DRAFT" : assessment.status,
          rows: assessment.rows.map((candidate) => candidate.id !== rowId ? candidate : { ...candidate, applicable, lastEditedBy: "HUMAN", updatedAt: "Just now" }),
          auditEvents: [event, ...assessment.auditEvents],
          updatedAt: "Just now",
        };
      }),
    }));
  }, []);

  const recordAiProposal = useCallback((input: {
    assessmentId: string;
    scenarioId: string;
    userText: string;
    assistantText: string;
    proposal: RegisterChangeProposal;
    sources: SourceDocument[];
  }) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id !== input.assessmentId ? assessment : {
        ...assessment,
        scenarioThreads: {
          ...assessment.scenarioThreads,
          [input.scenarioId]: (() => {
            const thread = assessment.scenarioThreads[input.scenarioId] ?? scenarioThread(input.scenarioId);
            return {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id: `message-user-${Date.now()}`,
                  role: "USER" as const,
                  text: input.userText || "Review the attached material.",
                  createdAt: `Today, ${timestamp()}`,
                  sourceNames: input.sources.map((source) => source.name),
                },
                {
                  id: `message-assistant-${Date.now() + 1}`,
                  role: "ASSISTANT" as const,
                  text: input.assistantText,
                  createdAt: `Today, ${timestamp()}`,
                },
              ],
              sources: [...thread.sources, ...input.sources.filter((source) => !thread.sources.some((item) => item.name === source.name))],
              pendingProposal: input.proposal.changes.some((change) => change.scenarioId === input.scenarioId) ? input.proposal : null,
            };
          })(),
        },
        updatedAt: "Just now",
      }),
    }));
  }, []);

  const applyProposal = useCallback((assessmentId: string, scenarioId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => {
        const thread = assessment.scenarioThreads[scenarioId];
        const proposal = thread?.pendingProposal;
        if (assessment.id !== assessmentId || !thread || !proposal) return assessment;
        const change = proposal.changes.find((candidate) => candidate.scenarioId === scenarioId);
        const row = assessment.rows.find((candidate) => candidate.scenarioId === scenarioId);
        if (!change || !row) return assessment;
        const proposedValues = Object.fromEntries(change.values.map((item) => [item.fieldId, item.value]));
        const nextValues = calculateValues(current.configuration, { ...row.values, ...proposedValues });
        const changes: AuditChange[] = [
          ...(row.applicable === change.applicable ? [] : [{ fieldId: "applicable", label: "Applicability", before: row.applicable, after: change.applicable }]),
          ...fieldChanges(row.values, nextValues, current.configuration),
          ...(row.rationale === change.rationale ? [] : [{ fieldId: "rationale", label: "Assessment rationale", before: row.rationale, after: change.rationale }]),
        ];
        const event = auditEvent({
          scenarioId,
          actor: "Kimsy",
          actorType: "AI",
          source: "AI_PROPOSAL",
          action: "PROPOSAL_APPLIED",
          changes,
          citations: change.citations,
        });
        return {
          ...assessment,
          status: assessment.status === "RETURNED" ? "DRAFT" : assessment.status,
          rows: assessment.rows.map((candidate) => candidate.scenarioId !== scenarioId ? candidate : {
              ...candidate,
              applicable: change.applicable,
              values: nextValues,
              rationale: change.rationale,
              citations: change.citations,
              lastEditedBy: "AI" as const,
              updatedAt: "Just now",
          }),
          scenarioThreads: {
            ...assessment.scenarioThreads,
            [scenarioId]: { ...thread, pendingProposal: null },
          },
          auditEvents: changes.length ? [event, ...assessment.auditEvents] : assessment.auditEvents,
          updatedAt: "Just now",
        };
      }),
    }));
  }, []);

  const discardProposal = useCallback((assessmentId: string, scenarioId: string) => {
    setState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) => assessment.id === assessmentId ? {
        ...assessment,
        scenarioThreads: {
          ...assessment.scenarioThreads,
          [scenarioId]: {
            ...(assessment.scenarioThreads[scenarioId] ?? scenarioThread(scenarioId)),
            pendingProposal: null,
          },
        },
      } : assessment),
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
