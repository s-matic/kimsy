"use client";

import Link from "next/link";
import { ArrowRight, CalendarRange, CheckCircle2, ClipboardCheck, Plus } from "lucide-react";
import { latestFinalizedAssessments, planProgress } from "@/lib/compliance-plan";
import { Badge, EmptyState, PageHeader, Panel, Progress } from "@/components/ui";
import { useKimsy } from "@/lib/store";
import type { CompliancePlanStatus } from "@/lib/types";

function statusBadge(status: CompliancePlanStatus) {
  if (status === "ACTIVE") return <Badge tone="info">Active</Badge>;
  if (status === "CLOSED") return <Badge tone="success">Closed</Badge>;
  return <Badge>Draft</Badge>;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function CompliancePlansPage() {
  const { state, hydrated } = useKimsy();
  if (!hydrated) return null;
  const finalized = latestFinalizedAssessments(state.assessments);

  return <div className="enter-soft space-y-5">
    <PageHeader eyebrow="Annual planning" title="Compliance plans" description="Turn finalized unit assessments into focused compliance work and track delivery through the year." actions={finalized.length > 0 ? <Link href="/compliance-plans/new" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#25262f] bg-[#25262f] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#3b3d49]"><Plus className="h-4 w-4" />New annual plan</Link> : undefined} />

    {state.compliancePlans.length === 0 ? <Panel><EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title={finalized.length ? "Create your first annual plan" : "Complete an assessment first"} description={finalized.length ? "Kimsy will suggest the latest finalized assessment for each unit before drafting any activities." : "Compliance plans use completed or approved risk assessments as their traceable source."} />{finalized.length > 0 && <div className="flex justify-center border-t border-[#ededf0] p-4"><Link href="/compliance-plans/new" className="inline-flex items-center gap-2 text-sm font-semibold text-[#586ad0]">Create annual plan<ArrowRight className="h-4 w-4" /></Link></div>}</Panel> : <div className="grid gap-4 lg:grid-cols-2">{state.compliancePlans.map((plan) => {
      const progress = planProgress(plan);
      return <Link key={plan.id} href={`/compliance-plans/${plan.id}`} className="group rounded-[18px] border border-[#e3e4e9] bg-white p-5 shadow-[var(--shadow-panel)] transition-all hover:-translate-y-0.5 hover:border-[#d3d6e7] sm:p-6">
        <div className="flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#eff1fb] text-[#586ad0]"><ClipboardCheck className="h-[18px] w-[18px]" /></span>{statusBadge(plan.status)}</div>
        <h2 className="mt-6 font-display text-[26px] text-[#25262e]">{plan.name}</h2>
        <p className="mt-2 flex items-center gap-2 text-xs text-[#7c7f8d]"><CalendarRange className="h-3.5 w-3.5" />{formatDate(plan.startDate)} – {formatDate(plan.endDate)}</p>
        <div className="mt-6 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-[#4a4d59]">{plan.unitIds.length} unit{plan.unitIds.length === 1 ? "" : "s"} · {plan.activities.length} activit{plan.activities.length === 1 ? "y" : "ies"}</p><p className="mt-1 text-[10px] text-[#91939e]">{progress.completed} of {progress.total} occurrences completed</p></div><Progress value={progress.percent} /></div>
        <div className="mt-6 flex items-center gap-2 border-t border-[#eeeeef] pt-4 text-xs font-semibold text-[#586ad0]">Open plan<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
      </Link>;
    })}</div>}

    {state.compliancePlans.length > 0 && finalized.length === 0 && <div className="flex items-start gap-3 rounded-[14px] border border-[#dfe1ea] bg-white px-4 py-3 text-xs text-[#6e7180]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6b759d]" />Existing plans remain available. Complete another assessment before creating a new plan.</div>}
  </div>;
}
