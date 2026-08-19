"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, MessageSquareText, Plus, Sparkles } from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { Badge, Button, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";
import type { AssessmentStatus } from "@/lib/types";

function statusBadge(status: AssessmentStatus) {
  if (status === "APPROVED" || status === "COMPLETED") return <Badge tone="success">{status === "APPROVED" ? "Approved" : "Complete"}</Badge>;
  if (status === "READY_FOR_REVIEW") return <Badge tone="warning">Ready for review</Badge>;
  if (status === "RETURNED") return <Badge tone="danger">Returned</Badge>;
  return <Badge>Draft</Badge>;
}

export default function Home() {
  const { state, hydrated } = useKimsy();
  if (!hydrated) return null;
  if (!state.onboarded) return <Onboarding />;

  const latest = state.assessments[0];
  const unitName = (unitId: string) => state.configuration.units.find((unit) => unit.id === unitId)?.name ?? "Unknown unit";

  return <div className="space-y-6">
    <PageHeader eyebrow="Your workspace" title={`Welcome back, ${state.configuration.review.assessorName.split(" ")[0] || "there"}`} description="Start with a conversation. Kimsy turns your notes and source material into register changes you can inspect before applying." actions={<Link href="/assessments/new" className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#0f766e] bg-[#0f766e] px-3.5 text-sm font-semibold text-white hover:bg-[#0b625c]"><Plus className="h-4 w-4" />New assessment</Link>} />

    {latest && <Panel className="overflow-hidden border-[#b8d8d1] bg-[linear-gradient(110deg,#f1faf7_0%,#ffffff_58%)]"><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-[#0f766e] text-white"><Sparkles className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#0f766e]">Continue where you left off</p>{statusBadge(latest.status)}</div><h2 className="mt-1.5 text-xl font-semibold text-[#17231f]">{unitName(latest.unitId)}</h2><p className="mt-1 text-sm text-[#65736d]">{latest.period} · {latest.rows.filter((row) => row.applicable).length} applicable scenarios · Updated {latest.updatedAt}</p></div></div><Link href={`/assessments/${latest.id}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-[#0f766e] bg-[#0f766e] px-4 text-sm font-semibold text-white">Open conversation<ArrowRight className="h-4 w-4" /></Link></div></Panel>}

    <Panel>
      <PanelHeader title="Assessments" description="One focused conversation for each organizational unit and period" action={state.assessments.length > 0 ? <Link href="/register" className="text-xs font-semibold text-[#0f766e] hover:underline">Open full register</Link> : undefined} />
      {state.assessments.length === 0 ? <EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="Start your first assessment" description="Choose a unit and period, then tell Kimsy what changed or attach the material you already have." /> : <div className="divide-y divide-[#e7ebe9]">{state.assessments.map((assessment) => {
        const filled = assessment.rows.filter((row) => row.applicable && Object.values(row.values).some((value) => value !== null && value !== "")).length;
        return <Link key={assessment.id} href={`/assessments/${assessment.id}`} className="flex flex-col gap-3 px-5 py-4 hover:bg-[#fafcfb] sm:flex-row sm:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[#edf4f1] text-[#43635b]">{assessment.status === "APPROVED" || assessment.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#24302c]">{unitName(assessment.unitId)}</p><p className="mt-1 text-xs text-[#77837e]">{assessment.period} · {filled}/{assessment.rows.length} scenarios assessed</p></div><div className="flex items-center gap-3">{statusBadge(assessment.status)}<ArrowRight className="h-4 w-4 text-[#81908a]" /></div></Link>;
      })}</div>}
      {state.assessments.length === 0 && <div className="flex justify-center border-t border-[#e2e7e5] p-4"><Link href="/assessments/new"><Button><Plus className="h-4 w-4" />Create assessment</Button></Link></div>}
    </Panel>
  </div>;
}
