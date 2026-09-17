"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  FileCheck2,
  History,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Badge, Button, EmptyState, Progress } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { consumeCompliancePlanAgentStream } from "@/lib/ai/compliance-plan-ui-stream";
import { planProgress } from "@/lib/compliance-plan";
import { readJsonResponse } from "@/lib/http";
import { useKimsy } from "@/lib/store";
import type {
  ComplianceActivityOccurrence,
  ComplianceActivityPriority,
  ComplianceActivityType,
  CompliancePlan,
  CompliancePlanActivity,
  CompliancePlanChangeProposal,
  ComplianceRiskSnapshot,
  ConversationMessage,
} from "@/lib/types";

const activityTypeLabels: Record<ComplianceActivityType, string> = {
  MONITORING: "Monitoring & testing",
  POLICY_REVIEW: "Policy review",
  TRAINING: "Training",
  ADVISORY: "Advisory",
  REPORTING: "Reporting",
};

function formatDate(value: string, style: "short" | "long" = "long") {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", style === "short" ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function monthLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function statusLabel(status: ComplianceActivityOccurrence["status"]) {
  return status.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function occurrenceTone(status: ComplianceActivityOccurrence["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS") return "info";
  if (status === "DEFERRED") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function priorityTone(priority: ComplianceActivityPriority): "neutral" | "warning" | "danger" {
  if (priority === "HIGH") return "danger";
  if (priority === "MEDIUM") return "warning";
  return "neutral";
}

function PromptAttachments({ loading, message }: { loading: boolean; message: string }) {
  const attachments = usePromptInputAttachments();
  return <>
    {attachments.files.length > 0 && <PromptInputHeader className="gap-2 border-b border-[#ececf0] px-3 py-2.5">{attachments.files.map((file) => <span key={file.id} className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-[#f0f1f5] px-2.5 py-1 text-[10px] font-medium text-[#656876]"><Paperclip className="h-3 w-3" /><span className="truncate">{file.filename || "Attached file"}</span><button type="button" aria-label={`Remove ${file.filename || "file"}`} onClick={() => attachments.remove(file.id)}><X className="h-3 w-3" /></button></span>)}</PromptInputHeader>}
    <PromptInputFooter className="px-3 pb-3"><PromptInputTools><PromptInputButton tooltip="Attach planning material" onClick={() => attachments.openFileDialog()} className="rounded-lg px-2.5 text-[#6d7080]"><Paperclip className="h-4 w-4" /><span>Attach</span></PromptInputButton></PromptInputTools><PromptInputSubmit status={loading ? "submitted" : "ready"} disabled={loading || (!message.trim() && attachments.files.length === 0)} className="h-9 w-9 rounded-[10px] bg-[#25262f] text-white" /></PromptInputFooter>
  </>;
}

function ChatMessage({ role, text, sourceNames, streaming = false }: Pick<ConversationMessage, "role" | "text" | "sourceNames"> & { streaming?: boolean }) {
  const from = role === "USER" ? "user" : "assistant";
  return <Message from={from} className="max-w-full">
    {from === "assistant" && <div className="flex items-center gap-2 text-[11px] font-semibold text-[#666a79]"><span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#eff1fb] text-[#586ad0]"><Sparkles className="h-3.5 w-3.5" /></span>Kimsy</div>}
    <MessageContent className={from === "assistant" ? "w-full" : "max-w-[88%] rounded-[14px] bg-[#f0f1f4] px-4 py-3"}>{streaming && !text ? <div className="flex items-center gap-2 py-2 text-sm text-[#767987]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#586ad0]" />Drafting this unit’s plan…</div> : <MessageResponse className="text-[13px] leading-6 text-[#3e414d]">{text}</MessageResponse>}</MessageContent>
    {sourceNames?.length ? <div className={`flex flex-wrap gap-1.5 ${from === "user" ? "justify-end" : ""}`}>{sourceNames.map((name, index) => <span key={`${name}-${index}`} className="rounded-full border border-[#e0e1e6] bg-white px-2.5 py-1 text-[10px] text-[#696c79]">{name}</span>)}</div> : null}
  </Message>;
}

function OccurrenceEditor({ occurrence, editable, onSave }: { occurrence: ComplianceActivityOccurrence; editable: boolean; onSave: (patch: Partial<ComplianceActivityOccurrence>) => boolean }) {
  const [status, setStatus] = useState(occurrence.status);
  const [outcome, setOutcome] = useState(occurrence.outcome);
  const [evidenceUrl, setEvidenceUrl] = useState(occurrence.evidence.find((item) => item.kind === "LINK")?.url ?? "");
  const [error, setError] = useState("");
  const save = () => {
    if (status === "COMPLETED" && !outcome.trim()) { setError("Add an outcome before completing this occurrence."); return; }
    const evidence = evidenceUrl.trim() ? [{ id: `evidence-${occurrence.id}`, kind: "LINK" as const, name: evidenceUrl.trim(), url: evidenceUrl.trim() }] : occurrence.evidence.filter((item) => item.kind !== "LINK");
    if (onSave({ status, outcome: outcome.trim(), evidence })) setError("");
  };
  return <div className="rounded-[10px] border border-[#e3e4e8] bg-[#fafafd] p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-[105px]"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#858895]">Due</p><p className="mt-1 text-xs font-semibold text-[#444752]">{formatDate(occurrence.dueDate)}</p></div><select disabled={!editable} value={status} onChange={(event) => setStatus(event.target.value as ComplianceActivityOccurrence["status"])} className="h-9 rounded-[9px] border border-[#dfe0e5] bg-white px-3 text-xs sm:w-[150px]"><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="DEFERRED">Deferred</option><option value="CANCELLED">Cancelled</option></select><input disabled={!editable} value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder={status === "COMPLETED" ? "Outcome required" : "Outcome or progress note"} className="h-9 min-w-0 flex-1 rounded-[9px] border border-[#dfe0e5] bg-white px-3 text-xs" /></div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input disabled={!editable} type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Evidence link (optional)" className="h-9 min-w-0 flex-1 rounded-[9px] border border-[#dfe0e5] bg-white px-3 text-xs" />{editable && <Button size="sm" variant="secondary" onClick={save}>Save occurrence</Button>}</div>{error && <p className="mt-2 text-[10px] text-[#a33a30]">{error}</p>}</div>;
}

function ActivityDialog({ plan, activity, risks, editable, onClose, onSave, onRemove, onOccurrence }: {
  plan: CompliancePlan;
  activity: CompliancePlanActivity;
  risks: ComplianceRiskSnapshot[];
  editable: boolean;
  onClose: () => void;
  onSave: (patch: Partial<CompliancePlanActivity>) => void;
  onRemove: () => void;
  onOccurrence: (occurrenceId: string, patch: Partial<ComplianceActivityOccurrence>) => boolean;
}) {
  const [draft, setDraft] = useState(activity);
  const update = <K extends keyof CompliancePlanActivity>(key: K, value: CompliancePlanActivity[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    const schedule = { ...draft.schedule, endDate: draft.schedule.cadence === "ONCE" ? draft.schedule.startDate : draft.schedule.endDate };
    onSave({ type: draft.type, title: draft.title, objective: draft.objective, owner: draft.owner, priority: draft.priority, inclusionRationale: draft.inclusionRationale, sourceScenarioIds: draft.sourceScenarioIds, schedule });
    onClose();
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[860px]"><div className="min-w-0 border-b border-[#ededf0] px-5 py-4 pr-14 sm:px-6 sm:pr-16"><DialogTitle className="line-clamp-2 text-lg leading-6">{activity.title || "New compliance activity"}</DialogTitle><DialogDescription className="mt-1 leading-5">Edit the activity, its source risks, and delivery schedule.</DialogDescription></div><div className="min-w-0 space-y-5 overflow-x-hidden overflow-y-auto p-5 sm:p-6">
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]"><label className="min-w-0"><span className="text-[11px] font-semibold text-[#444752]">Activity title</span><input disabled={!editable} value={draft.title} onChange={(event) => update("title", event.target.value)} className="mt-2 h-10 w-full min-w-0 rounded-[9px] border border-[#dedfe5] px-3 text-sm" placeholder="e.g. Quarterly customer-file monitoring" /></label><label className="min-w-0"><span className="text-[11px] font-semibold text-[#444752]">Type</span><select disabled={!editable} value={draft.type} onChange={(event) => update("type", event.target.value as ComplianceActivityType)} className="mt-2 h-10 w-full min-w-0 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs">{Object.entries(activityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <label className="block"><span className="text-[11px] font-semibold text-[#444752]">Objective and scope</span><textarea disabled={!editable} rows={3} value={draft.objective} onChange={(event) => update("objective", event.target.value)} className="mt-2 w-full resize-y rounded-[9px] border border-[#dedfe5] px-3 py-2 text-sm leading-6" placeholder="What will compliance do, and what should it establish?" /></label>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0"><span className="text-[11px] font-semibold text-[#444752]">Owner</span><input disabled={!editable} value={draft.owner} onChange={(event) => update("owner", event.target.value)} className="mt-2 h-10 w-full min-w-0 rounded-[9px] border border-[#dedfe5] px-3 text-sm" /></label><label className="min-w-0"><span className="text-[11px] font-semibold text-[#444752]">Priority</span><select disabled={!editable} value={draft.priority} onChange={(event) => update("priority", event.target.value as ComplianceActivityPriority)} className="mt-2 h-10 w-full min-w-0 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-sm"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label></div>
    <label className="block"><span className="text-[11px] font-semibold text-[#444752]">Why this is in the plan</span><textarea disabled={!editable} rows={2} value={draft.inclusionRationale} onChange={(event) => update("inclusionRationale", event.target.value)} className="mt-2 w-full resize-y rounded-[9px] border border-[#dedfe5] px-3 py-2 text-sm leading-6" placeholder="Connect the planned work to the assessed risk and control position." /></label>
    <div className="min-w-0"><p className="text-[11px] font-semibold text-[#444752]">Source risks</p><div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">{risks.map((risk) => <label key={risk.scenarioId} className="flex min-w-0 items-start gap-2 rounded-[9px] border border-[#e1e2e7] p-3"><input disabled={!editable} type="checkbox" checked={draft.sourceScenarioIds.includes(risk.scenarioId)} onChange={(event) => update("sourceScenarioIds", event.target.checked ? [...draft.sourceScenarioIds, risk.scenarioId] : draft.sourceScenarioIds.filter((id) => id !== risk.scenarioId))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#586ad0]" /><span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-[#586ad0]">{risk.code} · {risk.finalRatingLabel}</span><span className="mt-1 block break-words text-xs font-medium leading-5 text-[#444752]">{risk.title}</span></span></label>)}</div></div>
    <div className="min-w-0"><p className="text-[11px] font-semibold text-[#444752]">Schedule</p><div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-3"><select disabled={!editable} value={draft.schedule.cadence} onChange={(event) => update("schedule", { ...draft.schedule, cadence: event.target.value as CompliancePlanActivity["schedule"]["cadence"] })} className="h-10 min-w-0 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-sm"><option value="ONCE">One-off</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="SEMIANNUAL">Semiannual</option><option value="ANNUAL">Annual</option></select><input disabled={!editable} aria-label="Activity start date" type="date" min={plan.startDate} max={plan.endDate} value={draft.schedule.startDate} onChange={(event) => update("schedule", { ...draft.schedule, startDate: event.target.value })} className="h-10 min-w-0 rounded-[9px] border border-[#dedfe5] px-3 text-sm" /><input disabled={!editable || draft.schedule.cadence === "ONCE"} aria-label="Activity schedule end date" type="date" min={draft.schedule.startDate} max={plan.endDate} value={draft.schedule.cadence === "ONCE" ? draft.schedule.startDate : draft.schedule.endDate} onChange={(event) => update("schedule", { ...draft.schedule, endDate: event.target.value })} className="h-10 min-w-0 rounded-[9px] border border-[#dedfe5] px-3 text-sm disabled:bg-[#f4f4f6]" /></div></div>
    {activity.occurrences.length > 0 && <div><div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold text-[#444752]">Delivery occurrences</p><p className="mt-1 text-[10px] text-[#8c8f9a]">An outcome is required when an occurrence is completed.</p></div><Badge>{activity.occurrences.length}</Badge></div><div className="mt-3 space-y-2">{activity.occurrences.map((occurrence) => <OccurrenceEditor key={occurrence.id} occurrence={occurrence} editable={plan.status === "ACTIVE"} onSave={(patch) => onOccurrence(occurrence.id, patch)} />)}</div></div>}
  </div><div className="flex flex-col-reverse gap-3 border-t border-[#ededf0] bg-[#fafafd] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">{editable ? <Button size="sm" variant="ghost" className="justify-self-start text-[#a43a30]" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />Remove</Button> : <span />}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Close</Button>{editable && <Button onClick={save}>Save activity</Button>}</div></div></DialogContent></Dialog>;
}

export default function CompliancePlanWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { state, hydrated, addPlanActivity, updatePlanActivity, removePlanActivity, recordPlanProposal, applyPlanProposal, discardPlanProposal, activateCompliancePlan, closeCompliancePlan, updatePlanOccurrence } = useKimsy();
  const plan = state.compliancePlans.find((item) => item.id === params.id);
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lifecycleErrors, setLifecycleErrors] = useState<string[]>([]);
  const [streamingExchange, setStreamingExchange] = useState<{ userText: string; sourceNames: string[]; assistantText: string } | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const unitName = (unitId: string) => state.configuration.units.find((unit) => unit.id === unitId)?.name ?? "Unknown unit";
  const selectedUnitId = unitFilter === "ALL" ? "" : unitFilter;
  const thread = plan && selectedUnitId ? plan.unitThreads[selectedUnitId] : undefined;
  const proposal = thread?.pendingProposal;
  const progress = plan ? planProgress(plan) : { total: 0, completed: 0, terminal: 0, percent: 0 };
  const selectedActivity = plan?.activities.find((activity) => activity.id === selectedActivityId);
  const selectedRisks = plan && selectedActivity ? plan.sources.filter((source) => source.unitId === selectedActivity.unitId).flatMap((source) => source.risks) : [];
  const editable = Boolean(plan && plan.status !== "CLOSED");

  const visibleOccurrences = (() => {
    if (!plan) return [];
    return plan.activities.flatMap((activity) => activity.occurrences.map((occurrence) => ({ activity, occurrence }))).filter(({ activity, occurrence }) =>
      (unitFilter === "ALL" || activity.unitId === unitFilter) &&
      (statusFilter === "ALL" || occurrence.status === statusFilter) &&
      (typeFilter === "ALL" || activity.type === typeFilter),
    ).sort((left, right) => left.occurrence.dueDate.localeCompare(right.occurrence.dueDate));
  })();

  const groups = Object.entries(visibleOccurrences.reduce<Record<string, typeof visibleOccurrences>>((result, item) => {
    const key = monthLabel(item.occurrence.dueDate);
    (result[key] ??= []).push(item);
    return result;
  }, {}));

  if (!hydrated) return null;
  if (!plan) return <div className="mx-auto max-w-3xl"><Link href="/compliance-plans" className="inline-flex items-center gap-2 text-xs font-semibold text-[#666977]"><ArrowLeft className="h-3.5 w-3.5" />Compliance plans</Link><div className="mt-4 rounded-[18px] border border-[#e3e4e9] bg-white"><EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Compliance plan not found" description="Return to compliance plans and choose an available planning period." /></div></div>;

  const send = async (input: PromptInputMessage) => {
    if (!selectedUnitId || (!input.text.trim() && !input.files.length)) return;
    const submittedText = input.text.trim();
    const userText = submittedText || "Review the attached planning material.";
    setLoading(true); setError(""); setMessage("");
    setStreamingExchange({ userText, sourceNames: input.files.map((file) => file.filename || "Attached file"), assistantText: "" });
    try {
      const uploadedFiles = await Promise.all(input.files.map(async (file) => { const response = await fetch(file.url); if (!response.ok) throw new Error(`Could not read ${file.filename || "an attached file"}.`); const blob = await response.blob(); return new File([blob], file.filename || "source-file", { type: file.mediaType || blob.type }); }));
      const scopedPlan = { ...plan, unitIds: [selectedUnitId], sources: plan.sources.filter((source) => source.unitId === selectedUnitId), activities: plan.activities.filter((activity) => activity.unitId === selectedUnitId), unitThreads: { [selectedUnitId]: plan.unitThreads[selectedUnitId] }, auditEvents: [] };
      const form = new FormData();
      form.append("message", submittedText);
      form.append("unitId", selectedUnitId);
      form.append("unitName", unitName(selectedUnitId));
      form.append("complianceOwner", state.configuration.review.assessorName || "Workspace owner");
      form.append("plan", JSON.stringify(scopedPlan));
      uploadedFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/ai/compliance-plan", { method: "POST", body: form });
      if (!response.ok) { const result = await readJsonResponse(response); throw new Error(String(result.error ?? "Kimsy could not draft that plan.")); }
      let receivedResult = false;
      const finalState = await consumeCompliancePlanAgentStream(response, (streamState) => { if (streamState.result) receivedResult = true; setStreamingExchange((current) => current ? { ...current, assistantText: streamState.text || current.assistantText } : current); });
      if (!receivedResult || !finalState.result) throw new Error("Kimsy’s response ended before the planning proposal was ready.");
      const nextProposal: CompliancePlanChangeProposal = { id: `plan-proposal-${plan.id}-${selectedUnitId}-${thread?.messages.length ?? 0}`, unitId: selectedUnitId, summary: finalState.result.summary, changes: finalState.result.changes, warnings: finalState.result.warnings, createdAt: new Date().toISOString() };
      recordPlanProposal({ planId: plan.id, unitId: selectedUnitId, userText: submittedText, assistantText: finalState.text || "I prepared a unit plan for you to review.", proposal: nextProposal, sources: finalState.result.sources });
      setStreamingExchange(null);
    } catch (caught) { setStreamingExchange(null); setMessage(submittedText); setError(caught instanceof Error ? caught.message : "Kimsy could not draft that plan."); } finally { setLoading(false); }
  };

  const activate = () => setLifecycleErrors(activateCompliancePlan(plan.id));
  const close = () => { if (!closeCompliancePlan(plan.id)) setLifecycleErrors(["Resolve every occurrence as completed, deferred, or cancelled before closing the plan."]); else setLifecycleErrors([]); };
  const openNewActivity = () => { if (!selectedUnitId) return; setSelectedActivityId(addPlanActivity(plan.id, selectedUnitId)); };

  return <div className="enter-soft">
    <section className="flex min-h-[760px] flex-col overflow-hidden rounded-[20px] border border-[#e2e3e8] bg-white shadow-[var(--shadow-panel)] lg:h-[calc(100vh-88px)] lg:min-h-[700px] lg:max-h-[1040px]">
      <header className="flex shrink-0 flex-col gap-4 border-b border-[#ededf0] bg-[#fcfcfd] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><Link href="/compliance-plans" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#696c79] hover:text-[#586ad0]"><ArrowLeft className="h-3.5 w-3.5" />Compliance plans</Link><h1 className="mt-2 truncate font-display text-[26px] text-[#282a34]">{plan.name}</h1><p className="mt-1 text-[10px] text-[#888b97]">{formatDate(plan.startDate)} – {formatDate(plan.endDate)} · {plan.unitIds.length} unit{plan.unitIds.length === 1 ? "" : "s"}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs font-semibold text-[#4d505d] shadow-sm"><History className="h-3.5 w-3.5" />History</button><Badge tone={plan.status === "ACTIVE" ? "info" : plan.status === "CLOSED" ? "success" : "neutral"}>{plan.status === "CLOSED" ? "Closed" : plan.status === "ACTIVE" ? "Active" : "Draft"}</Badge>{plan.status === "DRAFT" && <Button onClick={activate}><CheckCircle2 className="h-4 w-4" />Activate plan</Button>}{plan.status === "ACTIVE" && <Button onClick={close} disabled={progress.total === 0 || progress.terminal !== progress.total}><FileCheck2 className="h-4 w-4" />Close plan</Button>}</div></header>
      {lifecycleErrors.length > 0 && <div className="flex items-start gap-3 border-b border-[#efc0bb] bg-[#fff4f2] px-5 py-3"><AlertCircle className="mt-0.5 h-4 w-4 text-[#a43a30]" /><div className="text-xs text-[#87372f]">{lifecycleErrors.map((item) => <p key={item}>{item}</p>)}</div><button type="button" onClick={() => setLifecycleErrors([])} className="ml-auto"><X className="h-4 w-4" /></button></div>}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-[520px] flex-col border-b border-[#ededf0] bg-[#fdfdfe] lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-[#ededf0] px-4 py-4"><p className="text-sm font-semibold text-[#30323c]">Planning agent</p><p className="mt-1 text-[11px] leading-5 text-[#858895]">Scoped only to the selected unit and its finalized assessment.</p><select aria-label="Planning agent unit" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="mt-3 h-10 w-full rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs font-semibold text-[#444752] shadow-sm"><option value="ALL">All units · roll-up</option>{plan.unitIds.map((unitId) => <option key={unitId} value={unitId}>{unitName(unitId)}</option>)}</select></div>
          {!selectedUnitId ? <div className="flex flex-1 flex-col items-center justify-center px-7 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eff1fb] text-[#586ad0]"><Sparkles className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-[#343640]">Choose a unit to plan</p><p className="mt-2 text-xs leading-5 text-[#858895]">The organization roll-up is calculated from unit activities. Kimsy never edits it directly.</p></div> : <><Conversation className="min-h-0 flex-1"><ConversationContent className="gap-5 p-4">{thread?.messages.length ? thread.messages.map((item) => <ChatMessage key={item.id} {...item} />) : <ChatMessage role="ASSISTANT" text={`I can draft a focused compliance plan for ${unitName(selectedUnitId)} from its finalized assessment. I’ll propose changes for you to review before anything is added.`} />}{streamingExchange && <><ChatMessage role="USER" text={streamingExchange.userText} sourceNames={streamingExchange.sourceNames} /><ChatMessage role="ASSISTANT" text={streamingExchange.assistantText} streaming /></>}{proposal && <div className="rounded-[12px] border border-[#d8dcf4] bg-[#f7f8fd] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#6673c5]">Plan update ready</p><p className="mt-2 text-xs font-semibold text-[#3f4355]">{proposal.summary}</p><div className="mt-3 space-y-1.5">{proposal.changes.map((change, index) => <p key={`${change.operation}-${change.activityId}-${index}`} className="flex items-start gap-2 text-[10px] leading-4 text-[#666a78]"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#586ad0]" />{change.operation === "REMOVE" ? "Remove activity" : change.title}</p>)}</div>{proposal.warnings.length > 0 && <div className="mt-3 rounded-[8px] bg-[#fff8e8] px-3 py-2 text-[10px] leading-4 text-[#795d24]">{proposal.warnings.join(" ")}</div>}<div className="mt-4 flex gap-2"><Button size="sm" onClick={() => applyPlanProposal(plan.id, selectedUnitId)}>Apply changes</Button><Button size="sm" variant="secondary" onClick={() => discardPlanProposal(plan.id, selectedUnitId)}>Discard</Button></div></div>}{error && <div className="rounded-[10px] border border-[#efc0bb] bg-[#fff4f2] px-3 py-2 text-xs text-[#9a3329]">{error}</div>}</ConversationContent><ConversationScrollButton /></Conversation><div className="border-t border-[#ededf0] p-3">{!thread?.messages.length && !proposal && <button type="button" disabled={loading} onClick={() => send({ text: "Draft a risk-prioritized compliance plan for this unit.", files: [] })} className="mb-2 w-full rounded-[9px] border border-[#dfe1ea] bg-[#f7f8fd] px-3 py-2 text-left text-[11px] font-semibold text-[#586ad0] hover:bg-[#f1f3fc]">Draft this unit’s activities</button>}<PromptInput onSubmit={send} className="overflow-hidden rounded-[14px] border-[#dedfe5] bg-white shadow-sm"><PromptInputTextarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask Kimsy to draft or revise this unit’s plan…" className="min-h-[72px] px-3 py-3 text-sm" /><PromptAttachments loading={loading} message={message} /></PromptInput></div></>}
        </aside>

        <main className="flex min-h-0 flex-col bg-white"><div className="shrink-0 border-b border-[#ededf0] px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-sm font-semibold text-[#30323c]">Upcoming work</p><p className="mt-1 text-[11px] text-[#858895]">{progress.completed} of {progress.total} occurrences completed across the plan</p></div><div className="flex flex-wrap items-center gap-2"><Progress value={progress.percent} /><select aria-label="Occurrence status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs"><option value="ALL">All statuses</option><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="DEFERRED">Deferred</option><option value="CANCELLED">Cancelled</option></select><select aria-label="Activity type filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs"><option value="ALL">All activity types</option>{Object.entries(activityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{selectedUnitId && editable && <Button size="sm" variant="secondary" onClick={openNewActivity}><Plus className="h-3.5 w-3.5" />Add activity</Button>}</div></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{loading && <div className="mb-5 space-y-2" aria-label="Drafting plan activities">{[0, 1, 2].map((item) => <div key={item} className="h-[92px] animate-pulse rounded-[12px] border border-[#e8e9ed] bg-[linear-gradient(90deg,#f7f7f9_25%,#eeeef2_50%,#f7f7f9_75%)] bg-[length:200%_100%]" />)}</div>}{groups.length === 0 ? <EmptyState icon={<CalendarClock className="h-5 w-5" />} title={plan.activities.length ? "No work matches these filters" : selectedUnitId ? "No activities for this unit yet" : "No planned work yet"} description={plan.activities.length ? "Adjust the status or activity-type filters." : selectedUnitId ? "Ask Kimsy for a risk-prioritized draft or add an activity manually." : "Select a unit and draft its compliance activities."} /> : <div className="space-y-6">{groups.map(([month, items]) => <section key={month}><div className="mb-2 flex items-center gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#737788]">{month}</p><span className="h-px flex-1 bg-[#ececef]" /></div><div className="space-y-2">{items.map(({ activity, occurrence }) => {
              const risks = plan.sources.filter((source) => source.unitId === activity.unitId).flatMap((source) => source.risks).filter((risk) => activity.sourceScenarioIds.includes(risk.scenarioId));
              return <button type="button" key={`${activity.id}-${occurrence.id}`} onClick={() => setSelectedActivityId(activity.id)} className="group flex w-full flex-col gap-3 rounded-[12px] border border-[#e2e3e8] bg-white p-4 text-left transition-colors hover:border-[#cfd3ea] hover:bg-[#fdfdff] sm:flex-row sm:items-start"><div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-[#f2f3f7]"><span className="text-[9px] font-semibold uppercase text-[#858895]">{new Date(`${occurrence.dueDate}T00:00:00`).toLocaleDateString("en", { month: "short" })}</span><span className="text-base font-semibold text-[#373944]">{new Date(`${occurrence.dueDate}T00:00:00`).getDate()}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone={priorityTone(activity.priority)}>{activity.priority.toLowerCase()}</Badge><span className="text-[10px] font-semibold text-[#696c79]">{activityTypeLabels[activity.type]}</span><span className="text-[10px] text-[#9a9ca6]">· {unitName(activity.unitId)}</span></div><p className="mt-2 text-sm font-semibold text-[#32343e]">{activity.title || "Untitled compliance activity"}</p><p className="mt-1 line-clamp-1 text-[11px] leading-5 text-[#777a87]">{activity.inclusionRationale || activity.objective || "Add the reason this activity belongs in the plan."}</p>{risks.length > 0 && <p className="mt-2 text-[10px] font-semibold text-[#586ad0]">{risks.slice(0, 2).map((risk) => `${risk.code} · ${risk.finalRatingLabel}`).join("  ·  ")}</p>}</div><div className="flex shrink-0 items-center gap-2"><Badge tone={occurrenceTone(occurrence.status)}>{statusLabel(occurrence.status)}</Badge><ChevronRight className="h-4 w-4 text-[#a0a2ad] group-hover:text-[#586ad0]" /></div></button>;
            })}</div></section>)}</div>}</div>
        </main>
      </div>
    </section>

    {selectedActivity && <ActivityDialog key={selectedActivity.id} plan={plan} activity={selectedActivity} risks={selectedRisks} editable={editable} onClose={() => setSelectedActivityId("")} onSave={(patch) => updatePlanActivity(plan.id, selectedActivity.id, patch)} onRemove={() => { removePlanActivity(plan.id, selectedActivity.id); setSelectedActivityId(""); }} onOccurrence={(occurrenceId, patch) => updatePlanOccurrence(plan.id, selectedActivity.id, occurrenceId, patch)} />}
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[82vh] max-w-xl overflow-y-auto p-0"><div className="border-b border-[#ededf0] px-5 py-4"><DialogTitle>Plan history</DialogTitle><DialogDescription className="mt-1">Manual changes and applied Kimsy proposals are recorded here.</DialogDescription></div>{plan.auditEvents.length === 0 ? <EmptyState icon={<History className="h-5 w-5" />} title="No changes recorded yet" description="Activity edits, plan lifecycle changes, and completed work will appear here." /> : <div className="divide-y divide-[#ededf0]">{plan.auditEvents.map((event) => <article key={event.id} className="flex gap-3 px-5 py-4"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${event.actorType === "AI" ? "bg-[#eff1fb] text-[#586ad0]" : "bg-[#f0f1f4] text-[#696c79]"}`}>{event.actorType === "AI" ? <Sparkles className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><div><p className="text-xs font-semibold text-[#40424d]">{event.summary}</p><p className="mt-1 text-[10px] text-[#8a8d99]">{event.actor}{event.unitId ? ` · ${unitName(event.unitId)}` : ""} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</p></div></article>)}</div>}</DialogContent></Dialog>
  </div>;
}
