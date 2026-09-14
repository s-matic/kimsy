"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  History,
  KeyRound,
  MessageSquareText,
  PanelRight,
  Paperclip,
  RotateCcw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { displayFieldValue, FieldControl, RatingValue } from "@/components/field-control";
import { Badge, Button, EmptyState } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { consumeAssessmentAgentStream } from "@/lib/ai/assessment-ui-stream";
import { readJsonResponse } from "@/lib/http";
import { explainCalculation } from "@/lib/scoring";
import { useKimsy } from "@/lib/store";
import type {
  Assessment,
  AssessmentStatus,
  AuditEvent,
  ConversationMessage,
  FieldDefinition,
  FieldValue,
  RegisterChangeProposal,
} from "@/lib/types";

function statusBadge(status: AssessmentStatus) {
  if (status === "APPROVED" || status === "COMPLETED") return <Badge tone="success">{status === "APPROVED" ? "Approved" : "Complete"}</Badge>;
  if (status === "READY_FOR_REVIEW") return <Badge tone="warning">Ready for review</Badge>;
  if (status === "RETURNED") return <Badge tone="danger">Returned</Badge>;
  return <Badge>Draft</Badge>;
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function assessmentReady(assessment: Assessment, requiredFieldIds: string[]) {
  const applicable = assessment.rows.filter((row) => row.applicable);
  return applicable.length > 0 && applicable.every((row) => requiredFieldIds.every((fieldId) => isPresent(row.values[fieldId])));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatAuditTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function valuesEqual(left: FieldValue, right: FieldValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function PromptAttachments({ loading, message }: { loading: boolean; message: string }) {
  const attachments = usePromptInputAttachments();
  return <>
    {attachments.files.length > 0 && <PromptInputHeader className="gap-2 border-b border-[#ececf0] px-3 py-2.5">{attachments.files.map((file) => <span key={file.id} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-[#f0f1f5] px-2.5 py-1 text-[11px] font-medium text-[#656876]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{file.filename || "Attached file"}</span><button type="button" aria-label={`Remove ${file.filename || "file"}`} onClick={() => attachments.remove(file.id)} className="rounded-full p-0.5 hover:bg-white"><X className="h-3 w-3" /></button></span>)}</PromptInputHeader>}
    <PromptInputFooter className="px-3 pb-3">
      <PromptInputTools><PromptInputButton tooltip="Attach source material" onClick={() => attachments.openFileDialog()} className="rounded-lg px-2.5 text-[#6d7080]"><Paperclip className="h-4 w-4" /><span>Attach</span></PromptInputButton></PromptInputTools>
      <PromptInputSubmit status={loading ? "submitted" : "ready"} disabled={loading || (!message.trim() && attachments.files.length === 0)} className="h-9 w-9 rounded-[10px] bg-[#25262f] text-white hover:bg-[#3b3d49]" />
    </PromptInputFooter>
  </>;
}

function ChatMessage({ role, text, sourceNames, streaming = false }: Pick<ConversationMessage, "role" | "text" | "sourceNames"> & { streaming?: boolean }) {
  const from = role === "USER" ? "user" : "assistant";
  return <Message from={from} className="max-w-full">
    {from === "assistant" && <div className="flex items-center gap-2 text-[11px] font-semibold text-[#666a79]"><span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#eff1fb] text-[#586ad0]"><Sparkles className="h-3.5 w-3.5" /></span>Kimsy</div>}
    <MessageContent className={from === "assistant" ? "w-full" : "max-w-[88%] rounded-[14px] bg-[#f0f1f4] px-4 py-3"}>{streaming && !text ? <div className="flex items-center gap-2 py-2 text-sm text-[#767987]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#586ad0]" />Reviewing this scenario…</div> : <MessageResponse className="text-[13px] leading-6 text-[#3e414d]">{text}</MessageResponse>}</MessageContent>
    {sourceNames && sourceNames.length > 0 && <div className={`flex flex-wrap gap-1.5 ${from === "user" ? "justify-end" : ""}`}>{sourceNames.map((name, index) => <span key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e0e1e6] bg-white px-2.5 py-1 text-[10px] font-medium text-[#696c79]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{name}</span></span>)}</div>}
  </Message>;
}

function SuggestedValue({ field, current, proposed }: { field: FieldDefinition; current: FieldValue; proposed: FieldValue }) {
  if (valuesEqual(current, proposed)) return null;
  return <div className="mt-2 rounded-[9px] border border-[#d8dcf4] bg-[#f6f7fd] px-3 py-2" data-testid={`proposal-${field.id}`}><p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[#6673c5]">Kimsy suggests</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"><span className="text-[#858895]">{displayFieldValue(field, current)}</span><span className="text-[#b0b2bb]">→</span><span className="font-semibold text-[#3e445f]">{displayFieldValue(field, proposed)}</span></div></div>;
}

function DebouncedField({
  field,
  value,
  editable,
  onCommit,
}: {
  field: FieldDefinition;
  value: FieldValue;
  editable: boolean;
  onCommit: (value: FieldValue) => void;
}) {
  const [draft, setDraft] = useState<FieldValue>(value);
  const [committedValue, setCommittedValue] = useState<FieldValue>(value);
  const timer = useRef<number | null>(null);
  const debounced = field.type === "SHORT_TEXT" || field.type === "LONG_TEXT";

  if (!valuesEqual(committedValue, value)) {
    setCommittedValue(value);
    setDraft(value);
  }

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const commit = (next: FieldValue) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (!valuesEqual(value, next)) onCommit(next);
  };

  if (!editable) {
    return field.type === "CALCULATED"
      ? <RatingValue field={field} value={value} />
      : <p className="rounded-[9px] bg-[#f5f5f7] px-3 py-2.5 text-sm text-[#4b4e59]">{displayFieldValue(field, value)}</p>;
  }

  return <div onBlurCapture={() => debounced && commit(draft)}><FieldControl field={field} value={draft} onChange={(next) => {
    setDraft(next);
    if (!debounced) {
      onCommit(next);
      return;
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(next), 800);
  }} /></div>;
}

function DebouncedRationale({ value, editable, onCommit }: { value: string; editable: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [committedValue, setCommittedValue] = useState(value);
  const timer = useRef<number | null>(null);

  if (committedValue !== value) {
    setCommittedValue(value);
    setDraft(value);
  }

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const commit = (next: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (next !== value) onCommit(next);
  };

  if (!editable) return <p className="mt-2 rounded-[9px] bg-[#f5f5f7] px-3 py-2.5 text-sm leading-6 text-[#4b4e59]">{value || "No rationale recorded."}</p>;

  return <textarea aria-label="Assessment rationale" rows={5} value={draft} onChange={(event) => {
    const next = event.target.value;
    setDraft(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(next), 800);
  }} onBlur={() => commit(draft)} className="mt-2 w-full resize-y rounded-[9px] border border-[#dedfe5] bg-white px-3 py-2.5 text-sm leading-6 shadow-sm focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]" placeholder="Document the key facts and judgment…" />;
}

function AuditHistory({ events, fields }: { events: AuditEvent[]; fields: FieldDefinition[] }) {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  return events.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><History className="h-6 w-6 text-[#989ba7]" /><p className="mt-3 text-sm font-semibold text-[#3a3c47]">No changes recorded yet</p><p className="mt-1 text-xs leading-5 text-[#858895]">Manual edits and applied AI proposals will appear here.</p></div> : <div className="divide-y divide-[#ededf0]">{events.map((event) => <article key={event.id} className="px-5 py-4"><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${event.actorType === "AI" ? "bg-[#eff1fb] text-[#586ad0]" : "bg-[#f0f1f4] text-[#666a78]"}`}>{event.actorType === "AI" ? <Sparkles className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#383a45]">{event.action === "PROPOSAL_APPLIED" ? "AI proposal applied" : event.changes[0]?.label ?? "Scenario updated"}</p><p className="mt-1 text-[10px] text-[#8a8d99]">{event.actor} · {formatAuditTime(event.createdAt)}</p></div></div><div className="mt-3 space-y-2 pl-11">{event.changes.map((change) => {
    const field = fieldMap.get(change.fieldId);
    const display = (input: FieldValue) => field ? displayFieldValue(field, input) : change.fieldId === "applicable" ? (input ? "Applicable" : "Not applicable") : String(input || "—");
    return <div key={change.fieldId} className="rounded-[8px] bg-[#f7f7f9] px-3 py-2 text-[10px] leading-4"><p className="font-semibold text-[#5a5d68]">{change.label}</p><p className="mt-1 text-[#858895]"><span className="line-through">{display(change.before)}</span><span className="mx-1.5">→</span><span className="font-medium text-[#464954]">{display(change.after)}</span></p></div>;
  })}</div></article>)}</div>;
}

export default function ScenarioAssessmentPage() {
  const params = useParams<{ id: string; scenarioId: string }>();
  const {
    state,
    hydrated,
    updateRowValue,
    updateRowRationale,
    setRowApplicability,
    recordAiProposal,
    applyProposal,
    discardProposal,
    completeAssessment,
    submitForReview,
    reviewAssessment,
  } = useKimsy();
  const assessment = state.assessments.find((item) => item.id === params.id);
  const row = assessment?.rows.find((item) => item.scenarioId === params.scenarioId);
  const scenario = state.configuration.scenarios.find((item) => item.id === params.scenarioId);
  const thread = assessment?.scenarioThreads[params.scenarioId];
  const unit = state.configuration.units.find((item) => item.id === assessment?.unitId);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileSurface, setMobileSurface] = useState<"CONVERSATION" | "ASSESSMENT">("ASSESSMENT");
  const [streamingExchange, setStreamingExchange] = useState<{ userText: string; sourceNames: string[]; assistantText: string } | null>(null);
  const editable = Boolean(assessment && state.persona === "ASSESSOR" && (assessment.status === "DRAFT" || assessment.status === "RETURNED"));
  const requiredFields = state.configuration.fields.filter((field) => field.required && field.type !== "CALCULATED").map((field) => field.id);
  const ready = assessment ? assessmentReady(assessment, requiredFields) : false;
  const proposal = thread?.pendingProposal;
  const proposedChange = proposal?.changes.find((change) => change.scenarioId === params.scenarioId);
  const proposedValues = new Map(proposedChange?.values.map((item) => [item.fieldId, item.value]) ?? []);
  const events = assessment?.auditEvents.filter((event) => event.scenarioId === params.scenarioId) ?? [];

  const registerLinkProps = assessment ? {
    href: `/register?unit=${encodeURIComponent(assessment.unitId)}`,
  } : { href: "/register" };

  if (!hydrated) return null;
  if (!assessment || !row || !scenario || !thread) return <div className="mx-auto max-w-3xl"><div className="mb-4"><Link href="/register" className="inline-flex items-center gap-2 text-xs font-semibold text-[#666977]"><ArrowLeft className="h-3.5 w-3.5" />Risk register</Link></div><section className="rounded-[18px] border border-[#e3e4e9] bg-white"><EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="Scenario assessment not found" description="Return to the risk register and choose an available scenario." /></section></div>;

  const send = async (input: PromptInputMessage) => {
    if (!input.text.trim() && input.files.length === 0) return;
    const submittedText = input.text.trim();
    const userText = submittedText || "Please review the attached source material.";
    setLoading(true);
    setError("");
    setMessage("");
    setStreamingExchange({ userText, sourceNames: input.files.map((file) => file.filename || "Attached file"), assistantText: "" });
    try {
      const uploadedFiles = await Promise.all(input.files.map(async (file) => {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`Could not read ${file.filename || "an attached file"}.`);
        const blob = await response.blob();
        return new File([blob], file.filename || "source-file", { type: file.mediaType || blob.type });
      }));
      const scopedConfiguration = {
        ...state.configuration,
        units: unit ? [unit] : [],
        scenarios: [scenario],
      };
      const scopedAssessment = {
        id: assessment.id,
        unitId: assessment.unitId,
        period: assessment.period,
        status: assessment.status,
        initialBrief: assessment.initialBrief,
        row,
        thread,
      };
      const form = new FormData();
      form.append("message", submittedText);
      form.append("scenarioId", scenario.id);
      form.append("configuration", JSON.stringify(scopedConfiguration));
      form.append("assessment", JSON.stringify(scopedAssessment));
      uploadedFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/ai/workspace", { method: "POST", body: form });
      if (!response.ok) {
        const result = await readJsonResponse(response);
        throw new Error(String(result.error ?? "Kimsy could not assess that material."));
      }
      let receivedResult = false;
      const finalState = await consumeAssessmentAgentStream(response, (streamState) => {
        if (streamState.result) receivedResult = true;
        setStreamingExchange((current) => current ? { ...current, assistantText: streamState.text || current.assistantText } : current);
      });
      if (!receivedResult || !finalState.result) throw new Error("Kimsy’s response ended before the scenario proposal was ready.");
      const proposalResult: RegisterChangeProposal = {
        id: `proposal-${assessment.id}-${scenario.id}-${thread.messages.length}`,
        summary: finalState.result.summary,
        changes: finalState.result.changes,
        warnings: finalState.result.warnings,
        createdAt: "Just now",
      };
      recordAiProposal({
        assessmentId: assessment.id,
        scenarioId: scenario.id,
        userText: submittedText,
        assistantText: finalState.text || "I’ve prepared a change for this scenario for you to review.",
        proposal: proposalResult,
        sources: finalState.result.sources,
      });
      setStreamingExchange(null);
      setMobileSurface("ASSESSMENT");
    } catch (caught) {
      setStreamingExchange(null);
      setMessage(submittedText);
      setError(caught instanceof Error ? caught.message : "Kimsy could not assess that material.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="enter-soft">
    <section className="flex min-h-[720px] flex-col overflow-hidden rounded-[20px] border border-[#e2e3e8] bg-white shadow-[var(--shadow-panel)] lg:h-[calc(100vh-88px)] lg:min-h-[680px] lg:max-h-[980px]" aria-label={`${scenario.title} assessment workspace`}>
      <header className="flex shrink-0 flex-col gap-3 border-b border-[#ededf0] bg-[#fcfcfd] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><Link {...registerLinkProps} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#696c79] hover:text-[#586ad0]"><ArrowLeft className="h-3.5 w-3.5" />Risk register</Link><div className="mt-2 flex min-w-0 items-center gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#586ad0]">{scenario.code} · {scenario.category}</p><h1 className="mt-1 truncate text-lg font-semibold text-[#282a34]">{scenario.title}</h1><p className="mt-1 text-[10px] text-[#888b97]">{unit?.name} · {assessment.period}</p></div></div></div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs font-semibold text-[#4d505d] shadow-sm hover:bg-[#f7f7f9]"><History className="h-3.5 w-3.5" />History{events.length > 0 && <span className="rounded-full bg-[#eff1fb] px-1.5 py-0.5 text-[9px] text-[#586ad0]">{events.length}</span>}</button>{statusBadge(assessment.status)}{state.configuration.review.mode === "SOLO" && editable && <Button disabled={!ready} onClick={() => completeAssessment(assessment.id)}><CheckCircle2 className="h-4 w-4" />Mark complete</Button>}{state.configuration.review.mode === "REVIEWER" && state.persona === "ASSESSOR" && editable && <Button disabled={!ready} onClick={() => submitForReview(assessment.id)}><UserRound className="h-4 w-4" />Send to reviewer</Button>}</div>
      </header>

      {assessment.status === "RETURNED" && <div className="flex shrink-0 items-start gap-3 border-b border-[#efc0bb] bg-[#fff4f2] px-4 py-3 sm:px-5"><RotateCcw className="mt-0.5 h-4 w-4 text-[#a43a30]" /><div><p className="text-xs font-semibold text-[#912d24]">Returned by {state.configuration.review.reviewerName}</p><p className="mt-1 text-xs leading-5 text-[#79524e]">{assessment.reviewComment}</p></div></div>}

      <div className="grid shrink-0 grid-cols-2 border-b border-[#ededf0] bg-[#fcfcfd] p-1 lg:hidden" role="tablist" aria-label="Scenario workspace views"><button role="tab" aria-selected={mobileSurface === "CONVERSATION"} onClick={() => setMobileSurface("CONVERSATION")} className={`flex h-9 items-center justify-center gap-2 rounded-[9px] text-xs font-semibold ${mobileSurface === "CONVERSATION" ? "bg-white text-[#30323c] shadow-sm" : "text-[#777b88]"}`}><MessageSquareText className="h-3.5 w-3.5" />Conversation</button><button role="tab" aria-selected={mobileSurface === "ASSESSMENT"} onClick={() => setMobileSurface("ASSESSMENT")} className={`relative flex h-9 items-center justify-center gap-2 rounded-[9px] text-xs font-semibold ${mobileSurface === "ASSESSMENT" ? "bg-white text-[#30323c] shadow-sm" : "text-[#777b88]"}`}><PanelRight className="h-3.5 w-3.5" />Assessment{proposal && <span className="h-1.5 w-1.5 rounded-full bg-[#586ad0]" />}</button></div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <div data-testid="scenario-agent" className={`${mobileSurface === "CONVERSATION" ? "flex" : "hidden"} min-h-0 flex-col bg-white lg:flex lg:border-r lg:border-[#ededf0]`}>
          <div className="shrink-0 border-b border-[#ededf0] px-5 py-3.5"><p className="text-xs font-semibold text-[#30323c]">Scenario agent</p><p className="mt-1 text-[10px] leading-4 text-[#858895]">Focused only on {scenario.code}</p></div>
          <Conversation className="min-h-0 flex-1"><ConversationContent className="w-full gap-5 px-4 py-5 sm:px-5">{thread.messages.length === 0 && !streamingExchange && <ChatMessage role="ASSISTANT" text={`I’m focused on ${scenario.code}. Share what changed or attach evidence, and I’ll propose updates only for this scenario.`} />}{thread.messages.map((item) => <ChatMessage key={item.id} {...item} />)}{streamingExchange && <><ChatMessage role="USER" text={streamingExchange.userText} sourceNames={streamingExchange.sourceNames} /><ChatMessage role="ASSISTANT" text={streamingExchange.assistantText} streaming /></>}</ConversationContent><ConversationScrollButton className="bottom-3" /></Conversation>
          {thread.sources.length > 0 && <div className="shrink-0 border-t border-[#ededf0] bg-[#fcfcfd] px-4 py-2.5"><div className="flex flex-wrap gap-1.5">{thread.sources.map((source) => <span key={source.id} title={`${source.locators.length} source locators`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e0e1e6] bg-white px-2.5 py-1 text-[9px] font-medium text-[#737684]"><FileText className="h-3 w-3 shrink-0" /><span className="truncate">{source.name}</span><span className="text-[#a0a3ad]">· {formatBytes(source.size)}</span></span>)}</div></div>}
          {editable ? <div className="shrink-0 border-t border-[#ededf0] bg-[#fcfcfd] p-3"><PromptInput onSubmit={send} onError={(inputError) => setError(inputError.message)} accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/*" multiple maxFiles={8} maxFileSize={15 * 1024 * 1024} className="rounded-[16px] bg-white shadow-[0_8px_28px_rgba(35,36,45,0.08)]"><PromptInputTextarea aria-label="Message Kimsy" value={message} onChange={(event) => setMessage(event.target.value)} disabled={loading} placeholder={`Ask about ${scenario.code} or attach evidence…`} className="min-h-[72px] px-4 pt-3 text-sm leading-6" /><PromptAttachments loading={loading} message={message} /></PromptInput>{error && <p className="mt-2 flex items-start gap-2 px-1 text-xs leading-5 text-[#9d3328]">{error.includes("OPENAI_API_KEY") ? <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{error}</p>}</div> : <div className="shrink-0 border-t border-[#ededf0] bg-[#fcfcfd] px-5 py-3 text-center text-xs text-[#7b7e8c]">{state.persona === "REVIEWER" ? "Reviewer mode is read-only." : "This assessment is read-only in its current state."}</div>}
        </div>

        <aside data-testid="scenario-form" className={`${mobileSurface === "ASSESSMENT" ? "flex" : "hidden"} min-h-0 flex-col bg-[#f7f7f9] lg:flex`} aria-label="Scenario assessment form">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-[#e2e3e8] bg-white px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#858895]">Scenario context</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f626e]">{scenario.description}</p></div><div className="shrink-0">{editable ? <label className="inline-flex items-center gap-2 rounded-[9px] border border-[#dedfe5] bg-white px-3 py-2 text-xs font-semibold text-[#3d404a] shadow-sm"><input type="checkbox" checked={row.applicable} onChange={(event) => setRowApplicability(assessment.id, row.id, event.target.checked)} className="h-4 w-4 accent-[#586ad0]" />Applicable</label> : <Badge>{row.applicable ? "Applicable" : "Not applicable"}</Badge>}{proposedChange && proposedChange.applicable !== row.applicable && <div className="mt-2 rounded-[8px] border border-[#d8dcf4] bg-[#f6f7fd] px-2.5 py-2 text-[10px] text-[#606aa9]">Suggested: <strong>{proposedChange.applicable ? "Applicable" : "Not applicable"}</strong></div>}</div></div></div>

            {proposal && proposedChange && editable && <div className="border-b border-[#dfe2f3] bg-[#f5f6fc] px-5 py-4 sm:px-6" data-testid="inline-proposal"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#586ad0] shadow-sm"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#3c4057]">Review Kimsy’s proposal</p><p className="mt-1 text-[11px] leading-5 text-[#6d7184]">{proposal.summary}</p>{proposal.warnings.length > 0 && <div className="mt-2 space-y-1">{proposal.warnings.map((warning) => <p key={warning} className="flex items-start gap-1.5 text-[10px] leading-4 text-[#80662c]"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{warning}</p>)}</div>}</div><div className="flex shrink-0 gap-2"><Button variant="ghost" size="sm" onClick={() => discardProposal(assessment.id, scenario.id)}>Discard</Button><Button size="sm" onClick={() => applyProposal(assessment.id, scenario.id)}>Apply proposal<Check className="h-3.5 w-3.5" /></Button></div></div></div>}

            {state.persona === "REVIEWER" && assessment.status === "READY_FOR_REVIEW" && <div className="border-b border-[#ead5a5] bg-[#fffdf7] px-5 py-4 sm:px-6"><p className="text-xs font-semibold text-[#594b2b]">Independent review</p><p className="mt-1 text-[10px] leading-4 text-[#7c6a45]">Your decision applies to the complete assessment.</p><textarea aria-label="Review comment" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={2} className="mt-3 w-full resize-y rounded-[9px] border border-[#d8cba8] bg-white px-3 py-2 text-sm" placeholder="Document your review judgment…" /><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={!reviewComment.trim()} onClick={() => reviewAssessment(assessment.id, "RETURN", reviewComment.trim())}>Return</Button><Button size="sm" disabled={!reviewComment.trim()} onClick={() => reviewAssessment(assessment.id, "APPROVE", reviewComment.trim())}><CheckCircle2 className="h-3.5 w-3.5" />Approve</Button></div></div>}

            {row.applicable ? <div className="space-y-6 p-5 sm:p-6"><div className="grid gap-5 sm:grid-cols-2">{state.configuration.fields.map((field) => {
              const value = row.values[field.id] ?? null;
              const proposed = proposedValues.get(field.id);
              return <div key={field.id} className={field.type === "LONG_TEXT" ? "sm:col-span-2" : ""}><div className="mb-1.5 flex items-center justify-between gap-2"><label className="text-xs font-semibold text-[#3d404a]">{field.label}{field.required && field.type !== "CALCULATED" && <span className="ml-1 text-[#a45b53]">*</span>}</label>{field.type === "CALCULATED" && <span title={explainCalculation(field.id, row.values, state.configuration)} className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6673c5]">Calculated</span>}</div>{field.helpText && <p className="mb-2 text-[10px] leading-4 text-[#858895]">{field.helpText}</p>}<DebouncedField field={field} value={value} editable={editable} onCommit={(next) => updateRowValue(assessment.id, row.id, field.id, next)} />{field.type === "CALCULATED" && <p className="mt-2 text-[10px] leading-4 text-[#7a7e8b]">{explainCalculation(field.id, row.values, state.configuration)}</p>}{proposed !== undefined && <SuggestedValue field={field} current={value} proposed={proposed} />}</div>;
            })}</div><div className="border-t border-[#e2e3e8] pt-5"><label className="text-xs font-semibold text-[#3d404a]">Assessment rationale</label><DebouncedRationale value={row.rationale} editable={editable} onCommit={(next) => updateRowRationale(assessment.id, row.id, next)} />{proposedChange && proposedChange.rationale !== row.rationale && <div className="mt-2 rounded-[9px] border border-[#d8dcf4] bg-[#f6f7fd] px-3 py-2"><p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[#6673c5]">Kimsy suggests</p><p className="mt-1 text-[11px] leading-5 text-[#555a71]">{proposedChange.rationale || "No rationale"}</p></div>}{row.citations.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{row.citations.map((citation, index) => <span key={`${citation.sourceName}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-[#e0e1e6] bg-white px-2.5 py-1 text-[10px] text-[#696c79]"><FileText className="h-3 w-3" />{citation.sourceName} · {citation.locator}</span>)}</div>}</div></div> : <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-10 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eff1fb] text-[#586ad0]"><CheckCircle2 className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold text-[#343640]">Scenario marked not applicable</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#858895]">Applicability can be changed above, and the change will be recorded in this scenario’s history.</p></div>}
          </div>
        </aside>
      </div>
    </section>

    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="right-3 bottom-3 left-auto top-3 flex h-auto w-[calc(100%-1.5rem)] max-w-[430px] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[20px] bg-white p-0 sm:max-w-[430px]" showCloseButton><DialogTitle className="border-b border-[#ededf0] px-5 py-5 text-sm font-semibold">Scenario history</DialogTitle><DialogDescription className="sr-only">Audit history for {scenario.title}</DialogDescription><div className="min-h-0 flex-1 overflow-y-auto"><AuditHistory events={events} fields={state.configuration.fields} /></div></DialogContent></Dialog>
  </div>;
}
