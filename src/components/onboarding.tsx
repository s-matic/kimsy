"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileUp,
  GitBranch,
  KeyRound,
  Network,
  Plus,
  Rows3,
  Send,
  Sparkles,
  TableProperties,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui";
import { validateConfiguration } from "@/lib/scoring";
import { starterConfiguration } from "@/lib/seed";
import { useKimsy } from "@/lib/store";
import { readJsonResponse } from "@/lib/http";
import type { FieldDefinition, FieldType, OrganizationUnit, RiskScenario, WorkspaceConfiguration } from "@/lib/types";

export type Stage = "ORGANIZATION" | "WORKFLOW" | "SCENARIOS" | "DESIGN" | "REVIEW";

const steps: Array<{ stage: Stage; label: string; title: string; prompt: string; icon: typeof Building2 }> = [
  { stage: "ORGANIZATION", label: "Organization", title: "Describe how your organization works", prompt: "Paste an org description, upload an org chart, or just tell Kimsy about your teams and reporting lines.", icon: Building2 },
  { stage: "WORKFLOW", label: "Ownership", title: "Choose who owns the assessment", prompt: "Start with one responsible person. Add an independent reviewer only if your process needs a maker-checker step.", icon: Users },
  { stage: "SCENARIOS", label: "Scenarios", title: "Bring your own risk scenarios", prompt: "Drop in the spreadsheet, policy, document, or notes you use today. Kimsy will structure them without replacing your terminology.", icon: GitBranch },
  { stage: "DESIGN", label: "Assessment design", title: "Recreate your assessment method", prompt: "Describe fields such as financial impact and control effectiveness. Kimsy will propose typed fields and transparent scoring matrices.", icon: TableProperties },
  { stage: "REVIEW", label: "Review", title: "Review your workspace", prompt: "Confirm the structure before Kimsy creates your assessment workspace.", icon: CheckCircle2 },
];

const fieldTypes: Array<{ value: FieldType; label: string }> = [
  { value: "SHORT_TEXT", label: "Short text" },
  { value: "LONG_TEXT", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "BOOLEAN", label: "Yes / no" },
  { value: "SINGLE_SELECT", label: "Single select" },
  { value: "MULTI_SELECT", label: "Multi-select" },
  { value: "CALCULATED", label: "Calculated rating" },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;
}

function inputClass() {
  return "h-10 w-full rounded-[6px] border border-[#cfd8d4] bg-white px-3 text-sm text-[#27332f] placeholder:text-[#98a29e] focus:border-[#0f766e] focus:outline-none";
}

function reachableUnitIds(units: OrganizationUnit[]) {
  const children = new Map<string, OrganizationUnit[]>();
  units.forEach((unit) => {
    if (!unit.parentId) return;
    children.set(unit.parentId, [...(children.get(unit.parentId) ?? []), unit]);
  });
  const reachable = new Set<string>();
  const queue = units.filter((unit) => !unit.parentId);
  while (queue.length) {
    const unit = queue.shift();
    if (!unit || reachable.has(unit.id)) continue;
    reachable.add(unit.id);
    queue.push(...(children.get(unit.id) ?? []));
  }
  return reachable;
}

function OrganizationTreeNode({ unit, units, depth = 0, ancestry = new Set<string>() }: { unit: OrganizationUnit; units: OrganizationUnit[]; depth?: number; ancestry?: Set<string> }) {
  const [collapsed, setCollapsed] = useState(false);
  const children = units.filter((candidate) => candidate.parentId === unit.id);
  const path = new Set(ancestry).add(unit.id);
  return <div className={depth ? "relative ml-5 border-l border-[#cddbd6] pl-5" : ""} data-testid={`org-unit-${unit.id}`}>
    {depth > 0 && <span className="absolute -left-px top-7 h-px w-5 -translate-x-0 bg-[#cddbd6]" />}
    <div className="relative min-w-[260px] rounded-[7px] border border-[#d7e1dd] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(23,34,30,0.04)]">
      <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#e7f4f1] text-[#0f766e]"><Building2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#26332e]">{unit.name || "Unnamed unit"}</p>{children.length > 0 && <Badge>{collapsed ? `${children.length} hidden` : `${children.length} direct`}</Badge>}</div>{unit.description && <p className="mt-1 text-xs leading-5 text-[#6b7973]">{unit.description}</p>}</div>{children.length > 0 && <button type="button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${unit.name || "unnamed unit"}`} aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] text-[#66756f] transition-colors hover:bg-[#edf4f1] hover:text-[#0f766e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>}</div>
    </div>
    {!collapsed && children.length > 0 && <div className="space-y-2 pt-2">{children.map((child, index) => path.has(child.id) ? <div key={`${child.id}-${index}`} className="ml-5 rounded-[6px] border border-[#ead5a5] bg-[#fffaf0] px-3 py-2 text-xs text-[#7b5b1d]">Circular parent link involving {child.name || "an unnamed unit"}</div> : <OrganizationTreeNode key={`${child.id}-${index}`} unit={child} units={units} depth={depth + 1} ancestry={path} />)}</div>}
  </div>;
}

function OrganizationHierarchy({ configuration }: { configuration: WorkspaceConfiguration }) {
  const roots = configuration.units.filter((unit) => !unit.parentId);
  const reachable = reachableUnitIds(configuration.units);
  const unplaced = configuration.units.filter((unit) => !reachable.has(unit.id));
  return <div className="space-y-3">
    <div className="rounded-[8px] border border-[#21443c] bg-[#20342e] px-4 py-3.5 text-white">
      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-[#69d3c5] text-[#17332b]"><Network className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{configuration.organizationName || "Your organization"}</p><p className="mt-0.5 text-[10px] text-[#b7c6c0]">{configuration.units.length} organizational units</p></div></div>
    </div>
    {roots.length > 0 ? <div className="overflow-x-auto pb-1"><div className="min-w-[320px] space-y-2 pl-3">{roots.map((unit, index) => <OrganizationTreeNode key={`${unit.id}-${index}`} unit={unit} units={configuration.units} />)}</div></div> : <p className="rounded-[6px] border border-dashed border-[#cfd8d4] px-4 py-7 text-center text-xs text-[#7a8782]">No top-level units yet. Switch to Edit details to add one.</p>}
    {unplaced.length > 0 && <div className="rounded-[7px] border border-[#ead5a5] bg-[#fffaf0] p-3"><p className="text-xs font-semibold text-[#7b5b1d]">{unplaced.length} unit{unplaced.length === 1 ? " is" : "s are"} not connected to the hierarchy</p><p className="mt-1 text-[11px] leading-5 text-[#786846]">Check their parent assignments in Edit details: {unplaced.map((unit) => unit.name || "Unnamed unit").join(", ")}.</p></div>}
  </div>;
}

function OrganizationEditor({ configuration, setConfiguration }: EditorProps) {
  const [view, setView] = useState<"HIERARCHY" | "EDIT">("HIERARCHY");
  const updateUnit = (id: string, patch: Record<string, string | null>) => setConfiguration({
    ...configuration,
    units: configuration.units.map((unit) => unit.id === id ? { ...unit, ...patch } : unit),
  });
  return <div className="space-y-4">
    <label className="block"><span className="text-xs font-semibold text-[#42504a]">Organization name</span><input aria-label="Organization name" className={`${inputClass()} mt-2`} value={configuration.organizationName} onChange={(event) => setConfiguration({ ...configuration, organizationName: event.target.value })} placeholder="e.g. Northstar Financial" /></label>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-[#42504a]">Organizational units</p><p className="mt-0.5 text-[10px] text-[#7b8782]">Review the reporting structure or switch to the editable list.</p></div><div className="flex items-center gap-2"><div className="inline-flex rounded-[6px] border border-[#d5ddda] bg-[#f4f7f6] p-0.5"><button aria-pressed={view === "HIERARCHY"} onClick={() => setView("HIERARCHY")} className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-semibold ${view === "HIERARCHY" ? "bg-white text-[#0f766e] shadow-sm" : "text-[#68756f]"}`}><Network className="h-3.5 w-3.5" />Hierarchy</button><button aria-pressed={view === "EDIT"} onClick={() => setView("EDIT")} className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-semibold ${view === "EDIT" ? "bg-white text-[#0f766e] shadow-sm" : "text-[#68756f]"}`}><Rows3 className="h-3.5 w-3.5" />Edit details</button></div><button onClick={() => { setConfiguration({ ...configuration, units: [...configuration.units, { id: `unit-${Date.now()}`, name: "", parentId: null, description: "" }] }); setView("EDIT"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"><Plus className="h-3.5 w-3.5" />Add unit</button></div></div>
    {view === "HIERARCHY" ? <OrganizationHierarchy configuration={configuration} /> : <div className="space-y-2">
      {configuration.units.map((unit) => <div key={unit.id} className="grid gap-2 rounded-[6px] border border-[#dfe5e2] bg-[#fbfcfc] p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input aria-label="Unit name" className={inputClass()} value={unit.name} onChange={(event) => updateUnit(unit.id, { name: event.target.value })} placeholder="Unit name" />
        <select aria-label={`Parent for ${unit.name || "unit"}`} className={inputClass()} value={unit.parentId ?? ""} onChange={(event) => updateUnit(unit.id, { parentId: event.target.value || null })}><option value="">Top level</option>{configuration.units.filter((candidate) => candidate.id !== unit.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || "Unnamed unit"}</option>)}</select>
        <button aria-label={`Remove ${unit.name || "unit"}`} onClick={() => setConfiguration({ ...configuration, units: configuration.units.filter((candidate) => candidate.id !== unit.id).map((candidate) => candidate.parentId === unit.id ? { ...candidate, parentId: null } : candidate) })} className="h-10 rounded-[5px] px-2 text-[#8b5b57] hover:bg-[#fff0ee]"><Trash2 className="h-4 w-4" /></button>
        <input aria-label={`Description for ${unit.name || "unit"}`} className={`${inputClass()} sm:col-span-2`} value={unit.description} onChange={(event) => updateUnit(unit.id, { description: event.target.value })} placeholder="What does this unit do?" />
      </div>)}
      {!configuration.units.length && <p className="rounded-[6px] border border-dashed border-[#cfd8d4] px-4 py-7 text-center text-xs text-[#7a8782]">No units yet. Describe the organization to Kimsy or add one manually.</p>}
    </div>}
  </div>;
}

function WorkflowEditor({ configuration, setConfiguration }: EditorProps) {
  const review = configuration.review;
  return <div className="space-y-5">
    <label className="block"><span className="text-xs font-semibold text-[#42504a]">Assessment owner</span><input aria-label="Assessment owner" className={`${inputClass()} mt-2`} value={review.assessorName} onChange={(event) => setConfiguration({ ...configuration, review: { ...review, assessorName: event.target.value } })} placeholder="Your name" /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <button onClick={() => setConfiguration({ ...configuration, review: { ...review, mode: "SOLO", reviewerName: "" } })} className={`rounded-[7px] border p-4 text-left ${review.mode === "SOLO" ? "border-[#0f766e] bg-[#edf7f5]" : "border-[#d7dfdc] hover:border-[#9dbbb5]"}`}><div className="flex items-center justify-between"><p className="text-sm font-semibold">I complete it myself</p>{review.mode === "SOLO" && <Check className="h-4 w-4 text-[#0f766e]" />}</div><p className="mt-2 text-xs leading-5 text-[#65736d]">Keep the workflow fast and mark an assessment complete when you are satisfied.</p></button>
      <button onClick={() => setConfiguration({ ...configuration, review: { ...review, mode: "REVIEWER" } })} className={`rounded-[7px] border p-4 text-left ${review.mode === "REVIEWER" ? "border-[#0f766e] bg-[#edf7f5]" : "border-[#d7dfdc] hover:border-[#9dbbb5]"}`}><div className="flex items-center justify-between"><p className="text-sm font-semibold">Add a reviewer</p>{review.mode === "REVIEWER" && <Check className="h-4 w-4 text-[#0f766e]" />}</div><p className="mt-2 text-xs leading-5 text-[#65736d]">Submit the finished assessment to one independent person for approval or return.</p></button>
    </div>
    {review.mode === "REVIEWER" && <label className="block"><span className="text-xs font-semibold text-[#42504a]">Reviewer name</span><input aria-label="Reviewer name" className={`${inputClass()} mt-2`} value={review.reviewerName} onChange={(event) => setConfiguration({ ...configuration, review: { ...review, reviewerName: event.target.value } })} placeholder="Who provides the independent review?" /></label>}
  </div>;
}

function ScenariosEditor({ configuration, setConfiguration }: EditorProps) {
  const update = (id: string, patch: Partial<RiskScenario>) => setConfiguration({ ...configuration, scenarios: configuration.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch } : scenario) });
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#42504a]">{configuration.scenarios.length} risk scenarios</p><button onClick={() => setConfiguration({ ...configuration, scenarios: [...configuration.scenarios, { id: `scenario-${Date.now()}`, code: "", title: "", category: "", description: "", sourceCitations: [] }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"><Plus className="h-3.5 w-3.5" />Add scenario</button></div>
    <div className="max-h-[510px] space-y-2 overflow-y-auto pr-1">
      {configuration.scenarios.map((scenario) => <div key={scenario.id} className="rounded-[6px] border border-[#dfe5e2] bg-[#fbfcfc] p-3">
        <div className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_auto]"><input aria-label="Scenario code" className={inputClass()} value={scenario.code} onChange={(event) => update(scenario.id, { code: event.target.value })} placeholder="Code" /><input aria-label="Scenario title" className={inputClass()} value={scenario.title} onChange={(event) => update(scenario.id, { title: event.target.value })} placeholder="Scenario title" /><input aria-label="Scenario category" className={inputClass()} value={scenario.category} onChange={(event) => update(scenario.id, { category: event.target.value })} placeholder="Category" /><button aria-label={`Remove ${scenario.title || "scenario"}`} onClick={() => setConfiguration({ ...configuration, scenarios: configuration.scenarios.filter((candidate) => candidate.id !== scenario.id) })} className="h-10 rounded-[5px] px-2 text-[#8b5b57] hover:bg-[#fff0ee]"><Trash2 className="h-4 w-4" /></button></div>
        <textarea aria-label={`Description for ${scenario.title || "scenario"}`} rows={2} className="mt-2 w-full resize-y rounded-[6px] border border-[#cfd8d4] bg-white px-3 py-2 text-sm" value={scenario.description} onChange={(event) => update(scenario.id, { description: event.target.value })} placeholder="What could happen?" />
        {scenario.sourceCitations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{scenario.sourceCitations.map((citation, index) => <span key={`${citation.sourceName}-${index}`} className="rounded bg-[#edf2f0] px-2 py-1 text-[10px] text-[#65736d]">{citation.sourceName} · {citation.locator}</span>)}</div>}
      </div>)}
      {!configuration.scenarios.length && <p className="rounded-[6px] border border-dashed border-[#cfd8d4] px-4 py-7 text-center text-xs text-[#7a8782]">Upload your current scenario library or add a scenario manually.</p>}
    </div>
  </div>;
}

function DesignEditor({ configuration, setConfiguration }: EditorProps) {
  const update = (id: string, patch: Partial<FieldDefinition>) => setConfiguration({ ...configuration, fields: configuration.fields.map((field) => field.id === id ? { ...field, ...patch } : field) });
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#42504a]">Assessment fields</p><button onClick={() => setConfiguration({ ...configuration, fields: [...configuration.fields, { id: `field-${Date.now()}`, label: "New field", helpText: "", type: "SHORT_TEXT", required: false, options: [] }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"><Plus className="h-3.5 w-3.5" />Add field</button></div>
    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
      {configuration.fields.map((field) => <div key={field.id} className="rounded-[6px] border border-[#dfe5e2] bg-[#fbfcfc] p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><input aria-label="Field label" className={inputClass()} value={field.label} onChange={(event) => update(field.id, { label: event.target.value })} /><select aria-label={`Type for ${field.label}`} className={inputClass()} value={field.type} onChange={(event) => update(field.id, { type: event.target.value as FieldType, options: event.target.value === "SINGLE_SELECT" || event.target.value === "MULTI_SELECT" || event.target.value === "CALCULATED" ? field.options : [] })}>{fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button aria-label={`Remove ${field.label}`} disabled={configuration.calculations.some((calculation) => calculation.outputFieldId === field.id || (calculation.type === "MATRIX" && (calculation.rowFieldId === field.id || calculation.columnFieldId === field.id)) || (calculation.type === "THRESHOLD" && calculation.terms.some((term) => term.fieldId === field.id)))} onClick={() => setConfiguration({ ...configuration, fields: configuration.fields.filter((candidate) => candidate.id !== field.id) })} className="h-10 rounded-[5px] px-2 text-[#8b5b57] hover:bg-[#fff0ee] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>
        <input aria-label={`Help text for ${field.label}`} className={`${inputClass()} mt-2`} value={field.helpText} onChange={(event) => update(field.id, { helpText: event.target.value })} placeholder="Helpful guidance for the assessor" />
        {(field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT" || field.type === "CALCULATED") && <label className="mt-2 block"><span className="text-[10px] font-bold uppercase text-[#7a8782]">Options</span><input aria-label={`Options for ${field.label}`} className={`${inputClass()} mt-1`} value={field.options.map((option) => option.label).join(", ")} onChange={(event) => update(field.id, { options: event.target.value.split(",").map((label) => label.trim()).filter(Boolean).map((label, index) => ({ id: field.options[index]?.id ?? slug(label), label, score: field.options[index]?.score ?? index + 1 })) })} placeholder="Low, Moderate, High, Severe" /></label>}
      </div>)}
    </div>
    <div>
      <p className="text-xs font-semibold text-[#42504a]">Transparent calculations</p>
      <div className="mt-2 space-y-2">{configuration.calculations.map((calculation) => {
        const output = configuration.fields.find((field) => field.id === calculation.outputFieldId)?.label ?? calculation.outputFieldId;
        const description = calculation.type === "MATRIX"
          ? `${configuration.fields.find((field) => field.id === calculation.rowFieldId)?.label ?? calculation.rowFieldId} × ${configuration.fields.find((field) => field.id === calculation.columnFieldId)?.label ?? calculation.columnFieldId} · ${calculation.cells.length} mapped combinations`
          : `${calculation.terms.length} weighted inputs · ${calculation.bands.length} rating bands`;
        return <div key={calculation.id} className="flex items-center justify-between rounded-[6px] border border-[#cde0db] bg-[#f2f9f7] px-3 py-2.5"><div><p className="text-xs font-semibold text-[#244b43]">{output}</p><p className="mt-0.5 text-[10px] text-[#668078]">{description}</p></div><Badge tone="success">{calculation.type === "MATRIX" ? "Matrix" : "Thresholds"}</Badge></div>;
      })}</div>
    </div>
    <label className="block"><span className="text-xs font-semibold text-[#42504a]">Final rating shown in the register</span><select aria-label="Final rating field" className={`${inputClass()} mt-2`} value={configuration.finalRatingFieldId} onChange={(event) => setConfiguration({ ...configuration, finalRatingFieldId: event.target.value })}>{configuration.fields.filter((field) => field.type === "CALCULATED" || field.type === "SINGLE_SELECT").map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
  </div>;
}

interface EditorProps {
  configuration: WorkspaceConfiguration;
  setConfiguration: (configuration: WorkspaceConfiguration) => void;
}

export function StructuredEditor({ stage, ...props }: EditorProps & { stage: Stage }) {
  if (stage === "ORGANIZATION") return <OrganizationEditor {...props} />;
  if (stage === "WORKFLOW") return <WorkflowEditor {...props} />;
  if (stage === "SCENARIOS") return <ScenariosEditor {...props} />;
  if (stage === "DESIGN") return <DesignEditor {...props} />;
  const errors = validateConfiguration(props.configuration);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Organization</p><p className="mt-1 text-base font-semibold">{props.configuration.organizationName || "Not set"}</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.units.length} units</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Workflow</p><p className="mt-1 text-base font-semibold">{props.configuration.review.mode === "SOLO" ? "Solo assessor" : "Assessor + reviewer"}</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.review.assessorName}{props.configuration.review.reviewerName ? ` · ${props.configuration.review.reviewerName}` : ""}</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Risk library</p><p className="mt-1 text-base font-semibold">{props.configuration.scenarios.length} scenarios</p><p className="mt-1 text-xs text-[#73807b]">{new Set(props.configuration.scenarios.map((scenario) => scenario.category)).size} categories</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Assessment method</p><p className="mt-1 text-base font-semibold">{props.configuration.fields.length} fields</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.calculations.length} transparent calculations</p></div></div>
    {errors.length ? <div className="rounded-[7px] border border-[#ebc5c0] bg-[#fff5f3] p-4"><p className="text-xs font-semibold text-[#9b3026]">Resolve these items before creating the workspace</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#80504b]">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <div className="flex items-center gap-3 rounded-[7px] border border-[#b9decf] bg-[#eff9f4] p-4 text-sm text-[#176b4b]"><CheckCircle2 className="h-5 w-5" />Your workspace is ready to create.</div>}
  </div>;
}

export function Onboarding() {
  const { completeOnboarding, loadSample } = useKimsy();
  const [step, setStep] = useState(0);
  const [configuration, setConfiguration] = useState<WorkspaceConfiguration>(() => clone(starterConfiguration));
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("I’ll turn what you already have into an editable structure. You stay in control of every field and scenario.");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = steps[step];
  const validation = validateConfiguration(configuration);

  useEffect(() => {
    fetch("/api/ai/status").then((response) => response.json()).then((result) => setAiConfigured(Boolean(result.configured))).catch(() => setAiConfigured(false));
  }, []);

  const askKimsy = async () => {
    if (active.stage === "REVIEW") return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("stage", active.stage);
      form.append("message", message);
      form.append("configuration", JSON.stringify(configuration));
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/ai/configure", { method: "POST", body: form });
      const result = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(result.error ?? "Kimsy could not interpret that material."));
      setConfiguration(result.configuration as WorkspaceConfiguration);
      setAssistantMessage(String(result.assistantMessage));
      setWarnings(Array.isArray(result.warnings) ? result.warnings.map(String) : []);
      setMessage("");
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kimsy could not interpret that material.");
    } finally {
      setLoading(false);
    }
  };

  const canContinue = active.stage === "ORGANIZATION"
    ? Boolean(configuration.organizationName.trim() && configuration.units.length)
    : active.stage === "WORKFLOW"
      ? Boolean(configuration.review.assessorName.trim() && (configuration.review.mode === "SOLO" || configuration.review.reviewerName.trim()))
      : active.stage === "SCENARIOS"
        ? configuration.scenarios.length > 0
        : active.stage === "DESIGN"
          ? configuration.fields.length > 0 && configuration.calculations.length > 0
          : validation.length === 0;

  return <div className="min-h-screen bg-[#f3f6f5]">
    <header className="border-b border-[#dce2df] bg-white"><div className="mx-auto flex h-16 max-w-[1380px] items-center px-4 sm:px-7"><div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#17221e] text-[#69d3c5]"><Sparkles className="h-4 w-4" /></div><p className="ml-3 font-semibold">Kimsy</p><button onClick={loadSample} className="ml-auto text-xs font-semibold text-[#0f766e] hover:underline">Explore sample workspace</button></div></header>
    <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-7 lg:py-10">
      <div className="mb-7 flex items-center gap-2 overflow-x-auto pb-1">{steps.map((item, index) => <div key={item.stage} className="flex shrink-0 items-center gap-2"><div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold ${index < step ? "border-[#0f766e] bg-[#0f766e] text-white" : index === step ? "border-[#0f766e] bg-[#edf7f5] text-[#0f766e]" : "border-[#d1d9d5] bg-white text-[#87928d]"}`}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</div><span className={`hidden text-xs font-semibold sm:block ${index === step ? "text-[#27332f]" : "text-[#87928d]"}`}>{item.label}</span>{index < steps.length - 1 && <div className="h-px w-5 bg-[#d8dfdc] lg:w-12" />}</div>)}</div>
      <div className="mb-6 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0f766e]">Set up your workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#15201c]">{active.title}</h1><p className="mt-2 text-sm leading-6 text-[#65726d]">{active.prompt}</p></div>
      {!aiConfigured && aiConfigured !== null && active.stage !== "REVIEW" && <div className="mb-5 flex items-start gap-3 rounded-[7px] border border-[#ead5a5] bg-[#fffaf0] px-4 py-3"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6417]" /><div><p className="text-xs font-semibold text-[#765514]">AI setup needs an API key</p><p className="mt-1 text-xs leading-5 text-[#7c6a45]">Add <code className="rounded bg-white px-1 py-0.5">OPENAI_API_KEY</code> to <code className="rounded bg-white px-1 py-0.5">.env.local</code> and restart the development server. You can still edit the structure manually or explore the sample.</p></div></div>}
      <div className={`grid gap-5 ${active.stage === "REVIEW" ? "mx-auto max-w-4xl" : "xl:grid-cols-[minmax(340px,.8fr)_minmax(560px,1.2fr)]"}`}>
        {active.stage !== "REVIEW" && <Panel className="flex min-h-[560px] flex-col overflow-hidden"><div className="border-b border-[#e2e7e5] bg-[#fbfcfc] px-5 py-4"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#dff3ef] text-[#0f766e]"><Sparkles className="h-3.5 w-3.5" /></div><p className="text-sm font-semibold">Describe it to Kimsy</p></div></div><div className="flex-1 p-5"><div className="rounded-[8px] bg-[#edf7f5] p-4 text-sm leading-6 text-[#34544d]">{assistantMessage}</div>{warnings.length > 0 && <div className="mt-3 rounded-[7px] border border-[#ead5a5] bg-[#fffaf0] p-3"><p className="text-[10px] font-bold uppercase text-[#87651d]">Check these points</p>{warnings.slice(0, 5).map((warning) => <p key={warning} className="mt-1.5 text-xs leading-5 text-[#74623e]">{warning}</p>)}</div>}{error && <p className="mt-3 rounded-[6px] border border-[#efc0bb] bg-[#fff2f0] px-3 py-2 text-xs leading-5 text-[#9d3328]">{error}</p>}</div><div className="border-t border-[#e2e7e5] p-4"><textarea aria-label="Message Kimsy" rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full resize-none rounded-[7px] border border-[#cfd8d4] px-3 py-2.5 text-sm leading-6 placeholder:text-[#929d98] focus:border-[#0f766e] focus:outline-none" placeholder={active.stage === "ORGANIZATION" ? "We have three business areas..." : active.stage === "SCENARIOS" ? "These files contain our current risk taxonomy..." : "Describe what you use today..."} />{files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-[5px] bg-[#edf2f0] px-2 py-1 text-[10px] font-semibold text-[#5e6c66]">{file.name}<button aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3 w-3" /></button></span>)}</div>}<div className="mt-3 flex items-center justify-between"><input ref={inputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><Button variant="secondary" onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />Attach files</Button><Button loading={loading} disabled={!aiConfigured || (!message.trim() && !files.length)} onClick={askKimsy}>{loading ? "Interpreting" : "Create proposal"}{!loading && <Send className="h-4 w-4" />}</Button></div></div></Panel>}
        <Panel className="min-h-[560px] overflow-hidden"><div className="flex items-start justify-between border-b border-[#e2e7e5] px-5 py-4"><div><p className="text-sm font-semibold">Structured preview</p><p className="mt-1 text-xs text-[#71807a]">Review and edit before you continue.</p></div><Badge tone="info">You control this</Badge></div><div className="p-5"><StructuredEditor stage={active.stage} configuration={configuration} setConfiguration={setConfiguration} /></div></Panel>
      </div>
      <div className="mt-5 flex items-center justify-between"><Button variant="ghost" disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" />Back</Button>{active.stage === "REVIEW" ? <Button disabled={!canContinue} onClick={() => completeOnboarding(configuration)}>Create my workspace<CheckCircle2 className="h-4 w-4" /></Button> : <Button disabled={!canContinue} onClick={() => { setStep((current) => current + 1); setWarnings([]); setError(""); setAssistantMessage("Tell me what you use today, or attach the source material. I’ll propose a structure for you to confirm."); }}>Confirm and continue<ArrowRight className="h-4 w-4" /></Button>}</div>
    </div>
  </div>;
}
