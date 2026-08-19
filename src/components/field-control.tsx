"use client";

import { Badge } from "@/components/ui";
import type { FieldDefinition, FieldValue } from "@/lib/types";

export function displayFieldValue(field: FieldDefinition, value: FieldValue) {
  if (value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => field.options.find((option) => option.id === item)?.label ?? item).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return field.options.find((option) => option.id === value)?.label ?? value;
  return String(value);
}

export function RatingValue({ field, value }: { field: FieldDefinition; value: FieldValue }) {
  const option = field.options.find((item) => item.id === value);
  const score = option?.score ?? 0;
  const tone = score >= 4 ? "critical" : score >= 3 ? "danger" : score >= 2 ? "warning" : value ? "success" : "neutral";
  return <Badge tone={tone}>{displayFieldValue(field, value)}</Badge>;
}

export function FieldControl({
  field,
  value,
  onChange,
  compact = false,
}: {
  field: FieldDefinition;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  compact?: boolean;
}) {
  const base = `${compact ? "h-9 text-xs" : "h-10 text-sm"} w-full rounded-[5px] border border-[#cfd8d4] bg-white px-2.5 text-[#27332f] focus:border-[#0f766e] focus:outline-none`;
  if (field.type === "CALCULATED") return <div className="flex min-h-9 items-center"><RatingValue field={field} value={value} /></div>;
  if (field.type === "BOOLEAN") return <label className="inline-flex min-h-9 items-center gap-2 text-xs text-[#51605a]"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#0f766e]" />{value ? "Yes" : "No"}</label>;
  if (field.type === "SINGLE_SELECT") return <select aria-label={field.label} className={base} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || null)}><option value="">Choose…</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
  if (field.type === "MULTI_SELECT") return <select multiple aria-label={field.label} className={`${base} ${compact ? "min-h-16" : "min-h-24"}`} value={Array.isArray(value) ? value : []} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}>{field.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
  if (field.type === "NUMBER") return <input aria-label={field.label} type="number" className={base} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />;
  if (field.type === "LONG_TEXT") return <textarea aria-label={field.label} rows={compact ? 2 : 4} className={`${base} h-auto resize-y py-2`} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
  return <input aria-label={field.label} className={base} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}
