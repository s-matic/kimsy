"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, Search, TableProperties } from "lucide-react";
import { displayFieldValue, FieldControl, RatingValue } from "@/components/field-control";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function RegisterPage() {
  const { state, updateRowValue, setRowApplicability } = useKimsy();
  const [query, setQuery] = useState("");
  const [unitId, setUnitId] = useState("ALL");
  const fields = state.configuration.fields;
  const rows = useMemo(() => state.assessments.flatMap((assessment) => assessment.rows.map((row) => ({ assessment, row }))).filter(({ assessment, row }) => {
    const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
    const unit = state.configuration.units.find((item) => item.id === assessment.unitId);
    const haystack = `${scenario?.code} ${scenario?.title} ${scenario?.category} ${unit?.name} ${assessment.period}`.toLowerCase();
    return (unitId === "ALL" || assessment.unitId === unitId) && haystack.includes(query.toLowerCase());
  }), [state.assessments, state.configuration.scenarios, state.configuration.units, query, unitId]);

  return <div className="space-y-5">
    <PageHeader eyebrow="Structured result" title="Risk register" description="The familiar spreadsheet view, with your own fields and deterministic calculations. Edit source values inline; calculated ratings update immediately." />
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e2e7e5] p-4 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7d8984]" /><input aria-label="Search register" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-[5px] border border-[#d4dcd8] pl-9 pr-3 text-sm focus:border-[#0f766e] focus:outline-none" placeholder="Search scenarios, units, or periods" /></div><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-[#74817c]" /><select aria-label="Filter organizational unit" value={unitId} onChange={(event) => setUnitId(event.target.value)} className="h-9 rounded-[5px] border border-[#d4dcd8] bg-white px-2.5 text-xs font-semibold"><option value="ALL">All units</option>{state.configuration.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><Badge>{rows.length} rows</Badge></div></div>
      {rows.length === 0 ? <EmptyState icon={<TableProperties className="h-5 w-5" />} title="No register rows yet" description="Create an assessment to generate one row for each configured scenario." /> : <div className="overflow-x-auto"><table className="min-w-max border-collapse text-left"><thead><tr className="border-b border-[#dfe5e2] bg-[#f8faf9] text-[10px] font-bold uppercase tracking-[0.05em] text-[#71807a]"><th className="sticky left-0 z-10 min-w-[280px] border-r border-[#dfe5e2] bg-[#f8faf9] px-4 py-3">Scope and scenario</th><th className="min-w-[110px] px-3 py-3">Applicable</th>{fields.map((field) => <th key={field.id} className="min-w-[170px] px-3 py-3"><span title={field.helpText}>{field.label}</span></th>)}<th className="min-w-[260px] px-3 py-3">Rationale</th></tr></thead><tbody>{rows.map(({ assessment, row }) => {
        const scenario = state.configuration.scenarios.find((item) => item.id === row.scenarioId);
        const unit = state.configuration.units.find((item) => item.id === assessment.unitId);
        const editable = state.persona === "ASSESSOR" && (assessment.status === "DRAFT" || assessment.status === "RETURNED");
        return <tr key={`${assessment.id}-${row.id}`} className="border-b border-[#e7ebe9] align-top last:border-b-0"><td className="sticky left-0 z-10 border-r border-[#e2e7e5] bg-white px-4 py-3"><Link href={`/assessments/${assessment.id}`} className="group block"><p className="text-[10px] font-bold text-[#0f766e]">{scenario?.code} · {scenario?.category}</p><p className="mt-1 text-xs font-semibold text-[#27332f] group-hover:text-[#0f766e]">{scenario?.title}</p><p className="mt-1 text-[10px] text-[#7c8883]">{unit?.name} · {assessment.period}</p><span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#65736d]">Open assessment<ArrowUpRight className="h-3 w-3" /></span></Link></td><td className="px-3 py-3"><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={row.applicable} disabled={!editable} onChange={(event) => setRowApplicability(assessment.id, row.id, event.target.checked)} className="h-4 w-4 accent-[#0f766e]" />{row.applicable ? "Yes" : "No"}</label></td>{fields.map((field) => <td key={field.id} className="px-3 py-3">{editable ? <FieldControl compact field={field} value={row.values[field.id] ?? null} onChange={(value) => updateRowValue(assessment.id, row.id, field.id, value)} /> : field.type === "CALCULATED" ? <RatingValue field={field} value={row.values[field.id] ?? null} /> : <span className="text-xs text-[#4f5d57]">{displayFieldValue(field, row.values[field.id] ?? null)}</span>}</td>)}<td className="px-3 py-3 text-xs leading-5 text-[#596761]">{row.rationale || <span className="text-[#97a19d]">No rationale yet</span>}</td></tr>;
      })}</tbody></table></div>}
    </Panel>
    <p className="text-[11px] text-[#77837e]">Spreadsheet import is available during setup. Export is intentionally deferred from this local-first slice.</p>
  </div>;
}
