"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, CalendarRange, CheckCircle2, ClipboardCheck } from "lucide-react";
import { isFinalizedAssessment, latestFinalizedAssessments } from "@/lib/compliance-plan";
import { Badge, Button, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useKimsy } from "@/lib/store";

function calendarDefaults() {
  const year = new Date().getFullYear();
  return { year, startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export default function NewCompliancePlanPage() {
  const router = useRouter();
  const { state, hydrated, createCompliancePlan } = useKimsy();
  const defaults = useMemo(() => calendarDefaults(), []);
  const latest = useMemo(() => latestFinalizedAssessments(state.assessments), [state.assessments]);
  const finalized = useMemo(() => state.assessments.filter(isFinalizedAssessment), [state.assessments]);
  const [name, setName] = useState(`${defaults.year} compliance plan`);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(latest.map((assessment) => [assessment.unitId, assessment.id])));
  const [error, setError] = useState("");
  const selectionInitialized = useRef(false);

  useEffect(() => {
    if (!hydrated || selectionInitialized.current) return;
    selectionInitialized.current = true;
    setSelected(Object.fromEntries(latest.map((assessment) => [assessment.unitId, assessment.id])));
  }, [hydrated, latest]);

  if (!hydrated) return null;
  const units = state.configuration.units.filter((unit) => finalized.some((assessment) => assessment.unitId === unit.id));
  const selectedAssessmentIds = Object.values(selected).filter(Boolean);

  const create = () => {
    if (!name.trim() || !startDate || !endDate || startDate > endDate || !selectedAssessmentIds.length) {
      setError("Add a plan name, a valid date range, and at least one source assessment.");
      return;
    }
    let id = "";
    flushSync(() => { id = createCompliancePlan({ name, startDate, endDate, assessmentIds: selectedAssessmentIds }); });
    router.push(`/compliance-plans/${id}`);
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/compliance-plans" className="inline-flex items-center gap-2 text-xs font-semibold text-[#666977] hover:text-[#586ad0]"><ArrowLeft className="h-3.5 w-3.5" />Compliance plans</Link>
    <PageHeader eyebrow="New annual plan" title="Set the planning period" description="Calendar year is the default. Adjust the dates if your planning cycle follows a fiscal year." />
    {finalized.length === 0 ? <Panel><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No finalized assessments" description="Complete or approve at least one unit assessment before creating a compliance plan." /><div className="flex justify-center border-t border-[#ededf0] p-4"><Link href="/register" className="text-sm font-semibold text-[#586ad0]">Open risk register</Link></div></Panel> : <Panel>
      <PanelHeader title="Plan details" description="Confirm which finalized unit assessments should inform this plan." />
      <div className="space-y-6 p-5 sm:p-6">
        <label className="block"><span className="text-xs font-semibold text-[#3d3f4a]">Plan name</span><input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#dedfe5] px-3 text-sm shadow-sm outline-none focus:border-[#7785d8] focus:ring-3 focus:ring-[#e9ebfa]" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-semibold text-[#3d3f4a]">Start date</span><div className="relative mt-2"><CalendarRange className="absolute left-3 top-3.5 h-4 w-4 text-[#858895]" /><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-[10px] border border-[#dedfe5] pl-10 pr-3 text-sm shadow-sm outline-none focus:border-[#7785d8] focus:ring-3 focus:ring-[#e9ebfa]" /></div></label><label><span className="text-xs font-semibold text-[#3d3f4a]">End date</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#dedfe5] px-3 text-sm shadow-sm outline-none focus:border-[#7785d8] focus:ring-3 focus:ring-[#e9ebfa]" /></label></div>
        <div><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-[#3d3f4a]">Source assessments</p><p className="mt-1 text-[11px] text-[#858895]">The latest finalized assessment for each unit is suggested.</p></div><Badge tone="info">{selectedAssessmentIds.length} selected</Badge></div><div className="mt-3 divide-y divide-[#ededf0] overflow-hidden rounded-[12px] border border-[#e1e2e7]">{units.map((unit) => {
          const options = finalized.filter((assessment) => assessment.unitId === unit.id);
          const included = Boolean(selected[unit.id]);
          return <div key={unit.id} className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center"><label className="flex min-w-0 flex-1 items-center gap-3"><input type="checkbox" checked={included} onChange={(event) => setSelected((current) => ({ ...current, [unit.id]: event.target.checked ? (latest.find((item) => item.unitId === unit.id)?.id ?? options[0]?.id ?? "") : "" }))} className="h-4 w-4 rounded border-[#cfd1d8] accent-[#586ad0]" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#343640]">{unit.name}</span><span className="mt-0.5 block text-[10px] text-[#8b8e9a]">{options.length} finalized assessment{options.length === 1 ? "" : "s"}</span></span></label><select disabled={!included} value={selected[unit.id] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [unit.id]: event.target.value }))} aria-label={`Source assessment for ${unit.name}`} className="h-10 min-w-0 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs text-[#4b4e59] shadow-sm disabled:bg-[#f4f4f6] sm:w-[270px]">{options.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.period} · {assessment.status === "APPROVED" ? "Approved" : "Complete"}</option>)}</select></div>;
        })}</div></div>
        {error && <p className="rounded-[10px] border border-[#efc0bb] bg-[#fff4f2] px-3 py-2 text-xs text-[#9a3329]">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-[#ededf0] bg-[#fafafd] px-5 py-4 sm:px-6"><Link href="/compliance-plans" className="inline-flex h-10 items-center rounded-[10px] border border-[#dedfe5] bg-white px-4 text-sm font-semibold text-[#343640] shadow-sm">Cancel</Link><Button onClick={create} disabled={!selectedAssessmentIds.length}><ClipboardCheck className="h-4 w-4" />Create draft plan</Button></div>
    </Panel>}
  </div>;
}
