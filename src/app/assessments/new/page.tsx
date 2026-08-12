"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardPlus, ShieldCheck, UserRound } from "lucide-react";
import { Badge, Button, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { state, createAssessment } = useKimsy();
  const [businessUnit, setBusinessUnit] = useState("");
  const [period, setPeriod] = useState("2026 annual review");
  const [dueDate, setDueDate] = useState("30 Sep 2026");
  const model = state.organization.operatingModel;
  const framework = state.frameworkVersions.find((item) => item.status === "PUBLISHED");

  const create = () => {
    if (!businessUnit.trim()) return;
    let id = "";
    flushSync(() => {
      id = createAssessment({ businessUnit: businessUnit.trim(), period, dueDate });
    });
    router.push(`/assessments/${id}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/assessments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5c6964] hover:text-[#0f766e]"><ArrowLeft className="h-3.5 w-3.5" />Assessment register</Link>
      <PageHeader eyebrow="New cycle" title="Create compliance risk assessment" description="The organization operating model and current published framework will be fixed to this cycle for historical consistency." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <PanelHeader title="Assessment details" description="Define the accountable business area and review period." />
          <div className="space-y-5 px-5 py-5">
            <label className="block"><span className="text-xs font-semibold text-[#34413c]">Business unit</span><input value={businessUnit} onChange={(event) => setBusinessUnit(event.target.value)} className="mt-2 h-10 w-full rounded-[5px] border border-[#cfd7d3] px-3 text-sm focus:border-[#0f766e] focus:outline-none" placeholder="e.g. Corporate Banking" autoFocus /></label>
            <label className="block"><span className="text-xs font-semibold text-[#34413c]">Assessment period</span><input value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-2 h-10 w-full rounded-[5px] border border-[#cfd7d3] px-3 text-sm focus:border-[#0f766e] focus:outline-none" /></label>
            <label className="block"><span className="text-xs font-semibold text-[#34413c]">Due date</span><div className="relative mt-2"><CalendarDays className="absolute left-3 top-3 h-4 w-4 text-[#75817c]" /><input value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 w-full rounded-[5px] border border-[#cfd7d3] pl-10 pr-3 text-sm focus:border-[#0f766e] focus:outline-none" /></div></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#e2e7e5] bg-[#f8faf9] px-5 py-4"><Link href="/assessments" className="inline-flex h-9 items-center rounded-[5px] border border-[#cdd6d2] bg-white px-3.5 text-sm font-semibold text-[#24302c]">Cancel</Link><Button onClick={create} disabled={!businessUnit.trim()}><ClipboardPlus className="h-4 w-4" />Create cycle</Button></div>
        </Panel>
        <div className="space-y-5">
          <Panel><PanelHeader title="Operating model" /><div className="px-5 py-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-[#e8f4f1] text-[#0f766e]">{model === "FIRST_LINE_LED" ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</div><div><Badge tone="info">{model === "FIRST_LINE_LED" ? "First-line-led" : "Compliance-led"}</Badge><p className="mt-1 text-[11px] text-[#6d7a75]">Organization default</p></div></div><p className="mt-4 text-xs leading-5 text-[#63716b]">{model === "FIRST_LINE_LED" ? "A business contributor supplies facts before compliance reviews the AI draft." : "Compliance owns fact gathering, assessment, checks, and finalization."}</p></div></Panel>
          <Panel><PanelHeader title="Published framework" /><div className="px-5 py-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-[#187653]" /><div><p className="text-sm font-semibold">Version {framework?.version}</p><p className="mt-1 text-xs text-[#6d7a75]">{framework?.scenarios.length} risk scenarios available</p></div></div></div></Panel>
        </div>
      </div>
    </div>
  );
}
