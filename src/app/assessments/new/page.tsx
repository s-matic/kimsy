"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, CalendarDays, MessageSquareText, Sparkles } from "lucide-react";
import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { state, createAssessment } = useKimsy();
  const [unitId, setUnitId] = useState(state.configuration.units[0]?.id ?? "");
  const [period, setPeriod] = useState("2026 annual review");
  const [initialBrief, setInitialBrief] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setInitialBrief(sessionStorage.getItem("kimsy-assessment-intent") ?? "");
      const scopedUnitId = sessionStorage.getItem("kimsy-assessment-unit");
      if (scopedUnitId && state.configuration.units.some((unit) => unit.id === scopedUnitId)) setUnitId(scopedUnitId);
      sessionStorage.removeItem("kimsy-assessment-unit");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [state.configuration.units]);

  const create = () => {
    if (!unitId || !period.trim()) return;
    flushSync(() => { createAssessment(unitId, period.trim(), initialBrief.trim() || undefined); });
    sessionStorage.removeItem("kimsy-assessment-intent");
    router.push(`/register?unit=${encodeURIComponent(unitId)}`);
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#666977] hover:text-[#586ad0]"><ArrowLeft className="h-3.5 w-3.5" />Assistant</Link>
    <PageHeader eyebrow="New assessment" title="What are you assessing?" description="Kimsy creates one register row and a focused conversation for every configured risk scenario." />
    <Panel><PanelHeader title="Assessment scope" description="Choose one organizational unit and the period the assessment covers." /><div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">{initialBrief && <div className="flex items-start gap-3 rounded-[12px] border border-[#dfe2f5] bg-[#f4f5fc] p-4"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#586ad0]" /><div><p className="text-xs font-semibold text-[#434a80]">Initial assessment brief</p><p className="mt-1 text-sm leading-6 text-[#626678]">{initialBrief}</p></div></div>}<label className="block"><span className="text-xs font-semibold text-[#3d3f4a]">Organizational unit</span><select aria-label="Organizational unit" value={unitId} onChange={(event) => setUnitId(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#dedfe5] bg-white px-3 text-sm shadow-sm focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]"><option value="">Choose a unit</option>{state.configuration.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="block"><span className="text-xs font-semibold text-[#3d3f4a]">Assessment period</span><div className="relative mt-2"><CalendarDays className="absolute left-3 top-3.5 h-4 w-4 text-[#7d808e]" /><input aria-label="Assessment period" value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 w-full rounded-[10px] border border-[#dedfe5] pl-10 pr-3 text-sm shadow-sm focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]" /></div></label></div><div className="flex justify-end gap-2 border-t border-[#ededf0] bg-[#fafafd] px-5 py-4 sm:px-6"><Link href="/" className="inline-flex h-10 items-center rounded-[10px] border border-[#dedfe5] bg-white px-4 text-sm font-semibold text-[#343640] shadow-sm">Cancel</Link><Button onClick={create} disabled={!unitId || !period.trim()}><MessageSquareText className="h-4 w-4" />Create assessment</Button></div></Panel>
  </div>;
}
