"use client";

import { useState } from "react";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Plus,
  Trash2,
} from "lucide-react";
import { calculationValidationErrors } from "@/lib/scoring";
import type {
  CalculationDefinition,
  FieldDefinition,
  FieldValue,
  MatrixCalculation,
  ThresholdCalculation,
  WorkspaceConfiguration,
} from "@/lib/types";

interface CalculationMethodEditorProps {
  configuration: WorkspaceConfiguration;
  setConfiguration: (configuration: WorkspaceConfiguration) => void;
}

function controlClass() {
  return "h-10 w-full rounded-[9px] border border-[#dedfe5] bg-white px-3 text-xs text-[#30323c] shadow-sm focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]";
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function fieldName(configuration: WorkspaceConfiguration, fieldId: string) {
  return configuration.fields.find((field) => field.id === fieldId)?.label || fieldId || "Choose a field";
}

function matrixInputFields(configuration: WorkspaceConfiguration, outputFieldId: string) {
  return configuration.fields.filter((field) => field.id !== outputFieldId && field.type !== "MULTI_SELECT" && field.options.length > 0);
}

function weightedInputFields(configuration: WorkspaceConfiguration, outputFieldId: string) {
  return configuration.fields.filter((field) => field.id !== outputFieldId && (
    field.type === "NUMBER" || (field.type !== "MULTI_SELECT" && field.options.length > 0 && field.options.every((option) => typeof option.score === "number"))
  ));
}

function calculationUsesField(calculation: CalculationDefinition, fieldId: string) {
  return calculation.type === "MATRIX"
    ? calculation.rowFieldId === fieldId || calculation.columnFieldId === fieldId
    : calculation.terms.some((term) => term.fieldId === fieldId);
}

function resultLabel(field: FieldDefinition | undefined, value: FieldValue | undefined) {
  if (value === undefined || value === null || value === "") return "Not configured";
  return field?.options.find((option) => option.id === value || option.label === value)?.label ?? String(value);
}

function rebuildMatrixCells(configuration: WorkspaceConfiguration, calculation: MatrixCalculation, rowFieldId: string, columnFieldId: string) {
  const rows = configuration.fields.find((field) => field.id === rowFieldId)?.options ?? [];
  const columns = configuration.fields.find((field) => field.id === columnFieldId)?.options ?? [];
  return rows.flatMap((row) => columns.map((column) => ({
    rowValue: row.id,
    columnValue: column.id,
    result: calculation.cells.find((cell) => cell.rowValue === row.id && cell.columnValue === column.id)?.result ?? "",
  })));
}

function thresholdScoresCovered(calculation: ThresholdCalculation, configuration: WorkspaceConfiguration) {
  let totals = [0];
  for (const term of calculation.terms) {
    const field = configuration.fields.find((candidate) => candidate.id === term.fieldId);
    if (!field || field.type === "NUMBER") return true;
    const scores = field.options.map((option) => option.score).filter((score): score is number => typeof score === "number");
    if (!scores.length || scores.length !== field.options.length || totals.length * scores.length > 4096) return true;
    totals = [...new Set(totals.flatMap((total) => scores.map((score) => total + score * term.weight)))];
  }
  return totals.every((score) => calculation.bands.some((band) => score >= band.min && score <= band.max));
}

function calculationReady(calculation: CalculationDefinition, configuration: WorkspaceConfiguration) {
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  if (!output || output.type !== "CALCULATED" || !output.options.length) return false;
  const validResults = new Set(output.options.map((option) => option.id));
  if (calculation.type === "MATRIX") {
    const row = configuration.fields.find((field) => field.id === calculation.rowFieldId);
    const column = configuration.fields.find((field) => field.id === calculation.columnFieldId);
    if (!row?.options.length || !column?.options.length || row.id === column.id) return false;
    return row.options.every((rowOption) => column.options.every((columnOption) => {
      const cells = calculation.cells.filter((item) => item.rowValue === rowOption.id && item.columnValue === columnOption.id);
      return cells.length === 1 && validResults.has(String(cells[0].result));
    }));
  }
  if (!calculation.terms.length || !calculation.bands.length) return false;
  const sorted = [...calculation.bands].sort((left, right) => left.min - right.min);
  const termIds = new Set(calculation.terms.map((term) => term.fieldId));
  return termIds.size === calculation.terms.length
    && calculation.terms.every((term) => {
      const field = configuration.fields.find((candidate) => candidate.id === term.fieldId);
      return field && field.id !== calculation.outputFieldId && field.type !== "MULTI_SELECT" && (field.type === "NUMBER" || (field.options.length > 0 && field.options.every((option) => typeof option.score === "number"))) && Number.isFinite(term.weight) && term.weight > 0;
    })
    && calculation.bands.every((band) => Number.isFinite(band.min) && Number.isFinite(band.max) && band.min <= band.max && validResults.has(String(band.result)))
    && sorted.slice(1).every((band, index) => band.min > sorted[index].max)
    && thresholdScoresCovered(calculation, configuration);
}

function OutputOptionsInput({ field, onChange }: { field: FieldDefinition; onChange: (field: FieldDefinition) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const serialized = field.options.map((option) => option.label).join(", ");
  const update = (value: string) => {
    setDraft(value);
    const labels = value.split(",").map((label) => label.trim()).filter(Boolean);
    onChange({
      ...field,
      options: labels.map((label, index) => ({
        id: field.options[index]?.id ?? slug(label),
        label,
        score: field.options[index]?.score ?? index + 1,
      })),
    });
  };
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Possible results</span><input aria-label={`Possible results for ${field.label}`} className={controlClass()} value={draft ?? serialized} onChange={(event) => update(event.target.value)} onBlur={() => setDraft(null)} placeholder="Low, Moderate, High, Severe" /></label>;
}

function MatrixPreview({ calculation, configuration }: { calculation: MatrixCalculation; configuration: WorkspaceConfiguration }) {
  const row = configuration.fields.find((field) => field.id === calculation.rowFieldId);
  const column = configuration.fields.find((field) => field.id === calculation.columnFieldId);
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  const [selectedRow, setSelectedRow] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const rowValue = row?.options.some((option) => option.id === selectedRow) ? selectedRow : row?.options[0]?.id ?? "";
  const columnValue = column?.options.some((option) => option.id === selectedColumn) ? selectedColumn : column?.options[0]?.id ?? "";
  const result = calculation.cells.find((cell) => cell.rowValue === rowValue && cell.columnValue === columnValue)?.result;
  if (!row?.options.length || !column?.options.length) return null;
  return <div className="rounded-[10px] border border-[#dfe2ee] bg-[#f7f8fc] p-3">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#73798f]"><FlaskConical className="h-3.5 w-3.5" />Test the logic</div>
    <div className="mt-2 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_minmax(90px,auto)]">
      <select aria-label={`Test ${row.label}`} className={controlClass()} value={rowValue} onChange={(event) => setSelectedRow(event.target.value)}>{row.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      <span className="text-xs text-[#838795]">×</span>
      <select aria-label={`Test ${column.label}`} className={controlClass()} value={columnValue} onChange={(event) => setSelectedColumn(event.target.value)}>{column.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
      <span className="text-xs text-[#838795]">→</span>
      <span data-testid="calculation-preview-result" className={`rounded-[8px] px-3 py-2 text-center text-xs font-semibold ${result ? "bg-[#eaf7f1] text-[#176b4b]" : "bg-[#fff4e5] text-[#8a6417]"}`}>{resultLabel(output, result)}</span>
    </div>
  </div>;
}

function MatrixEditor({ calculation, configuration, onChange }: { calculation: MatrixCalculation; configuration: WorkspaceConfiguration; onChange: (calculation: MatrixCalculation) => void }) {
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  const inputs = matrixInputFields(configuration, calculation.outputFieldId);
  const row = inputs.find((field) => field.id === calculation.rowFieldId);
  const column = inputs.find((field) => field.id === calculation.columnFieldId);
  const validResults = new Set(output?.options.map((option) => option.id) ?? []);
  const expectedCount = (row?.options.length ?? 0) * (column?.options.length ?? 0);
  const completedCount = row && column ? row.options.flatMap((rowOption) => column.options.map((columnOption) => calculation.cells.find((cell) => cell.rowValue === rowOption.id && cell.columnValue === columnOption.id))).filter((cell) => cell && validResults.has(String(cell.result))).length : 0;
  const updateSource = (position: "row" | "column", fieldId: string) => {
    const nextRow = position === "row" ? fieldId : calculation.rowFieldId;
    const nextColumn = position === "column" ? fieldId : calculation.columnFieldId;
    onChange({
      ...calculation,
      rowFieldId: nextRow,
      columnFieldId: nextColumn,
      cells: rebuildMatrixCells(configuration, calculation, nextRow, nextColumn),
    });
  };
  const updateCell = (rowValue: string, columnValue: string, result: string) => onChange({
    ...calculation,
    cells: [
      ...calculation.cells.filter((cell) => cell.rowValue !== rowValue || cell.columnValue !== columnValue),
      { rowValue, columnValue, result },
    ],
  });

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Rows</span><select aria-label={`Row input for ${output?.label || calculation.id}`} className={controlClass()} value={calculation.rowFieldId} onChange={(event) => updateSource("row", event.target.value)}><option value="">Choose input…</option>{inputs.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Columns</span><select aria-label={`Column input for ${output?.label || calculation.id}`} className={controlClass()} value={calculation.columnFieldId} onChange={(event) => updateSource("column", event.target.value)}><option value="">Choose input…</option>{inputs.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label></div>
    {row && column && row.id === column.id && <p className="flex items-center gap-2 rounded-[8px] border border-[#ead5a5] bg-[#fffaf0] px-3 py-2 text-xs text-[#7b5b1d]"><AlertCircle className="h-3.5 w-3.5" />Choose two different inputs.</p>}
    {row?.options.length && column?.options.length ? <div>
      <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#3a3d47]">Lookup matrix</p><p className="mt-0.5 text-[10px] text-[#7e828f]">Choose the resulting rating for every combination.</p></div><span className={`text-[10px] font-semibold ${completedCount === expectedCount ? "text-[#26805f]" : "text-[#9a6b20]"}`}>{completedCount} of {expectedCount} mapped</span></div>
      <div className="overflow-x-auto rounded-[10px] border border-[#e1e3e8] bg-white"><table className="min-w-full border-collapse text-xs"><thead><tr><th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-[#e5e6ea] bg-[#f6f7f9] px-3 py-2 text-left text-[9px] font-bold uppercase tracking-[0.07em] text-[#7c808d]">{row.label} ↓ / {column.label} →</th>{column.options.map((option) => <th key={option.id} className="min-w-[130px] border-b border-r border-[#e5e6ea] bg-[#f6f7f9] px-3 py-2 text-left text-[10px] font-semibold text-[#555966] last:border-r-0">{option.label}</th>)}</tr></thead><tbody>{row.options.map((rowOption) => <tr key={rowOption.id}><th className="sticky left-0 z-10 border-b border-r border-[#e7e8eb] bg-[#fbfbfc] px-3 py-2 text-left text-[10px] font-semibold text-[#555966] last:border-b-0">{rowOption.label}</th>{column.options.map((columnOption) => { const cell = calculation.cells.find((item) => item.rowValue === rowOption.id && item.columnValue === columnOption.id); return <td key={columnOption.id} className="border-b border-r border-[#e7e8eb] p-1.5 last:border-r-0"><select aria-label={`${output?.label || "Result"}: ${rowOption.label} and ${columnOption.label}`} value={String(cell?.result ?? "")} onChange={(event) => updateCell(rowOption.id, columnOption.id, event.target.value)} className="h-9 min-w-[115px] w-full rounded-[7px] border border-[#dedfe5] bg-white px-2 text-[11px] text-[#353843] focus:border-[#7785d8] focus:outline-none"><option value="">Choose…</option>{output?.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></td>; })}</tr>)}</tbody></table></div>
    </div> : <p className="rounded-[9px] border border-dashed border-[#d6d9e1] px-4 py-6 text-center text-xs text-[#7a7e8b]">Choose two fields with options to build the matrix.</p>}
    <MatrixPreview calculation={calculation} configuration={configuration} />
  </div>;
}

function previewScore(field: FieldDefinition | undefined, value: string | number) {
  if (typeof value === "number") return value;
  return field?.options.find((option) => option.id === value)?.score ?? null;
}

function ThresholdPreview({ calculation, configuration }: { calculation: ThresholdCalculation; configuration: WorkspaceConfiguration }) {
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const resolved = calculation.terms.map((term) => {
    const field = configuration.fields.find((candidate) => candidate.id === term.fieldId);
    const value = values[term.fieldId] ?? (field?.type === "NUMBER" ? 0 : field?.options[0]?.id ?? "");
    return { term, field, value, score: previewScore(field, value) };
  });
  const complete = resolved.every((item) => item.score !== null);
  const total = complete ? resolved.reduce((sum, item) => sum + (item.score ?? 0) * item.term.weight, 0) : null;
  const band = total === null ? undefined : calculation.bands.find((candidate) => total >= candidate.min && total <= candidate.max);
  if (!calculation.terms.length) return null;
  return <div className="rounded-[10px] border border-[#dfe2ee] bg-[#f7f8fc] p-3">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#73798f]"><FlaskConical className="h-3.5 w-3.5" />Test the logic</div>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{resolved.map(({ term, field, value }) => <label key={term.fieldId}><span className="mb-1 block text-[9px] font-semibold text-[#777b88]">{field?.label || term.fieldId}</span>{field?.type === "NUMBER" ? <input type="number" aria-label={`Test ${field.label}`} className={controlClass()} value={value} onChange={(event) => setValues((current) => ({ ...current, [term.fieldId]: Number(event.target.value) }))} /> : <select aria-label={`Test ${field?.label || term.fieldId}`} className={controlClass()} value={value} onChange={(event) => setValues((current) => ({ ...current, [term.fieldId]: event.target.value }))}>{field?.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>}</label>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-[#737784]">Weighted score</span><span className="rounded-[7px] bg-white px-2.5 py-1.5 font-semibold text-[#343741] shadow-sm">{total === null ? "—" : Number(total.toFixed(3))}</span><span className="text-[#838795]">→</span><span data-testid="calculation-preview-result" className={`rounded-[7px] px-2.5 py-1.5 font-semibold ${band ? "bg-[#eaf7f1] text-[#176b4b]" : "bg-[#fff4e5] text-[#8a6417]"}`}>{resultLabel(output, band?.result)}</span></div>
  </div>;
}

function ThresholdEditor({ calculation, configuration, onChange, onFieldChange }: {
  calculation: ThresholdCalculation;
  configuration: WorkspaceConfiguration;
  onChange: (calculation: ThresholdCalculation) => void;
  onFieldChange: (field: FieldDefinition) => void;
}) {
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  const inputs = weightedInputFields(configuration, calculation.outputFieldId);
  const addTerm = () => {
    const available = inputs.find((field) => !calculation.terms.some((term) => term.fieldId === field.id));
    if (available) onChange({ ...calculation, terms: [...calculation.terms, { fieldId: available.id, weight: 1 }] });
  };
  const addBand = () => {
    const lastMaximum = calculation.bands.length ? Math.max(...calculation.bands.map((band) => band.max)) : 0;
    onChange({ ...calculation, bands: [...calculation.bands, { min: lastMaximum + (calculation.bands.length ? 0.01 : 0), max: lastMaximum + 1, result: "" }] });
  };
  return <div className="space-y-4">
    <div><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#3a3d47]">Weighted inputs</p><p className="mt-0.5 text-[10px] text-[#7e828f]">Each selected value’s numeric score is multiplied by its weight.</p></div><button type="button" onClick={addTerm} disabled={!inputs.some((field) => !calculation.terms.some((term) => term.fieldId === field.id))} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#586ad0] disabled:opacity-40"><Plus className="h-3 w-3" />Add input</button></div>
      <div className="mt-2 space-y-2">{calculation.terms.map((term, index) => {
        const field = configuration.fields.find((candidate) => candidate.id === term.fieldId);
        return <div key={`${term.fieldId}-${index}`} className="rounded-[9px] border border-[#e3e4e9] bg-white p-2.5">
          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_120px_34px]">
            <label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.07em] text-[#858895]">Input</span><select aria-label={`Weighted input ${index + 1} for ${output?.label || calculation.id}`} className={controlClass()} value={term.fieldId} onChange={(event) => onChange({ ...calculation, terms: calculation.terms.map((item, itemIndex) => itemIndex === index ? { ...item, fieldId: event.target.value } : item) })}>{inputs.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>
            <label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.07em] text-[#858895]">Weight</span><input type="number" min="0.01" step="0.01" aria-label={`Weight for ${fieldName(configuration, term.fieldId)}`} className={controlClass()} value={term.weight} onChange={(event) => onChange({ ...calculation, terms: calculation.terms.map((item, itemIndex) => itemIndex === index ? { ...item, weight: Number(event.target.value) } : item) })} /></label>
            <button type="button" aria-label={`Remove weighted input ${fieldName(configuration, term.fieldId)}`} onClick={() => onChange({ ...calculation, terms: calculation.terms.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-10 items-center justify-center rounded-[8px] text-[#9a6964] hover:bg-[#fff2f0]"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {field && field.type !== "NUMBER" && <div className="mt-2 border-t border-[#ececf0] pt-2">
            <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.07em] text-[#858895]">Option scores</p><p className="text-[9px] text-[#9295a0]">Value used before × {term.weight}</p></div>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">{field.options.map((option, optionIndex) => <label key={option.id} className="flex items-center justify-between gap-2 rounded-[7px] bg-[#f7f7f9] px-2.5 py-1.5"><span className="min-w-0 truncate text-[10px] text-[#555966]">{option.label}</span><input type="number" step="0.01" aria-label={`Score for ${field.label} option ${option.label}`} className="h-8 w-20 rounded-[7px] border border-[#dedfe5] bg-white px-2 text-right text-[11px] text-[#353843] focus:border-[#7785d8] focus:outline-none" value={option.score ?? ""} onChange={(event) => onFieldChange({ ...field, options: field.options.map((candidate, candidateIndex) => candidateIndex === optionIndex ? { ...candidate, score: event.target.value === "" ? undefined : Number(event.target.value) } : candidate) })} /></label>)}</div>
          </div>}
        </div>;
      })}</div>
    </div>
    <div><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#3a3d47]">Rating bands</p><p className="mt-0.5 text-[10px] text-[#7e828f]">Map ranges of weighted scores to the final result.</p></div><button type="button" onClick={addBand} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#586ad0]"><Plus className="h-3 w-3" />Add band</button></div>
      <div className="mt-2 overflow-hidden rounded-[9px] border border-[#e3e4e9] bg-white"><div className="hidden grid-cols-[1fr_1fr_1.3fr_34px] gap-2 border-b border-[#e7e8eb] bg-[#f7f7f9] px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.07em] text-[#858895] sm:grid"><span>Minimum</span><span>Maximum</span><span>Result</span><span /></div>{calculation.bands.map((band, index) => <div key={index} className="grid grid-cols-[1fr_1fr_1.3fr_34px] items-center gap-2 border-b border-[#e9eaed] p-2.5 last:border-b-0"><input type="number" step="0.01" aria-label={`Minimum for rating band ${index + 1}`} className={controlClass()} value={band.min} onChange={(event) => onChange({ ...calculation, bands: calculation.bands.map((item, itemIndex) => itemIndex === index ? { ...item, min: Number(event.target.value) } : item) })} /><input type="number" step="0.01" aria-label={`Maximum for rating band ${index + 1}`} className={controlClass()} value={band.max} onChange={(event) => onChange({ ...calculation, bands: calculation.bands.map((item, itemIndex) => itemIndex === index ? { ...item, max: Number(event.target.value) } : item) })} /><select aria-label={`Result for rating band ${index + 1}`} className={controlClass()} value={String(band.result ?? "")} onChange={(event) => onChange({ ...calculation, bands: calculation.bands.map((item, itemIndex) => itemIndex === index ? { ...item, result: event.target.value } : item) })}><option value="">Choose…</option>{output?.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button type="button" aria-label={`Remove rating band ${index + 1}`} onClick={() => onChange({ ...calculation, bands: calculation.bands.filter((_, itemIndex) => itemIndex !== index) })} className="flex h-10 items-center justify-center rounded-[8px] text-[#9a6964] hover:bg-[#fff2f0]"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
    </div>
    <ThresholdPreview calculation={calculation} configuration={configuration} />
  </div>;
}

function CalculationCard({ calculation, configuration, expanded, onToggle, onChange, onFieldChange, onDelete, deleteBlocked = false }: {
  calculation: CalculationDefinition;
  configuration: WorkspaceConfiguration;
  expanded: boolean;
  onToggle: () => void;
  onChange: (calculation: CalculationDefinition) => void;
  onFieldChange: (field: FieldDefinition) => void;
  onDelete: () => void;
  deleteBlocked?: boolean;
}) {
  const output = configuration.fields.find((field) => field.id === calculation.outputFieldId);
  const outputsUsedElsewhere = new Set(configuration.calculations.filter((candidate) => candidate.id !== calculation.id).map((candidate) => candidate.outputFieldId));
  const outputFields = configuration.fields.filter((field) => field.type === "CALCULATED" && (field.id === calculation.outputFieldId || !outputsUsedElsewhere.has(field.id)));
  const ready = calculationReady(calculation, configuration);
  const formula = calculation.type === "MATRIX"
    ? `${output?.label || "Calculated result"} = ${fieldName(configuration, calculation.rowFieldId)} × ${fieldName(configuration, calculation.columnFieldId)}`
    : `${output?.label || "Calculated result"} = ${calculation.terms.length ? calculation.terms.map((term) => `${fieldName(configuration, term.fieldId)} × ${term.weight}`).join(" + ") : "weighted inputs"}`;
  const changeMethod = (method: "MATRIX" | "THRESHOLD") => {
    if (method === calculation.type) return;
    if (method === "MATRIX") {
      const inputs = matrixInputFields(configuration, calculation.outputFieldId);
      const base: MatrixCalculation = { id: calculation.id, type: "MATRIX", outputFieldId: calculation.outputFieldId, rowFieldId: inputs[0]?.id ?? "", columnFieldId: inputs[1]?.id ?? "", cells: [] };
      onChange({ ...base, cells: rebuildMatrixCells(configuration, base, base.rowFieldId, base.columnFieldId) });
    } else {
      const inputs = weightedInputFields(configuration, calculation.outputFieldId);
      onChange({ id: calculation.id, type: "THRESHOLD", outputFieldId: calculation.outputFieldId, terms: inputs[0] ? [{ fieldId: inputs[0].id, weight: 1 }] : [], bands: [] });
    }
  };

  return <section className="overflow-hidden rounded-[12px] border border-[#dfe1e8] bg-white shadow-[0_4px_16px_rgba(35,36,45,0.04)]" aria-label={`Calculation for ${output?.label || calculation.id}`}>
    <div className="flex items-start gap-3 px-3.5 py-3.5 sm:px-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eff1fb] text-[#586ad0]"><Calculator className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-[#30323c]">{output?.label || "Unknown calculated field"}</p><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${ready ? "bg-[#eaf7f1] text-[#247354]" : "bg-[#fff4e5] text-[#8a6417]"}`}>{ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{ready ? "Ready" : "Needs review"}</span></div><p className="mt-1 truncate font-mono text-[10px] text-[#717584]">{formula}</p></div><span className="hidden rounded-full border border-[#dfe1e8] bg-[#f8f8fa] px-2.5 py-1 text-[9px] font-semibold text-[#6f7380] sm:inline">{calculation.type === "MATRIX" ? "Lookup matrix" : "Weighted thresholds"}</span><button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} calculation for ${output?.label || calculation.id}`} aria-expanded={expanded} onClick={onToggle} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#777b88] hover:bg-[#f3f4f7]"><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button></div>
    {expanded && <div className="space-y-5 border-t border-[#e8e9ed] bg-[#fcfcfd] p-3.5 sm:p-4">
      <div className="rounded-[10px] border border-[#dfe2ee] bg-[#f4f5fb] px-3 py-2.5"><p className="text-[10px] font-semibold text-[#545c91]">How this value is calculated</p><p className="mt-1 text-xs leading-5 text-[#555967]">{calculation.type === "MATRIX" ? "The selected row and column values meet in the lookup table below. That cell becomes the calculated result." : "Each input score is multiplied by its weight. The total is then matched to a rating band."}</p></div>
      <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Result field</span><select aria-label={`Result field for ${calculation.id}`} className={controlClass()} value={calculation.outputFieldId} onChange={(event) => onChange({ ...calculation, outputFieldId: event.target.value })}><option value="">Choose result…</option>{outputFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Method</span><select aria-label={`Calculation method for ${output?.label || calculation.id}`} className={controlClass()} value={calculation.type} onChange={(event) => changeMethod(event.target.value as "MATRIX" | "THRESHOLD")}><option value="MATRIX">Lookup matrix</option><option value="THRESHOLD">Weighted score and thresholds</option></select></label></div>
      {output && <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Calculated field name</span><input aria-label={`Calculated field name for ${calculation.id}`} className={controlClass()} value={output.label} onChange={(event) => onFieldChange({ ...output, label: event.target.value })} /></label><OutputOptionsInput field={output} onChange={onFieldChange} /><label className="sm:col-span-2"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Explanation shown to assessors</span><input aria-label={`Explanation for ${output.label}`} className={controlClass()} value={output.helpText} onChange={(event) => onFieldChange({ ...output, helpText: event.target.value })} placeholder="Explain what this calculated rating represents" /></label></div>}
      {calculation.type === "MATRIX" ? <MatrixEditor calculation={calculation} configuration={configuration} onChange={onChange} /> : <ThresholdEditor calculation={calculation} configuration={configuration} onChange={onChange} onFieldChange={onFieldChange} />}
      <div className="flex justify-end border-t border-[#e8e9ed] pt-3"><button type="button" onClick={onDelete} disabled={deleteBlocked} title={deleteBlocked ? "This result is used by another calculation." : undefined} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#985e59] disabled:cursor-not-allowed disabled:text-[#a6a8b0]"><Trash2 className="h-3.5 w-3.5" />{deleteBlocked ? "Used by another calculation" : "Delete calculated field"}</button></div>
    </div>}
  </section>;
}

export function CalculationMethodEditor({ configuration, setConfiguration }: CalculationMethodEditorProps) {
  const [expandedId, setExpandedId] = useState(configuration.calculations[0]?.id ?? "");
  const updateCalculation = (next: CalculationDefinition) => setConfiguration({ ...configuration, calculations: configuration.calculations.map((calculation) => calculation.id === next.id ? next : calculation) });
  const updateField = (next: FieldDefinition) => setConfiguration({ ...configuration, fields: configuration.fields.map((field) => field.id === next.id ? next : field) });
  const addCalculation = () => {
    const usedOutputs = new Set(configuration.calculations.map((calculation) => calculation.outputFieldId));
    let output = configuration.fields.find((field) => field.type === "CALCULATED" && !usedOutputs.has(field.id));
    let fields = configuration.fields;
    if (!output) {
      const id = `calculated-${Date.now()}`;
      output = { id, label: "New calculated rating", helpText: "", type: "CALCULATED", required: true, options: [
        { id: "low", label: "Low", score: 1 },
        { id: "moderate", label: "Moderate", score: 2 },
        { id: "high", label: "High", score: 3 },
        { id: "severe", label: "Severe", score: 4 },
      ] };
      fields = [...fields, output];
    }
    const nextConfiguration = { ...configuration, fields };
    const inputs = matrixInputFields(nextConfiguration, output.id);
    const id = `calculation-${Date.now()}`;
    const base: MatrixCalculation = { id, type: "MATRIX", outputFieldId: output.id, rowFieldId: inputs[0]?.id ?? "", columnFieldId: inputs[1]?.id ?? "", cells: [] };
    const calculation = { ...base, cells: rebuildMatrixCells(nextConfiguration, base, base.rowFieldId, base.columnFieldId) };
    setConfiguration({ ...nextConfiguration, calculations: [...configuration.calculations, calculation], finalRatingFieldId: configuration.finalRatingFieldId || output.id });
    setExpandedId(id);
  };
  const deleteCalculation = (calculation: CalculationDefinition) => {
    const usedByAnotherCalculation = configuration.calculations.some((candidate) => candidate.id !== calculation.id && calculationUsesField(candidate, calculation.outputFieldId));
    if (usedByAnotherCalculation) return;
    const fields = configuration.fields.filter((field) => field.id !== calculation.outputFieldId);
    const fallbackFinalRating = fields.find((field) => field.type === "CALCULATED")?.id ?? fields.find((field) => field.type === "SINGLE_SELECT")?.id ?? "";
    setConfiguration({ ...configuration, fields, calculations: configuration.calculations.filter((candidate) => candidate.id !== calculation.id), finalRatingFieldId: configuration.finalRatingFieldId === calculation.outputFieldId ? fallbackFinalRating : configuration.finalRatingFieldId });
    setExpandedId("");
  };

  const configuredOutputs = new Set(configuration.calculations.map((calculation) => calculation.outputFieldId));
  const unconfigured = configuration.fields.filter((field) => field.type === "CALCULATED" && !configuredOutputs.has(field.id));
  const validationErrors = calculationValidationErrors(configuration);
  return <div className="space-y-3">
    <div className="flex flex-col gap-3 rounded-[11px] border border-[#dfe2ee] bg-[#f4f5fb] p-3.5 sm:flex-row sm:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#586ad0] shadow-sm"><Calculator className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#353844]">Calculated ratings use visible, deterministic rules</p><p className="mt-1 text-[10px] leading-4 text-[#727786]">Kimsy can draft the logic, but every input, matrix cell, weight, and rating band remains editable.</p></div><button type="button" onClick={addCalculation} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[9px] bg-[#292a33] px-3 text-[11px] font-semibold text-white hover:bg-[#3a3c47]"><Plus className="h-3.5 w-3.5" />Add calculated rating</button></div>
    {unconfigured.length > 0 && <div className="rounded-[9px] border border-[#ead5a5] bg-[#fffaf0] px-3 py-2 text-xs text-[#7b5b1d]">{unconfigured.map((field) => field.label).join(", ")} {unconfigured.length === 1 ? "needs" : "need"} a calculation method. “Add calculated rating” will configure {unconfigured.length === 1 ? "it" : "the first one"}.</div>}
    <div className="space-y-2">{configuration.calculations.map((calculation) => <CalculationCard key={calculation.id} calculation={calculation} configuration={configuration} expanded={expandedId === calculation.id} onToggle={() => setExpandedId((current) => current === calculation.id ? "" : calculation.id)} onChange={updateCalculation} onFieldChange={updateField} onDelete={() => deleteCalculation(calculation)} deleteBlocked={configuration.calculations.some((candidate) => candidate.id !== calculation.id && calculationUsesField(candidate, calculation.outputFieldId))} />)}{!configuration.calculations.length && <p className="rounded-[9px] border border-dashed border-[#d6d9e1] px-4 py-7 text-center text-xs text-[#7a7e8b]">No calculated ratings yet. Add one to define how risk ratings are derived.</p>}</div>
    {validationErrors.length > 0 && <div data-testid="calculation-checks" className="rounded-[9px] border border-[#ead5a5] bg-[#fffaf0] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a6417]">Calculation checks</p><ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-[#735d32]">{validationErrors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <label className="block"><span className="text-xs font-semibold text-[#42504a]">Final rating shown in the register</span><select aria-label="Final rating field" className={`${controlClass()} mt-2`} value={configuration.finalRatingFieldId} onChange={(event) => setConfiguration({ ...configuration, finalRatingFieldId: event.target.value })}><option value="">Choose final rating…</option>{configuration.fields.filter((field) => field.type === "CALCULATED" || field.type === "SINGLE_SELECT").map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
  </div>;
}
