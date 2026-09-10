"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  FileUp,
  KeyRound,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { displayFieldValue, FieldControl, RatingValue } from "@/components/field-control";
import { Badge, Button, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { consumeAssessmentAgentStream } from "@/lib/ai/assessment-ui-stream";
import { explainCalculation } from "@/lib/scoring";
import { useKimsy } from "@/lib/store";
import { readJsonResponse } from "@/lib/http";
import type { Assessment, AssessmentStatus, ConversationMessage, RegisterChangeProposal } from "@/lib/types";

function statusBadge(status: AssessmentStatus) {
  if (status === "APPROVED" || status === "COMPLETED") return <Badge tone="success">{status === "APPROVED" ? "Approved" : "Complete"}</Badge>;
  if (status === "READY_FOR_REVIEW") return <Badge tone="warning">Ready for review</Badge>;
  if (status === "RETURNED") return <Badge tone="danger">Returned</Badge>;
  return <Badge>Draft</Badge>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function assessmentReady(assessment: Assessment, requiredFieldIds: string[]) {
  const applicable = assessment.rows.filter((row) => row.applicable);
  return applicable.length > 0 && applicable.every((row) => requiredFieldIds.every((fieldId) => isPresent(row.values[fieldId])));
}

function AssessmentChatMessage({ role, text, sourceNames, createdAt, streaming = false }: Pick<ConversationMessage, "role" | "text" | "sourceNames" | "createdAt"> & { streaming?: boolean }) {
  return <div className={`flex gap-2.5 ${role === "USER" ? "flex-row-reverse" : ""}`}><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${role === "USER" ? "bg-[#d6b56f] text-[#342b19]" : "bg-[#dff3ef] text-[#0f766e]"}`}>{role === "USER" ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}</div><div className={`max-w-[82%] rounded-[8px] px-3 py-2.5 ${role === "USER" ? "bg-[#23322d] text-white" : "bg-[#edf4f1] text-[#364b44]"}`}><p className="text-xs leading-5">{text || (streaming ? "Reviewing the assessment…" : "")}</p>{sourceNames?.length ? <div className="mt-2 flex flex-wrap gap-1">{sourceNames.map((name) => <span key={name} className="rounded bg-white/10 px-1.5 py-0.5 text-[9px]">{name}</span>)}</div> : null}<p className={`mt-1.5 text-[9px] ${role === "USER" ? "text-white/55" : "text-[#82908a]"}`}>{createdAt}</p></div></div>;
}

export default function AssessmentWorkspacePage() {
  const params = useParams<{ id: string }>();
  const {
    state,
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
  const [selectedRowId, setSelectedRowId] = useState(assessment?.rows[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deselectedChanges, setDeselectedChanges] = useState<string[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [streamingExchange, setStreamingExchange] = useState<{
    userText: string;
    sourceNames: string[];
    assistantText: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!assessment) return <Panel><EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="Assessment not found" description="Return to assessments and choose an available workspace." /></Panel>;

  const unit = state.configuration.units.find((item) => item.id === assessment.unitId);
  const selectedRow = assessment.rows.find((row) => row.id === selectedRowId) ?? assessment.rows[0];
  const selectedScenario = state.configuration.scenarios.find((scenario) => scenario.id === selectedRow?.scenarioId);
  const editable = state.persona === "ASSESSOR" && (assessment.status === "DRAFT" || assessment.status === "RETURNED");
  const requiredFields = state.configuration.fields.filter((field) => field.required && field.type !== "CALCULATED").map((field) => field.id);
  const ready = assessmentReady(assessment, requiredFields);
  const selectedChanges = assessment.pendingProposal?.changes.map((change) => change.scenarioId).filter((id) => !deselectedChanges.includes(id)) ?? [];

  const send = async () => {
    if (!message.trim() && !files.length) return;
    const submittedMessage = message.trim();
    const submittedFiles = [...files];
    setLoading(true);
    setError("");
    setStreamingExchange({
      userText: submittedMessage || "Review the attached material.",
      sourceNames: submittedFiles.map((file) => file.name),
      assistantText: "",
    });
    setMessage("");
    try {
      const form = new FormData();
      form.append("message", submittedMessage);
      form.append("configuration", JSON.stringify(state.configuration));
      form.append("assessment", JSON.stringify(assessment));
      submittedFiles.forEach((file) => form.append("files", file));
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
      if (!receivedResult || !finalState.result) throw new Error("Kimsy’s response ended before the register proposal was ready.");
      const proposal: RegisterChangeProposal = {
        id: `proposal-${assessment.id}-${assessment.messages.length}`,
        summary: finalState.result.summary,
        changes: finalState.result.changes,
        warnings: finalState.result.warnings,
        createdAt: "Just now",
      };
      recordAiProposal({
        assessmentId: assessment.id,
        userText: submittedMessage,
        assistantText: finalState.text || "I’ve prepared register changes for you to review before applying them.",
        proposal,
        sources: finalState.result.sources,
      });
      setStreamingExchange(null);
      setDeselectedChanges([]);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (caught) {
      setStreamingExchange(null);
      setMessage(submittedMessage);
      setError(caught instanceof Error ? caught.message : "Kimsy could not assess that material.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-5">
    <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5c6964] hover:text-[#0f766e]"><ArrowLeft className="h-3.5 w-3.5" />Assessments</Link>
    <PageHeader eyebrow={assessment.period} title={unit?.name ?? "Assessment"} description={`${assessment.rows.filter((row) => row.applicable).length} applicable scenarios · Updated ${assessment.updatedAt}`} actions={<><Button variant="secondary" onClick={() => setAssistantOpen(true)}><MessageSquareText className="h-4 w-4" />Open assistant</Button>{statusBadge(assessment.status)}{state.configuration.review.mode === "SOLO" && editable && <Button disabled={!ready} onClick={() => completeAssessment(assessment.id)}><CheckCircle2 className="h-4 w-4" />Mark complete</Button>}{state.configuration.review.mode === "REVIEWER" && state.persona === "ASSESSOR" && editable && <Button disabled={!ready} onClick={() => submitForReview(assessment.id)}><UserRound className="h-4 w-4" />Send to reviewer</Button>}</>} />

    {assessment.status === "RETURNED" && <div className="flex items-start gap-3 rounded-[7px] border border-[#efc0bb] bg-[#fff4f2] px-4 py-3"><RotateCcw className="mt-0.5 h-4 w-4 text-[#a43a30]" /><div><p className="text-xs font-semibold text-[#912d24]">Returned by {state.configuration.review.reviewerName}</p><p className="mt-1 text-xs leading-5 text-[#79524e]">{assessment.reviewComment}</p></div></div>}

    {state.persona === "REVIEWER" && assessment.status === "READY_FOR_REVIEW" && <Panel className="border-[#e4cf9d] bg-[#fffdf7]"><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Independent review</p><p className="mt-1 text-xs leading-5 text-[#6c746f]">Review the conversation, sources, and register below. Add a comment before approving or returning the assessment.</p><textarea aria-label="Review comment" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={2} className="mt-3 w-full resize-y rounded-[6px] border border-[#d8cba8] bg-white px-3 py-2 text-sm" placeholder="Document your review judgment…" /></div><div className="flex gap-2"><Button variant="secondary" disabled={!reviewComment.trim()} onClick={() => reviewAssessment(assessment.id, "RETURN", reviewComment.trim())}>Return</Button><Button disabled={!reviewComment.trim()} onClick={() => reviewAssessment(assessment.id, "APPROVE", reviewComment.trim())}><CheckCircle2 className="h-4 w-4" />Approve</Button></div></div></Panel>}

    <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
      <DialogContent className="right-3 bottom-3 left-auto top-3 flex h-auto w-[calc(100%-1.5rem)] max-w-[430px] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[20px] bg-white p-0 sm:max-w-[430px]" showCloseButton>
        <DialogTitle className="sr-only">Assessment assistant</DialogTitle>
        <DialogDescription className="sr-only">Chat with Kimsy and attach source material for this assessment.</DialogDescription>
        <Panel className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none">
        <PanelHeader title="Assessment assistant" description="Your notes and source material stay with this assessment" />
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {assessment.messages.map((item) => <AssessmentChatMessage key={item.id} {...item} />)}
          {streamingExchange && <><AssessmentChatMessage role="USER" text={streamingExchange.userText} sourceNames={streamingExchange.sourceNames} createdAt="Just now" /><AssessmentChatMessage role="ASSISTANT" text={streamingExchange.assistantText} createdAt="Just now" streaming /></>}
        </div>
        {assessment.sources.length > 0 && <div className="border-t border-[#e2e7e5] bg-[#fbfcfc] px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#75817c]"><Paperclip className="h-3 w-3" />Sources used</div><div className="mt-2 flex flex-wrap gap-1.5">{assessment.sources.map((source) => <span key={source.id} title={`${source.locators.length} source locators`} className="inline-flex items-center gap-1 rounded-[4px] border border-[#dce2df] bg-white px-2 py-1 text-[10px] text-[#5e6c66]"><FileText className="h-3 w-3" />{source.name} · {formatBytes(source.size)}</span>)}</div></div>}
        {editable ? <div className="border-t border-[#e2e7e5] p-4"><textarea aria-label="Message Kimsy" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full resize-none rounded-[7px] border border-[#cfd8d4] px-3 py-2.5 text-sm leading-6 placeholder:text-[#929d98] focus:border-[#0f766e] focus:outline-none" placeholder="Tell Kimsy what changed, or ask it to review a file…" />{files.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded bg-[#edf2f0] px-2 py-1 text-[10px]">{file.name}<button aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, fileIndex) => fileIndex !== index))}><X className="h-3 w-3" /></button></span>)}</div>}{error && <div className="mt-2 flex items-start gap-2 rounded-[6px] border border-[#efc0bb] bg-[#fff4f2] px-3 py-2 text-xs leading-5 text-[#96352b]">{error.includes("OPENAI_API_KEY") && <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />}{error}</div>}<div className="mt-3 flex items-center justify-between"><input ref={fileRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="h-3.5 w-3.5" />Attach</Button><Button size="sm" loading={loading} disabled={!message.trim() && !files.length} onClick={send}>{loading ? "Thinking" : "Send"}{!loading && <Send className="h-3.5 w-3.5" />}</Button></div></div> : <div className="border-t border-[#e2e7e5] bg-[#f8faf9] px-4 py-3 text-xs leading-5 text-[#6d7a75]">{state.persona === "REVIEWER" ? "Reviewer mode is read-only." : "This assessment is read-only in its current state."}</div>}
        </Panel>
      </DialogContent>
    </Dialog>

    <div className="min-w-0 space-y-5">
        {assessment.pendingProposal && editable && <Panel className="overflow-hidden border-[#9bcac1]"><div className="border-b border-[#cde0db] bg-[#edf8f5] px-5 py-4"><div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#0f766e] text-white"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#204a42]">Proposed register changes</p><p className="mt-1 text-xs leading-5 text-[#55736b]">{assessment.pendingProposal.summary}</p></div><Badge tone="info">Review first</Badge></div></div><div className="divide-y divide-[#e2e7e5]">{assessment.pendingProposal.changes.map((change) => {
          const scenario = state.configuration.scenarios.find((item) => item.id === change.scenarioId);
          const selected = selectedChanges.includes(change.scenarioId);
          return <label key={change.scenarioId} className="flex cursor-pointer items-start gap-3 px-5 py-4 hover:bg-[#fbfcfc]"><input type="checkbox" checked={selected} onChange={(event) => setDeselectedChanges(event.target.checked ? deselectedChanges.filter((id) => id !== change.scenarioId) : [...deselectedChanges, change.scenarioId])} className="mt-1 h-4 w-4 accent-[#0f766e]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{scenario?.code} · {scenario?.title}</p><Badge tone={change.applicable ? "success" : "neutral"}>{change.applicable ? "Applicable" : "Not applicable"}</Badge></div><p className="mt-1.5 text-xs leading-5 text-[#65736d]">{change.rationale}</p><div className="mt-2 flex flex-wrap gap-1.5">{change.values.map((item) => { const field = state.configuration.fields.find((candidate) => candidate.id === item.fieldId); return field ? <span key={item.fieldId} className="rounded-[4px] border border-[#dce2df] bg-[#f8faf9] px-2 py-1 text-[10px]"><strong>{field.label}:</strong> {displayFieldValue(field, item.value)}</span> : null; })}</div></div></label>;
        })}</div>{assessment.pendingProposal.warnings.length > 0 && <div className="border-t border-[#ead5a5] bg-[#fffaf0] px-5 py-3">{assessment.pendingProposal.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-[#735d32]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</p>)}</div>}<div className="flex justify-end gap-2 border-t border-[#dce2df] bg-[#fbfcfc] px-5 py-3"><Button variant="ghost" onClick={() => { discardProposal(assessment.id); setDeselectedChanges([]); }}>Discard</Button><Button disabled={!selectedChanges.length} onClick={() => { applyProposal(assessment.id, selectedChanges); setDeselectedChanges([]); }}>Apply {selectedChanges.length} change{selectedChanges.length === 1 ? "" : "s"}<Check className="h-4 w-4" /></Button></div></Panel>}

        <Panel className="overflow-hidden"><PanelHeader title="Assessment" description="Choose a scenario, then complete its assessment form" action={<Link href="/register" className="text-xs font-semibold text-[#586ad0] hover:underline">Open spreadsheet view</Link>} /><div className="grid min-h-[640px] lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]"><div className="overflow-x-auto border-b border-[#e2e7e5] lg:max-h-[760px] lg:overflow-x-hidden lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="flex min-w-max divide-x divide-[#e7ebe9] lg:block lg:min-w-0 lg:divide-x-0 lg:divide-y">{assessment.rows.map((row) => {
          const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
          const finalField = state.configuration.fields.find((field) => field.id === state.configuration.finalRatingFieldId);
          return <button key={row.id} onClick={() => setSelectedRowId(row.id)} className={`flex w-[250px] shrink-0 items-start gap-3 px-4 py-4 text-left lg:w-full ${selectedRow?.id === row.id ? "bg-[#edf7f5]" : "hover:bg-[#fafcfb]"}`}><div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${row.applicable ? "bg-[#0f766e] text-white" : "border border-[#c9d2ce] text-[#9aa49f]"}`}>{row.applicable ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#0f766e]">{scenario?.code}</p><p className="mt-0.5 text-xs font-semibold leading-5 text-[#293630]">{scenario?.title}</p>{finalField && row.applicable && <div className="mt-2"><RatingValue field={finalField} value={row.values[finalField.id] ?? null} /></div>}</div><ChevronRight className="mt-1 h-3.5 w-3.5 text-[#83908a]" /></button>;
        })}</div></div>{selectedRow && selectedScenario && <div className="min-w-0"><div className="border-b border-[#e2e7e5] px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-[#0f766e]">{selectedScenario.code} · {selectedScenario.category}</p><h2 className="mt-1 text-lg font-semibold">{selectedScenario.title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#6d7a75]">{selectedScenario.description}</p></div>{editable ? <label className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={selectedRow.applicable} onChange={(event) => setRowApplicability(assessment.id, selectedRow.id, event.target.checked)} className="h-4 w-4 accent-[#0f766e]" />Applicable</label> : <Badge>{selectedRow.applicable ? "Applicable" : "Not applicable"}</Badge>}</div></div>{selectedRow.applicable ? <div className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-2">{state.configuration.fields.map((field) => <div key={field.id} className={field.type === "LONG_TEXT" ? "sm:col-span-2" : ""}><div className="mb-1.5 flex items-center justify-between gap-2"><label className="text-xs font-semibold text-[#3d4a45]">{field.label}{field.required && <span className="ml-1 text-[#a42c21]">*</span>}</label>{field.type === "CALCULATED" && <span title={explainCalculation(field.id, selectedRow.values, state.configuration)} className="text-[9px] font-bold uppercase text-[#0f766e]">Calculated</span>}</div><p className="mb-2 text-[10px] leading-4 text-[#7c8883]">{field.helpText}</p>{editable ? <FieldControl field={field} value={selectedRow.values[field.id] ?? null} onChange={(value) => updateRowValue(assessment.id, selectedRow.id, field.id, value)} /> : field.type === "CALCULATED" ? <RatingValue field={field} value={selectedRow.values[field.id] ?? null} /> : <p className="rounded-[5px] bg-[#f5f7f6] px-3 py-2 text-sm">{displayFieldValue(field, selectedRow.values[field.id] ?? null)}</p>}{field.type === "CALCULATED" && <p className="mt-1.5 text-[10px] text-[#71807a]">{explainCalculation(field.id, selectedRow.values, state.configuration)}</p>}</div>)}</div><div className="border-t border-[#e2e7e5] pt-5"><label className="text-xs font-semibold text-[#3d4a45]">Assessment rationale</label>{editable ? <textarea aria-label="Assessment rationale" rows={4} value={selectedRow.rationale} onChange={(event) => updateRowRationale(assessment.id, selectedRow.id, event.target.value)} className="mt-2 w-full resize-y rounded-[6px] border border-[#cfd8d4] px-3 py-2.5 text-sm leading-6" placeholder="Document the key facts and judgment…" /> : <p className="mt-2 text-sm leading-6 text-[#4a5852]">{selectedRow.rationale || "No rationale recorded."}</p>}{selectedRow.citations.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{selectedRow.citations.map((citation, index) => <span key={`${citation.sourceName}-${index}`} className="inline-flex items-center gap-1 rounded-[4px] border border-[#dce2df] bg-[#f8faf9] px-2 py-1 text-[10px] text-[#5e6c66]"><FileText className="h-3 w-3" />{citation.sourceName} · {citation.locator}</span>)}</div>}</div></div> : <div className="p-5"><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Scenario marked not applicable" description="Turn applicability back on if this scenario should be assessed for the selected unit and period." /></div>}</div>}</div></Panel>
        {!ready && editable && <p className="flex items-center gap-2 rounded-[6px] border border-[#ead5a5] bg-[#fffaf0] px-4 py-3 text-xs text-[#785819]"><AlertCircle className="h-4 w-4 shrink-0" />Complete the required fields for every applicable scenario before finishing the assessment.</p>}
    </div>
  </div>;
}
