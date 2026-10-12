"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileText, MessageSquareText, Plus, SendHorizontal, Settings2, Sparkles, Table2 } from "lucide-react";
import { Landing } from "@/components/landing";
import { Onboarding } from "@/components/onboarding";
import { BrandMark } from "@/components/brand-mark";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";
import type { AssessmentStatus } from "@/lib/types";

function statusBadge(status: AssessmentStatus) {
  if (status === "APPROVED" || status === "COMPLETED") return <Badge tone="success">{status === "APPROVED" ? "Approved" : "Complete"}</Badge>;
  if (status === "READY_FOR_REVIEW") return <Badge tone="warning">Ready for review</Badge>;
  if (status === "RETURNED") return <Badge tone="danger">Returned</Badge>;
  return <Badge>Draft</Badge>;
}

export default function Home() {
  const router = useRouter();
  const [intent, setIntent] = useState("");
  const [started, setStarted] = useState(() => typeof window !== "undefined" && sessionStorage.getItem("kimsy-setup-started") === "1");
  const { state, hydrated } = useKimsy();
  if (!hydrated) return null;
  if (!state.onboarded) return started ? <Onboarding /> : <Landing onStart={() => { sessionStorage.setItem("kimsy-setup-started", "1"); setStarted(true); }} />;

  const latest = state.assessments[0];
  const firstName = state.configuration.review.assessorName.split(" ")[0] || "there";
  const unitName = (unitId: string) => state.configuration.units.find((unit) => unit.id === unitId)?.name ?? "Unknown unit";

  const startFromIntent = () => {
    if (intent.trim()) sessionStorage.setItem("kimsy-assessment-intent", intent.trim());
    router.push("/assessments/new");
  };

  return <div className="enter-soft space-y-8">
    <section className="flex min-h-[500px] flex-col items-center justify-center px-2 pb-8 pt-10 text-center lg:min-h-[540px] lg:pt-4">
      <div className="flex flex-col items-center justify-center gap-2 text-[#24252e] sm:flex-row sm:gap-3"><BrandMark className="h-8 w-8 opacity-90 sm:translate-y-0.5" /><h1 className="font-display text-[38px] leading-tight sm:text-[48px]">Welcome back, {firstName}</h1></div>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#777a88]">Start a new assessment, continue your review, or ask Kimsy to structure what has changed.</p>

      <form onSubmit={(event) => { event.preventDefault(); startFromIntent(); }} className="mt-9 w-full max-w-[850px] rounded-[22px] border border-[#e3e4e8] bg-white p-3 text-left shadow-[var(--shadow-float)]">
        <label htmlFor="assessment-intent" className="sr-only">What would you like to assess?</label>
        <textarea id="assessment-intent" rows={3} value={intent} onChange={(event) => setIntent(event.target.value)} className="w-full resize-none border-0 bg-transparent px-3 py-2 text-[15px] leading-6 text-[#2c2e38] outline-none" placeholder="What would you like to assess?" />
        <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
          <Link href="/assessments/new" className="inline-flex h-9 items-center gap-2 rounded-[9px] px-2.5 text-xs font-medium text-[#777a88] hover:bg-[#f3f3f6] hover:text-[#41434e]"><FileText className="h-4 w-4" />Source material</Link>
          <Link href="/settings" className="inline-flex h-9 items-center gap-2 rounded-[9px] px-2.5 text-xs font-medium text-[#777a88] hover:bg-[#f3f3f6] hover:text-[#41434e]"><Settings2 className="h-4 w-4" />Settings</Link>
          <button type="submit" aria-label="Start assessment" className="ml-auto flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#25262f] text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-[#3a3c47]"><SendHorizontal className="h-[18px] w-[18px]" /></button>
        </div>
      </form>
      <p className="mt-4 text-[11px] text-[#9295a1]">Kimsy can make mistakes. Review all suggested assessment changes.</p>

      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#4e5160]"><Sparkles className="h-3.5 w-3.5 text-[#586ad0]" />Quick actions</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/assessments/new" className="rounded-full border border-[#e5e5e9] bg-white px-4 py-2 text-xs font-medium text-[#5d606e] shadow-sm hover:border-[#d6d7dd] hover:text-[#292b35]">New assessment</Link>
          <Link href="/register" className="rounded-full border border-[#e5e5e9] bg-white px-4 py-2 text-xs font-medium text-[#5d606e] shadow-sm hover:border-[#d6d7dd] hover:text-[#292b35]">Review risk register</Link>
          <Link href="/settings" className="rounded-full border border-[#e5e5e9] bg-white px-4 py-2 text-xs font-medium text-[#5d606e] shadow-sm hover:border-[#d6d7dd] hover:text-[#292b35]">Workspace settings</Link>
          {latest && <Link href={`/register?unit=${encodeURIComponent(latest.unitId)}`} className="rounded-full border border-[#e5e5e9] bg-white px-4 py-2 text-xs font-medium text-[#5d606e] shadow-sm hover:border-[#d6d7dd] hover:text-[#292b35]">Continue latest review</Link>}
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-[1120px] gap-5 pb-6 xl:grid-cols-[0.9fr_1.1fr]">
      {latest ? <Panel className="overflow-hidden bg-[linear-gradient(145deg,#f1f3fc_0%,#ffffff_62%)]"><div className="flex h-full min-h-[250px] flex-col p-6"><div className="flex items-center justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#25262f] text-white"><MessageSquareText className="h-[18px] w-[18px]" /></div>{statusBadge(latest.status)}</div><p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#626ec0]">Continue where you left off</p><h2 className="font-display mt-2 text-[28px] text-[#24252e]">{unitName(latest.unitId)}</h2><p className="mt-2 text-xs leading-5 text-[#797c89]">{latest.period} · {latest.rows.filter((row) => row.applicable).length} applicable scenarios</p><Link href={`/register?unit=${encodeURIComponent(latest.unitId)}`} className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-[#30323c] hover:text-[#5369d2]">Choose a scenario<ArrowRight className="h-4 w-4" /></Link></div></Panel> : <Panel><EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="Start your first assessment" description="Choose a unit and period, then tell Kimsy what changed or attach the material you already have." /></Panel>}

      <Panel className="overflow-hidden">
        <PanelHeader title="Assessments" description="Current work across your organization" action={<Link href="/register" className="inline-flex items-center gap-1 text-xs font-semibold text-[#586ad0] hover:underline">Full register<Table2 className="h-3.5 w-3.5" /></Link>} />
        {state.assessments.length === 0 ? <EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="No assessments yet" description="Create an assessment to begin building your risk register." /> : <div className="divide-y divide-[#ededf0]">{state.assessments.slice(0, 4).map((assessment) => {
          const filled = assessment.rows.filter((row) => row.applicable && Object.values(row.values).some((value) => value !== null && value !== "")).length;
          return <Link key={assessment.id} href={`/register?unit=${encodeURIComponent(assessment.unitId)}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#fafafd] sm:px-6"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f0f1f5] text-[#656978]">{assessment.status === "APPROVED" || assessment.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#30313b]">{unitName(assessment.unitId)}</p><p className="mt-1 truncate text-[11px] text-[#858895]">{assessment.period} · {filled}/{assessment.rows.length} scenarios assessed</p></div><div className="hidden sm:block">{statusBadge(assessment.status)}</div><ArrowRight className="h-4 w-4 text-[#a0a2ad]" /></Link>;
        })}</div>}
        {state.assessments.length === 0 && <div className="flex justify-center border-t border-[#ededf0] p-4"><Link href="/assessments/new" className="inline-flex items-center gap-2 text-sm font-semibold text-[#30313b]"><Plus className="h-4 w-4" />Create assessment</Link></div>}
      </Panel>
    </section>
  </div>;
}
