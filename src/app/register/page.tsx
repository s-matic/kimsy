"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Search,
  TableProperties,
} from "lucide-react";
import { displayFieldValue, RatingValue } from "@/components/field-control";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { explainCalculation } from "@/lib/scoring";
import { useKimsy } from "@/lib/store";

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export default function RegisterPage() {
  const { state } = useKimsy();
  const [query, setQuery] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState(() => state.configuration.units.length === 1 ? state.configuration.units[0].id : "");
  const [expandedRow, setExpandedRow] = useState(() => {
    const assessment = state.assessments[0];
    return assessment?.rows[0] ? `${assessment.id}-${assessment.rows[0].id}` : "";
  });
  const [showNotApplicable, setShowNotApplicable] = useState(false);
  const fields = state.configuration.fields;
  const units = state.configuration.units;
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const requiredFields = fields.filter((field) => field.required && field.type !== "CALCULATED");
  const finalRatingField = fields.find((field) => field.id === state.configuration.finalRatingFieldId);
  const rows = useMemo(() => state.assessments.flatMap((assessment) => assessment.rows.map((row) => ({ assessment, row }))).filter(({ assessment, row }) => {
    const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
    const unit = state.configuration.units.find((item) => item.id === assessment.unitId);
    const haystack = `${scenario?.code} ${scenario?.title} ${scenario?.category} ${unit?.name} ${assessment.period}`.toLowerCase();
    return assessment.unitId === selectedUnitId && haystack.includes(query.toLowerCase());
  }), [state.assessments, state.configuration.scenarios, state.configuration.units, query, selectedUnitId]);
  const applicableRows = rows.filter(({ row }) => row.applicable);
  const notApplicableRows = rows.filter(({ row }) => !row.applicable);

  if (units.length > 1 && !selectedUnit) return <div className="space-y-5">
    <PageHeader eyebrow="Risk register" title="Choose an organizational unit" description="Risk is assessed in context. Select the part of the organization whose scenarios and assessment values you want to review." />
    <Panel className="overflow-hidden">
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{units.map((unit) => {
        const parent = units.find((candidate) => candidate.id === unit.parentId);
        const assessments = state.assessments.filter((assessment) => assessment.unitId === unit.id);
        const rowCount = assessments.reduce((count, assessment) => count + assessment.rows.length, 0);
        return <button key={unit.id} type="button" aria-label={`Select ${unit.name}`} onClick={() => { setSelectedUnitId(unit.id); setExpandedRow(assessments[0]?.rows[0] ? `${assessments[0].id}-${assessments[0].rows[0].id}` : ""); }} className="group flex min-h-36 flex-col rounded-[14px] border border-[#e1e2e7] bg-white p-4 text-left shadow-[0_3px_12px_rgba(35,36,45,0.03)] transition hover:border-[#c9cef0] hover:bg-[#fafafe] hover:shadow-[0_6px_20px_rgba(35,36,45,0.06)]">
          <span className="flex w-full items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#eff1fb] text-[#586ad0]"><Building2 className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#30323c] group-hover:text-[#5264c3]">{unit.name}</span><span className="mt-1 block text-[10px] text-[#898c98]">{parent ? `Part of ${parent.name}` : "Top-level unit"}</span></span><ChevronDown className="mt-1 h-4 w-4 -rotate-90 text-[#a0a3ae] transition-transform group-hover:translate-x-0.5 group-hover:text-[#586ad0]" /></span>
          <span className="mt-4 line-clamp-2 text-[11px] leading-5 text-[#747884]">{unit.description || "No unit description provided."}</span>
          <span className="mt-auto flex items-center gap-2 pt-3 text-[10px] font-semibold text-[#656976]"><span>{assessments.length} assessment{assessments.length === 1 ? "" : "s"}</span><span className="text-[#c1c3ca]">·</span><span>{rowCount} register row{rowCount === 1 ? "" : "s"}</span></span>
        </button>;
      })}</div>
    </Panel>
  </div>;

  return <div className="space-y-5">
    <PageHeader eyebrow={selectedUnit?.name ?? "Structured result"} title="Risk register" description="Scan this unit’s register, then expand a scenario to review its assessment values and rationale." actions={units.length > 1 ? <button type="button" onClick={() => { setSelectedUnitId(""); setQuery(""); setExpandedRow(""); }} className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs font-semibold text-[#4c4f5b] shadow-sm hover:bg-[#f7f7f9]"><ArrowLeft className="h-3.5 w-3.5" />Change unit</button> : undefined} />
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e3e4e9] p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#858895]" /><input aria-label="Search register" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-[9px] border border-[#dedfe5] bg-white pl-9 pr-3 text-sm text-[#30323c] shadow-sm focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]" placeholder="Search scenarios, units, or periods" /></div>
        <div className="flex items-center gap-2"><div className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#e1e2e7] bg-[#f7f7f9] px-3 text-xs font-semibold text-[#555966]"><Building2 className="h-3.5 w-3.5 text-[#737bba]" />{selectedUnit?.name}</div><Badge>{applicableRows.length} in scope</Badge></div>
      </div>

      {rows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#eff1fb] text-[#586ad0]"><TableProperties className="h-5 w-5" /></div><p className="text-sm font-semibold text-[#30323c]">No assessment for {selectedUnit?.name ?? "this unit"}</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#7a7d8c]">Start an assessment to create this unit’s register rows from your configured risk scenarios.</p><Link href="/assessments/new" onClick={() => window.sessionStorage.setItem("kimsy-assessment-unit", selectedUnitId)} className="mt-4 inline-flex h-9 items-center rounded-[9px] bg-[#292a33] px-4 text-xs font-semibold text-white hover:bg-[#3a3c47]">Start assessment</Link></div> : <div className="divide-y divide-[#e7e8ec]">{applicableRows.map(({ assessment, row }) => {
        const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
        const unit = state.configuration.units.find((item) => item.id === assessment.unitId);
        const key = `${assessment.id}-${row.id}`;
        const expanded = expandedRow === key;
        const completedRequired = requiredFields.filter((field) => isPresent(row.values[field.id])).length;
        const complete = requiredFields.length > 0 && completedRequired === requiredFields.length;
        return <article key={key} className={expanded ? "bg-[#fcfcfd]" : "bg-white"}>
          <div className="grid gap-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
            <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${scenario?.title ?? "scenario"}`} onClick={() => setExpandedRow(expanded ? "" : key)} className="group flex min-w-0 items-start gap-3 text-left">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] transition-colors ${expanded ? "bg-[#e9ebfa] text-[#586ad0]" : "bg-[#f3f3f6] text-[#7d808d] group-hover:bg-[#ececf1]"}`}><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "-rotate-90"}`} /></span>
              <span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.04em] text-[#586ad0]">{scenario?.code} · {scenario?.category}</span><span className="mt-1 block truncate text-sm font-semibold text-[#30323c] group-hover:text-[#586ad0]">{scenario?.title}</span><span className="mt-1 block truncate text-[10px] text-[#858895]">{unit?.name} · {assessment.period}</span></span>
            </button>

            <div className="flex items-center gap-2 lg:min-w-[130px]">{complete ? <CheckCircle2 className="h-4 w-4 text-[#26805f]" /> : <Circle className="h-4 w-4 text-[#a1a4af]" />}<div><p className="text-[10px] font-semibold text-[#555966]">{completedRequired} of {requiredFields.length} complete</p><p className="mt-0.5 text-[9px] text-[#9699a4]">Required questions</p></div></div>

            <div className="flex items-center lg:min-w-[90px]">{finalRatingField ? <RatingValue field={finalRatingField} value={row.values[finalRatingField.id] ?? null} /> : <Badge>Not rated</Badge>}</div>

            <div className="flex items-center gap-3 lg:justify-end"><Link href={`/assessments/${assessment.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[#586ad0] hover:underline">{state.persona === "ASSESSOR" && (assessment.status === "DRAFT" || assessment.status === "RETURNED") ? "Edit assessment" : "View assessment"}<ArrowUpRight className="h-3 w-3" /></Link></div>
          </div>

          {expanded && <div className="border-t border-[#e7e8ec] bg-[#f8f8fa] px-4 py-4 sm:px-5">
            {scenario?.description && <p className="mb-4 max-w-4xl text-xs leading-5 text-[#6f7380]">{scenario.description}</p>}
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map((field) => <div key={field.id} className={`rounded-[10px] border border-[#e1e2e7] bg-white p-3 ${field.type === "LONG_TEXT" ? "sm:col-span-2 xl:col-span-3" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-[#3d404a]">{field.label}{field.required && field.type !== "CALCULATED" && <span className="ml-1 text-[#a45b53]">*</span>}</p>{field.type === "CALCULATED" && <span className="rounded-full bg-[#eff1fb] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.05em] text-[#586ad0]">Calculated</span>}</div>
                {field.helpText && <p className="mb-2 text-[9px] leading-4 text-[#888b97]">{field.helpText}</p>}
                {field.type === "CALCULATED" ? <RatingValue field={field} value={row.values[field.id] ?? null} /> : <p className={`text-xs leading-5 ${isPresent(row.values[field.id]) ? "text-[#4f525d]" : "text-[#a0a3ad]"}`}>{displayFieldValue(field, row.values[field.id] ?? null)}</p>}
                {field.type === "CALCULATED" && <p className="mt-2 text-[9px] leading-4 text-[#7a7e8b]">{explainCalculation(field.id, row.values, state.configuration)}</p>}
              </div>)}</div>
              <div className="mt-3 rounded-[10px] border border-[#e1e2e7] bg-white p-3"><p className="text-[11px] font-semibold text-[#3d404a]">Assessment rationale</p><p className={`mt-2 text-xs leading-5 ${row.rationale ? "text-[#5f626d]" : "text-[#a0a3ad]"}`}>{row.rationale || "No rationale recorded."}</p></div>
            </>
          </div>}
        </article>;
      })}{notApplicableRows.length > 0 && <section className="bg-[#fafafd]">
        <button type="button" aria-expanded={showNotApplicable} onClick={() => setShowNotApplicable((current) => !current)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"><ChevronDown className={`h-4 w-4 text-[#858895] transition-transform ${showNotApplicable ? "rotate-180" : ""}`} /><span className="text-xs font-semibold text-[#5b5e69]">Not applicable</span><Badge>{notApplicableRows.length}</Badge><span className="ml-auto text-[10px] text-[#9699a4]">Outside this unit’s current scope</span></button>
        {showNotApplicable && <div className="divide-y divide-[#e7e8ec] border-t border-[#e7e8ec]">{notApplicableRows.map(({ assessment, row }) => {
          const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
          return <div key={`${assessment.id}-${row.id}`} className="flex flex-col gap-2 bg-white px-5 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.04em] text-[#858895]">{scenario?.code} · {scenario?.category}</p><p className="mt-1 truncate text-xs font-semibold text-[#555966]">{scenario?.title}</p><p className="mt-1 text-[9px] text-[#9699a4]">{assessment.period}</p></div><Link href={`/assessments/${assessment.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#686f9f] hover:underline">{state.persona === "ASSESSOR" && (assessment.status === "DRAFT" || assessment.status === "RETURNED") ? "Edit assessment" : "View assessment"}<ArrowUpRight className="h-3 w-3" /></Link></div>;
        })}</div>}
      </section>}</div>}
    </Panel>
  </div>;
}
