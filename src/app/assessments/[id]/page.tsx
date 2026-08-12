"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Panel, PanelHeader, Progress } from "@/components/ui";
import { ratingTone } from "@/lib/risk";
import { useKimsy } from "@/lib/store";
import type { RiskRating } from "@/lib/types";

type Tab = "summary" | "facts" | "assessment" | "evidence" | "history";

const ratings: RiskRating[] = ["Low", "Moderate", "High", "Severe"];

function workflowSteps(status: string, model: string) {
  const current = status === "FACT_GATHERING" ? 1 : status === "AI_DRAFT_READY" ? 2 : status === "IN_REVIEW" ? 3 : 4;
  return [
    model === "FIRST_LINE_LED" ? "Business facts" : "Fact gathering",
    "AI analysis",
    model === "FIRST_LINE_LED" ? "Compliance review" : "Officer checks",
    "Finalized",
  ].map((label, index) => ({ label, complete: current > index + 1, active: current === index + 1 }));
}

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    state,
    updateAnswer,
    applyAssessmentDraft,
    acceptScenario,
    resolveException,
    acceptEvidence,
    finalizeAssessment,
  } = useKimsy();
  const [tab, setTab] = useState<Tab>("summary");
  const [generating, setGenerating] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const assessment = state.assessments.find((item) => item.id === params.id);
  const framework = state.frameworkVersions.find((item) => item.version === assessment?.frameworkVersion) ?? state.frameworkVersions[0];
  const openExceptions = assessment?.exceptions.filter((item) => item.status === "OPEN") ?? [];
  const relevant = assessment?.scenarioAssessments.filter((item) => item.relevant) ?? [];

  const selected = assessment?.scenarioAssessments.find((item) => item.id === selectedScenario) ?? relevant[0];

  if (!assessment) {
    return <EmptyState icon={<FileText className="h-5 w-5" />} title="Assessment not found" description="This assessment may have been removed or you may not have access." />;
  }

  const steps = workflowSteps(assessment.status, assessment.operatingModelSnapshot);
  const canFinalize =
    assessment.status === "IN_REVIEW" &&
    assessment.scenarioAssessments.length > 0 &&
    openExceptions.length === 0 &&
    assessment.scenarioAssessments.every((scenario) => scenario.accepted);
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/ai/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id, questions: assessment.questions, scenarios: framework.scenarios }),
      });
      const result = await response.json();
      if (!response.ok || !result.draft) {
        throw new Error(result.error ?? "Unable to generate the assessment draft.");
      }
      applyAssessmentDraft(assessment.id, result.draft);
      setTab("assessment");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/assessments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5c6964] hover:text-[#0f766e]"><ArrowLeft className="h-3.5 w-3.5" />Assessment register</Link>
      <PageHeader
        eyebrow={assessment.reference}
        title={assessment.businessUnit}
        description={`${assessment.period} · Framework v${assessment.frameworkVersion} · Last updated ${assessment.lastUpdated}`}
        actions={
          <>
            <Badge tone="info">{assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "First-line-led" : "Compliance-led"}</Badge>
            {assessment.status === "FINALIZED" ? (
              <a href={`/api/reports/${assessment.id}`} className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#cdd6d2] bg-white px-3.5 text-sm font-semibold text-[#24302c] hover:bg-[#f3f6f5]"><Download className="h-4 w-4" />PDF report</a>
            ) : (
              <Button onClick={() => finalizeAssessment(assessment.id)} disabled={!canFinalize}><LockKeyhole className="h-4 w-4" />Finalize</Button>
            )}
          </>
        }
      />

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-[#e2e7e5] sm:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.label} className={`flex min-h-16 items-center gap-3 px-3 py-3 sm:px-4 ${step.active ? "bg-[#eef7f5]" : "bg-white"}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${step.complete ? "border-[#0f766e] bg-[#0f766e] text-white" : step.active ? "border-[#0f766e] text-[#0f766e]" : "border-[#cbd4d0] text-[#78857f]"}`}>
                {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className={`text-xs font-semibold ${step.active ? "text-[#0b665f]" : "text-[#52605b]"}`}>{step.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="overflow-x-auto border-b border-[#dce2df]">
        <div className="flex min-w-max gap-6">
          {([
            ["summary", "Summary"],
            ["facts", assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Business facts" : "Fact gathering"],
            ["assessment", "Risk assessment"],
            ["evidence", `Evidence (${assessment.evidence.length})`],
            ["history", "Audit history"],
          ] as [Tab, string][]).map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-0.5 pb-3 text-xs font-semibold ${tab === value ? "border-[#0f766e] text-[#0f766e]" : "border-transparent text-[#697671] hover:text-[#27332f]"}`}>{label}</button>
          ))}
        </div>
      </div>

      {tab === "summary" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
          <div className="space-y-5">
            <Panel>
              <PanelHeader title="Assessment position" description="Current exposure and review progress" />
              <div className="grid sm:grid-cols-3">
                <div className="border-b border-[#e2e7e5] px-5 py-5 sm:border-b-0 sm:border-r"><p className="text-xs text-[#6d7a75]">Relevant scenarios</p><p className="mt-2 text-2xl font-semibold">{relevant.length || "—"}</p><p className="mt-1 text-[11px] text-[#83908a]">of {framework.scenarios.length} evaluated</p></div>
                <div className="border-b border-[#e2e7e5] px-5 py-5 sm:border-b-0 sm:border-r"><p className="text-xs text-[#6d7a75]">Outside appetite</p><p className="mt-2 text-2xl font-semibold text-[#a42c21]">{relevant.filter((item) => !item.withinAppetite).length}</p><p className="mt-1 text-[11px] text-[#83908a]">requires documented action</p></div>
                <div className="px-5 py-5"><p className="text-xs text-[#6d7a75]">Human accepted</p><p className="mt-2 text-2xl font-semibold">{relevant.filter((item) => item.accepted).length}/{relevant.length || 0}</p><p className="mt-1 text-[11px] text-[#83908a]">AI cannot approve proposals</p></div>
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="What changed and why it matters" description="Management translation based on current facts and framework" action={<Badge tone="info"><Sparkles className="mr-1 h-3 w-3" />AI draft</Badge>} />
              <div className="space-y-4 px-5 py-5 text-sm leading-6 text-[#41504a]">
                {relevant.length ? (
                  <>
                    <p>{assessment.businessUnit}&apos;s compliance exposure has increased, primarily because customer ownership structures are becoming more complex while CDD quality and review timeliness have deteriorated.</p>
                    <div className="border-l-2 border-[#c74035] bg-[#fff6f5] px-4 py-3"><p className="font-semibold text-[#84251d]">Action is required</p><p className="mt-1 text-xs leading-5 text-[#76544f]">A relevant scenario is proposed outside appetite. Management should confirm remediation capacity, ownership, and delivery dates before final approval.</p></div>
                  </>
                ) : (
                  <p>No exposure conclusion is available yet. Complete fact gathering and generate the framework-based assessment before management reporting.</p>
                )}
                <p className="text-xs text-[#77837e]">This explanation remains a draft until accepted by a compliance officer.</p>
              </div>
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel>
              <PanelHeader title="Assessment owner" />
              <div className="flex items-center gap-3 px-5 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9e8e4] text-xs font-bold text-[#225d55]">{assessment.owner.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><div><p className="text-sm font-semibold">{assessment.owner}</p><p className="text-xs text-[#74817c]">{assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Business contributor" : "Compliance officer"}</p></div></div>
              <div className="border-t border-[#e2e7e5] px-5 py-4 text-xs text-[#596761]"><div className="flex justify-between"><span>Due date</span><span className="font-semibold text-[#27332f]">{assessment.dueDate}</span></div><div className="mt-3 flex justify-between"><span>Completion</span><Progress value={assessment.completion} /></div></div>
            </Panel>
            <Panel>
              <PanelHeader title={assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Compliance review" : "Officer checks"} />
              <div className="px-5 py-4"><div className="flex items-start gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#fff0ee] text-[#a42c21]"><AlertTriangle className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{openExceptions.length} open exceptions</p><p className="mt-1 text-xs leading-5 text-[#6a7772]">{openExceptions.length ? "Blocking items must be resolved before finalization." : "All required checks are complete."}</p></div></div><Button variant="secondary" className="mt-4 w-full" onClick={() => setTab("assessment")}>Open review workspace<ChevronRight className="h-4 w-4" /></Button></div>
            </Panel>
          </div>
        </div>
      )}

      {tab === "facts" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Panel>
            <PanelHeader title={assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Business facts" : "Compliance fact gathering"} description={assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Questions translated from the published risk framework into business language." : "Capture the business facts directly or request targeted input from a business contact."} />
            <div className="divide-y divide-[#e2e7e5]">
              {assessment.questions.map((question, index) => (
                <div key={question.id} className="px-5 py-5">
                  <div className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#edf2f0] text-[10px] font-bold text-[#53615c]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><label htmlFor={question.id} className="text-sm font-semibold text-[#25312d]">{question.prompt}</label>{question.required && <span className="text-[10px] font-bold uppercase text-[#a42c21]">Required</span>}</div><p className="mt-1 text-xs leading-5 text-[#74817c]">{question.help}</p><textarea id={question.id} value={question.answer} onChange={(event) => updateAnswer(assessment.id, question.id, event.target.value)} rows={3} className="mt-3 w-full resize-y rounded-[5px] border border-[#cfd7d3] bg-white px-3 py-2.5 text-sm leading-6 text-[#28352f] placeholder:text-[#919b97] focus:border-[#0f766e] focus:outline-none" placeholder="Enter the facts known today..." /></div></div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-[#dce2df] bg-[#f8faf9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#6b7873]">Answers save automatically and remain editable until finalization.</p><Button loading={generating} onClick={handleGenerate} disabled={assessment.completion < 100}><Sparkles className="h-4 w-4" />Build AI assessment</Button></div>
          </Panel>
          <div className="space-y-5">
            <Panel><PanelHeader title="Completion" /><div className="px-5 py-5"><p className="text-3xl font-semibold">{assessment.completion}%</p><Progress value={assessment.completion} /><p className="mt-3 text-xs leading-5 text-[#71807a]">Complete all required questions before generating a new assessment draft.</p></div></Panel>
            {assessment.operatingModelSnapshot === "COMPLIANCE_LED" && <Panel><PanelHeader title="Request business input" /><div className="px-5 py-4"><p className="text-xs leading-5 text-[#697671]">Send selected questions to a business contact without transferring assessment ownership.</p><Button variant="secondary" className="mt-3 w-full"><MessageSquareText className="h-4 w-4" />Create information request</Button></div></Panel>}
          </div>
        </div>
      )}

      {tab === "assessment" && (
        assessment.scenarioAssessments.length === 0 ? (
          <Panel><EmptyState icon={<Bot className="h-5 w-5" />} title="No assessment draft yet" description="Complete the fact-gathering questions and run the analysis to map facts against the published risk scenarios." /></Panel>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <Panel className="h-fit overflow-hidden">
              <PanelHeader title="Relevant scenarios" description={`${relevant.length} relevant · ${openExceptions.length} exceptions`} />
              <div className="divide-y divide-[#e7ebe9]">
                {relevant.map((scenario) => {
                  const risk = framework.scenarios.find((item) => item.id === scenario.scenarioId);
                  const exceptions = assessment.exceptions.filter((item) => item.scenarioAssessmentId === scenario.id && item.status === "OPEN").length;
                  return <button key={scenario.id} onClick={() => setSelectedScenario(scenario.id)} className={`flex w-full items-start gap-3 px-4 py-4 text-left ${selected?.id === scenario.id ? "bg-[#edf7f5]" : "hover:bg-[#f8faf9]"}`}><div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${scenario.accepted ? "bg-[#187653] text-white" : "border border-[#bdc8c3] text-transparent"}`}>{scenario.accepted && <Check className="h-3 w-3" />}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#77847f]">{risk?.code}</p><p className="mt-0.5 text-xs font-semibold leading-5 text-[#293630]">{risk?.title}</p><div className="mt-2 flex items-center gap-2"><Badge tone={ratingTone(scenario.proposedRating)}>{scenario.proposedRating}</Badge>{exceptions > 0 && <span className="text-[10px] font-bold text-[#a42c21]">{exceptions} exception{exceptions > 1 ? "s" : ""}</span>}</div></div></button>;
                })}
              </div>
            </Panel>
            {selected && (() => {
              const risk = framework.scenarios.find((item) => item.id === selected.scenarioId)!;
              const exceptions = assessment.exceptions.filter((item) => item.scenarioAssessmentId === selected.id);
              return <div className="space-y-5">
                <Panel>
                  <div className="border-b border-[#e2e7e5] px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-[#0f766e]">{risk.code} · {risk.category}</p><h2 className="mt-1 text-lg font-semibold">{risk.title}</h2></div><div className="flex items-center gap-2"><Badge tone={selected.confidence < 70 ? "warning" : "info"}>{selected.confidence}% confidence</Badge><Badge tone={selected.withinAppetite ? "success" : "danger"}>{selected.withinAppetite ? "Within appetite" : "Outside appetite"}</Badge></div></div></div>
                  <div className="grid border-b border-[#e2e7e5] sm:grid-cols-3"><div className="border-b px-5 py-4 sm:border-b-0 sm:border-r"><p className="text-[10px] font-bold uppercase text-[#75817c]">AI proposal</p><div className="mt-2"><Badge tone={ratingTone(selected.proposedRating)}>{selected.proposedRating}</Badge></div></div><div className="border-b px-5 py-4 sm:border-b-0 sm:border-r"><p className="text-[10px] font-bold uppercase text-[#75817c]">Control effectiveness</p><p className="mt-2 text-sm font-semibold">{selected.controlEffectiveness}</p></div><div className="px-5 py-4"><p className="text-[10px] font-bold uppercase text-[#75817c]">Risk appetite</p><div className="mt-2"><Badge tone={ratingTone(risk.appetite)}>{risk.appetite}</Badge></div></div></div>
                  <div className="px-5 py-5"><div className="mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-[#0f766e]" /><h3 className="text-xs font-bold uppercase text-[#586660]">Proposed rationale</h3></div><p className="text-sm leading-6 text-[#384741]">{selected.rationale}</p><div className="mt-4 flex flex-wrap gap-2">{selected.citations.map((citation) => <button key={citation} className="inline-flex items-center gap-1 rounded-[4px] border border-[#d5ddda] bg-[#f8faf9] px-2 py-1 text-[10px] font-semibold text-[#53615c] hover:border-[#8bbab4]"><FileText className="h-3 w-3" />{citation}<ExternalLink className="h-3 w-3" /></button>)}</div></div>
                  <div className="border-t border-[#e2e7e5] bg-[#f8faf9] px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#697671]">Accept the proposal or select a different rating with documented rationale.</p><div className="flex items-center gap-2"><select defaultValue={selected.acceptedRating ?? selected.proposedRating} aria-label="Accepted rating" className="h-9 rounded-[5px] border border-[#cdd6d2] bg-white px-2 text-xs font-semibold">{ratings.map((rating) => <option key={rating}>{rating}</option>)}</select><Button onClick={() => acceptScenario(assessment.id, selected.id)} disabled={selected.accepted}><ShieldCheck className="h-4 w-4" />{selected.accepted ? "Accepted" : "Accept rating"}</Button></div></div></div>
                </Panel>
                <Panel>
                  <PanelHeader title={assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Review exceptions" : "Officer checks"} description="Only items requiring judgment or action are shown." />
                  {exceptions.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No exceptions" description="No specific review issues were identified for this scenario." /> : <div className="divide-y divide-[#e7ebe9]">{exceptions.map((exception) => <div key={exception.id} className="px-5 py-4"><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ${exception.status === "RESOLVED" ? "bg-[#eaf7f1] text-[#176b4b]" : "bg-[#fff0ee] text-[#a42c21]"}`}>{exception.status === "RESOLVED" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{exception.title}</p><Badge tone={exception.status === "RESOLVED" ? "success" : exception.severity === "Critical" ? "critical" : "danger"}>{exception.status === "RESOLVED" ? "Resolved" : exception.severity}</Badge></div><p className="mt-1 text-xs leading-5 text-[#687670]">{exception.detail}</p>{exception.resolution && <p className="mt-2 rounded-[4px] bg-[#eef7f3] px-3 py-2 text-xs text-[#386553]">{exception.resolution}</p>}{exception.status === "OPEN" && <Button size="sm" variant="secondary" className="mt-3" onClick={() => resolveException(assessment.id, exception.id, "Reviewed against current evidence and accepted with remediation tracked by Compliance.")}>Resolve exception</Button>}</div></div></div>)}</div>}
                </Panel>
              </div>;
            })()}
          </div>
        )
      )}

      {tab === "evidence" && (
        <Panel className="overflow-hidden">
          <PanelHeader title="Evidence register" description="Files, links, and attestations supporting the assessment" action={<Button><Paperclip className="h-4 w-4" />Add evidence</Button>} />
          {assessment.evidence.length === 0 ? <EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="No evidence added" description="Attach files, link to an approved repository, or capture a named attestation." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-[#e2e7e5] bg-[#f8faf9] text-[10px] font-bold uppercase text-[#71807a]"><th className="px-5 py-3">Evidence</th><th className="px-4 py-3">Scenario</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Added</th><th className="px-5 py-3 text-right">Review</th></tr></thead><tbody>{assessment.evidence.map((evidence) => { const risk = framework.scenarios.find((item) => item.id === evidence.scenarioId); return <tr key={evidence.id} className="border-b border-[#e7ebe9] last:border-b-0"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#edf2f0] text-[#53635d]">{evidence.type === "LINK" ? <Link2 className="h-4 w-4" /> : evidence.type === "ATTESTATION" ? <UserRound className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div><div><p className="text-sm font-semibold">{evidence.name}</p><p className="mt-0.5 text-[10px] font-bold text-[#7c8883]">{evidence.type}</p></div></div></td><td className="px-4 py-4 text-xs text-[#596761]">{risk?.code}</td><td className="px-4 py-4 text-xs text-[#596761]">{evidence.owner}</td><td className="px-4 py-4 text-xs text-[#596761]">{evidence.addedAt}</td><td className="px-5 py-4 text-right">{evidence.status === "PENDING" ? <Button size="sm" variant="secondary" onClick={() => acceptEvidence(assessment.id, evidence.id)}>Accept evidence</Button> : <Badge tone="success">Accepted</Badge>}</td></tr>;})}</tbody></table></div>}
        </Panel>
      )}

      {tab === "history" && (
        <Panel>
          <PanelHeader title="Audit history" description="Append-only record of material actions and decisions" />
          <div className="divide-y divide-[#e7ebe9]">{state.auditEvents.filter((event) => event.target.includes(assessment.reference) || event.target.includes(assessment.id) || event.target.startsWith("sa-") || event.target.startsWith("ex-")).map((event) => <div key={event.id} className="flex gap-4 px-5 py-4"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf2f0] text-[#586761]"><History className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-sm font-semibold">{event.action}</p><span className="text-xs text-[#78847f]">by {event.actor}</span></div><p className="mt-1 text-xs leading-5 text-[#65736d]">{event.detail}</p><p className="mt-1 text-[10px] font-semibold text-[#89938f]">{event.at}</p></div></div>)}</div>
        </Panel>
      )}

      {assessment.status !== "FINALIZED" && !canFinalize && <div className="flex items-center gap-2 rounded-[5px] border border-[#ead5a5] bg-[#fffaf0] px-4 py-3 text-xs text-[#785819]"><AlertTriangle className="h-4 w-4 shrink-0" />Finalization remains locked until all relevant scenarios are accepted and blocking exceptions are resolved.</div>}
    </div>
  );
}
