"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, CalendarDays, MessageSquareText } from "lucide-react";
import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { state, createAssessment } = useKimsy();
  const [unitId, setUnitId] = useState(state.configuration.units[0]?.id ?? "");
  const [period, setPeriod] = useState("2026 annual review");

  const create = () => {
    if (!unitId || !period.trim()) return;
    let id = "";
    flushSync(() => { id = createAssessment(unitId, period.trim()); });
    router.push(`/assessments/${id}`);
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#5c6964] hover:text-[#0f766e]"><ArrowLeft className="h-3.5 w-3.5" />Assessments</Link>
    <PageHeader eyebrow="New assessment" title="What are you assessing?" description="Kimsy creates a private conversation and one register row for every configured risk scenario." />
    <Panel><PanelHeader title="Assessment scope" description="Choose one organizational unit and the period the assessment covers." /><div className="space-y-5 px-5 py-5"><label className="block"><span className="text-xs font-semibold text-[#34413c]">Organizational unit</span><select aria-label="Organizational unit" value={unitId} onChange={(event) => setUnitId(event.target.value)} className="mt-2 h-11 w-full rounded-[6px] border border-[#cfd7d3] bg-white px-3 text-sm focus:border-[#0f766e] focus:outline-none"><option value="">Choose a unit</option>{state.configuration.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="block"><span className="text-xs font-semibold text-[#34413c]">Assessment period</span><div className="relative mt-2"><CalendarDays className="absolute left-3 top-3.5 h-4 w-4 text-[#75817c]" /><input aria-label="Assessment period" value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 w-full rounded-[6px] border border-[#cfd7d3] pl-10 pr-3 text-sm focus:border-[#0f766e] focus:outline-none" /></div></label></div><div className="flex justify-end gap-2 border-t border-[#e2e7e5] bg-[#f8faf9] px-5 py-4"><Link href="/" className="inline-flex h-9 items-center rounded-[5px] border border-[#cdd6d2] bg-white px-3.5 text-sm font-semibold text-[#24302c]">Cancel</Link><Button onClick={create} disabled={!unitId || !period.trim()}><MessageSquareText className="h-4 w-4" />Start conversation</Button></div></Panel>
  </div>;
}
