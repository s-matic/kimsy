"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  KeyRound,
  Network,
  Paperclip,
  Plus,
  Rows3,
  Search,
  Sparkles,
  TableProperties,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { BrandMark } from "@/components/brand-mark";
import { Badge, Button, Panel } from "@/components/ui";
import { validateConfiguration } from "@/lib/scoring";
import { starterConfiguration } from "@/lib/seed";
import { useKimsy } from "@/lib/store";
import { readJsonResponse } from "@/lib/http";
import { consumeSetupAgentStream } from "@/lib/ai/setup-ui-stream";
import type { FieldDefinition, FieldType, OrganizationUnit, RiskScenario, WorkspaceConfiguration } from "@/lib/types";

export type Stage = "ORGANIZATION" | "WORKFLOW" | "SCENARIOS" | "DESIGN" | "REVIEW";

type ConfigurationStage = Exclude<Stage, "REVIEW">;

const setupStages: Array<{ stage: ConfigurationStage; label: string; prompt: string; icon: typeof Building2 }> = [
  { stage: "ORGANIZATION", label: "Organization", prompt: "Start by describing your organization, or upload an org chart, spreadsheet, or image.", icon: Building2 },
  { stage: "WORKFLOW", label: "Ownership", prompt: "Who should own and complete assessments in this workspace?", icon: Users },
  { stage: "SCENARIOS", label: "Risk scenarios", prompt: "Now share the risk scenarios, taxonomy, or policy material you use today.", icon: GitBranch },
  { stage: "DESIGN", label: "Assessment method", prompt: "Finally, describe the fields and scoring method you want assessors to use.", icon: TableProperties },
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
  return "h-11 w-full rounded-[10px] border border-[#dedfe5] bg-white px-3 text-sm text-[#2d2f39] shadow-sm placeholder:text-[#a0a3ae] focus:border-[#7785d8] focus:outline-none focus:ring-3 focus:ring-[#e9ebfa]";
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
  return <div className={depth ? "relative ml-5 border-l border-[#dfe1e8] pl-5" : ""} data-testid={`org-unit-${unit.id}`}>
    {depth > 0 && <span className="absolute -left-px top-7 h-px w-5 bg-[#dfe1e8]" />}
    <div className="relative min-w-[260px] rounded-[10px] border border-[#e0e2e8] bg-white px-3.5 py-3 transition-colors hover:border-[#cfd3df]">
      <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#f0f1f8] text-[#6676d8]"><Building2 className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[#30333c]">{unit.name || "Unnamed unit"}</p>{children.length > 0 && <span className="rounded-full border border-[#dfe1e8] bg-[#f7f7f9] px-2 py-0.5 text-[10px] font-semibold text-[#747886]">{collapsed ? `${children.length} hidden` : `${children.length} direct`}</span>}</div>{unit.description && <p className="mt-1 text-xs leading-5 text-[#777b86]">{unit.description}</p>}</div>{children.length > 0 && <button type="button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${unit.name || "unnamed unit"}`} aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-[#747886] transition-colors hover:bg-[#f0f1f6] hover:text-[#586ad0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6676d8]">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>}</div>
    </div>
    {!collapsed && children.length > 0 && <div className="space-y-2 pt-2">{children.map((child, index) => path.has(child.id) ? <div key={`${child.id}-${index}`} className="ml-5 rounded-[6px] border border-[#ead5a5] bg-[#fffaf0] px-3 py-2 text-xs text-[#7b5b1d]">Circular parent link involving {child.name || "an unnamed unit"}</div> : <OrganizationTreeNode key={`${child.id}-${index}`} unit={child} units={units} depth={depth + 1} ancestry={path} />)}</div>}
  </div>;
}

function OrganizationHierarchy({ configuration }: { configuration: WorkspaceConfiguration }) {
  const roots = configuration.units.filter((unit) => !unit.parentId);
  const reachable = reachableUnitIds(configuration.units);
  const unplaced = configuration.units.filter((unit) => !reachable.has(unit.id));
  return <div className="space-y-3">
    <div className="rounded-[12px] border border-[#dfe1e9] bg-[#f7f7fb] px-4 py-3.5">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#dfe2f0] bg-white text-[#586ad0]"><Network className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#888b98]">Organization</p><p className="mt-0.5 truncate text-sm font-semibold text-[#2f313b]">{configuration.organizationName || "Your organization"}</p></div><span className="shrink-0 rounded-full border border-[#dfe1e9] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#707481]">{configuration.units.length} unit{configuration.units.length === 1 ? "" : "s"}</span></div>
    </div>
    {roots.length > 0 ? <div className="overflow-x-auto pb-1"><div className="relative min-w-[320px] space-y-2 pl-8 before:absolute before:bottom-7 before:left-3 before:top-0 before:w-px before:bg-[#dfe1e8]">{roots.map((unit, index) => <div key={`${unit.id}-${index}`} className="relative before:absolute before:-left-5 before:top-7 before:h-px before:w-5 before:bg-[#dfe1e8]"><OrganizationTreeNode unit={unit} units={configuration.units} /></div>)}</div></div> : <p className="rounded-[6px] border border-dashed border-[#cfd8d4] px-4 py-7 text-center text-xs text-[#7a8782]">No top-level units yet. Switch to Edit details to add one.</p>}
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
  return <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-[10px] border border-[#dfe2eb] bg-[#f7f8fc] p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#586ad0] shadow-sm"><Users className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-[#30323c]">Single-owner workspace</p><p className="mt-1 text-xs leading-5 text-[#707482]">One compliance owner completes and signs off each assessment, keeping the workflow clear and lightweight.</p></div></div>
    <label className="block"><span className="text-xs font-semibold text-[#42504a]">Assessment owner</span><input aria-label="Assessment owner" className={`${inputClass()} mt-2`} value={review.assessorName} onChange={(event) => setConfiguration({ ...configuration, review: { mode: "SOLO", assessorName: event.target.value, reviewerName: "" } })} placeholder="Your name" /></label>
  </div>;
}

function uniqueScenarioCategories(scenarios: RiskScenario[]) {
  const categories = new Map<string, string>();
  scenarios.forEach((scenario) => {
    const category = scenario.category.trim();
    if (category) categories.set(category.toLocaleLowerCase(), category);
  });
  return [...categories.values()].sort((left, right) => left.localeCompare(right));
}

function ScenariosEditor({ configuration, setConfiguration }: EditorProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const update = (id: string, patch: Partial<RiskScenario>) => setConfiguration({ ...configuration, scenarios: configuration.scenarios.map((scenario) => scenario.id === id ? { ...scenario, ...patch } : scenario) });
  const categories = uniqueScenarioCategories(configuration.scenarios);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleScenarios = configuration.scenarios.filter((scenario) => {
    const matchesCategory = category === "ALL" || scenario.category === category;
    const matchesQuery = !normalizedQuery || [scenario.code, scenario.title, scenario.category, scenario.description].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesCategory && matchesQuery;
  });
  const toggleExpanded = (id: string) => setExpandedIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  const addScenario = () => {
    const id = `scenario-${Date.now()}`;
    setConfiguration({ ...configuration, scenarios: [...configuration.scenarios, { id, code: "", title: "", category: "", description: "", sourceCitations: [] }] });
    setQuery("");
    setCategory("ALL");
    setExpandedIds((current) => [...current, id]);
  };
  const removeScenario = (id: string) => {
    setConfiguration({ ...configuration, scenarios: configuration.scenarios.filter((candidate) => candidate.id !== id) });
    setExpandedIds((current) => current.filter((candidate) => candidate !== id));
  };

  return <div className="space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold text-[#42504a]">{configuration.scenarios.length} risk scenarios</p><p className="mt-1 text-[10px] text-[#7b8782]">Scan the library, then expand a row to review or edit it.</p></div><button onClick={addScenario} className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[#586ad0]"><Plus className="h-3.5 w-3.5" />Add scenario</button></div>
    {configuration.scenarios.length > 0 && <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="relative"><span className="sr-only">Search risk scenarios</span><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b8e99]" /><input aria-label="Search risk scenarios" value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass()} pl-9`} placeholder="Search code, title, category, or description" /></label><select aria-label="Filter risk scenarios by category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass()}><option value="ALL">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="overflow-hidden rounded-[8px] border border-[#dfe3e5] bg-white">
        <div className="hidden grid-cols-[18px_88px_minmax(180px,1.5fr)_minmax(140px,1fr)_70px_36px] gap-3 border-b border-[#e4e6e9] bg-[#f7f7f9] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#818491] sm:grid"><span /><span>Code</span><span>Scenario</span><span>Category</span><span>Sources</span><span /></div>
        <div className="max-h-[520px] overflow-y-auto">
          {visibleScenarios.map((scenario, scenarioIndex) => {
            const expanded = expandedIds.includes(scenario.id);
            const categoryListId = `scenario-category-suggestions-${scenarioIndex}`;
            const categorySuggestions = uniqueScenarioCategories(configuration.scenarios.filter((candidate) => candidate.id !== scenario.id));
            return <div key={scenario.id} className="border-b border-[#e9eaed] last:border-b-0">
              <div className="grid grid-cols-[minmax(0,1fr)_40px] items-stretch hover:bg-[#fafafd]">
                <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${scenario.title || scenario.code || "scenario"}`} onClick={() => toggleExpanded(scenario.id)} className="grid min-w-0 grid-cols-[18px_70px_minmax(0,1fr)] items-center gap-2 px-3 py-3 text-left sm:grid-cols-[18px_88px_minmax(180px,1.5fr)_minmax(140px,1fr)_70px] sm:gap-3">
                  <ChevronRight className={`h-3.5 w-3.5 text-[#777b89] transition-transform ${expanded ? "rotate-90" : ""}`} />
                  <span className="truncate font-mono text-[11px] font-semibold text-[#626676]">{scenario.code || "No code"}</span>
                  <span className="truncate text-xs font-semibold text-[#30323c]">{scenario.title || "Untitled scenario"}</span>
                  <span className="hidden truncate text-[11px] text-[#6f7380] sm:block">{scenario.category || "Uncategorized"}</span>
                  <span className="hidden text-[10px] text-[#858895] sm:block">{scenario.sourceCitations.length || "—"}</span>
                </button>
                <button type="button" aria-label={`Remove ${scenario.title || "scenario"}`} onClick={() => removeScenario(scenario.id)} className="flex items-center justify-center text-[#9a6964] opacity-60 hover:bg-[#fff2f0] hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {expanded && <div className="border-t border-[#e6e7eb] bg-[#fafafd] p-3 sm:p-4">
                <div className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]"><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Code</span><input aria-label="Scenario code" className={inputClass()} value={scenario.code} onChange={(event) => update(scenario.id, { code: event.target.value })} placeholder="Code" /></label><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Scenario</span><input aria-label="Scenario title" className={inputClass()} value={scenario.title} onChange={(event) => update(scenario.id, { title: event.target.value })} placeholder="Scenario title" /></label><label><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Category</span><input aria-label="Scenario category" autoComplete="off" list={categoryListId} className={inputClass()} value={scenario.category} onChange={(event) => update(scenario.id, { category: event.target.value })} placeholder="Category" /><datalist id={categoryListId}>{categorySuggestions.map((item) => <option key={item.toLocaleLowerCase()} value={item} />)}</datalist></label></div>
                <label className="mt-3 block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#858895]">Description and guidance</span><textarea aria-label={`Description for ${scenario.title || "scenario"}`} rows={4} className="w-full resize-y rounded-[6px] border border-[#cfd4d8] bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-[#7785d8] focus:ring-3 focus:ring-[#e9ebfa]" value={scenario.description} onChange={(event) => update(scenario.id, { description: event.target.value })} placeholder="What could happen?" /></label>
                {scenario.sourceCitations.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{scenario.sourceCitations.map((citation, index) => <span key={`${citation.sourceName}-${index}`} className="rounded bg-[#edf2f0] px-2 py-1 text-[10px] text-[#65736d]">{citation.sourceName} · {citation.locator}</span>)}</div>}
              </div>}
            </div>;
          })}
          {visibleScenarios.length === 0 && <p className="px-4 py-10 text-center text-xs text-[#7a7e8a]">No scenarios match this search and category.</p>}
        </div>
      </div>
      <p className="text-[10px] text-[#858895]">Showing {visibleScenarios.length} of {configuration.scenarios.length} scenarios</p>
    </>}
    {!configuration.scenarios.length && <p className="rounded-[6px] border border-dashed border-[#cfd8d4] px-4 py-7 text-center text-xs text-[#7a8782]">Upload your current scenario library or add a scenario manually.</p>}
  </div>;
}

function FieldOptionsInput({ field, onChange }: { field: FieldDefinition; onChange: (options: FieldDefinition["options"]) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const serializedOptions = field.options.map((option) => option.label).join(", ");
  const updateOptions = (value: string) => {
    setDraft(value);
    const labels = value.split(",").map((label) => label.trim()).filter(Boolean);
    onChange(labels.map((label, index) => ({
      id: field.options[index]?.id ?? slug(label),
      label,
      score: field.options[index]?.score ?? index + 1,
    })));
  };

  return <label className="mt-2 block"><span className="text-[10px] font-bold uppercase text-[#7a8782]">Options</span><input aria-label={`Options for ${field.label}`} className={`${inputClass()} mt-1`} value={draft ?? serializedOptions} onChange={(event) => updateOptions(event.target.value)} onBlur={() => setDraft(null)} placeholder="Low, Moderate, High, Severe" /></label>;
}

function DesignEditor({ configuration, setConfiguration }: EditorProps) {
  const update = (id: string, patch: Partial<FieldDefinition>) => setConfiguration({ ...configuration, fields: configuration.fields.map((field) => field.id === id ? { ...field, ...patch } : field) });
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#42504a]">Assessment fields</p><button onClick={() => setConfiguration({ ...configuration, fields: [...configuration.fields, { id: `field-${Date.now()}`, label: "New field", helpText: "", type: "SHORT_TEXT", required: false, options: [] }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"><Plus className="h-3.5 w-3.5" />Add field</button></div>
    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
      {configuration.fields.map((field) => <div key={field.id} className="rounded-[6px] border border-[#dfe5e2] bg-[#fbfcfc] p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><input aria-label="Field label" className={inputClass()} value={field.label} onChange={(event) => update(field.id, { label: event.target.value })} /><select aria-label={`Type for ${field.label}`} className={inputClass()} value={field.type} onChange={(event) => update(field.id, { type: event.target.value as FieldType, options: event.target.value === "SINGLE_SELECT" || event.target.value === "MULTI_SELECT" || event.target.value === "CALCULATED" ? field.options : [] })}>{fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button aria-label={`Remove ${field.label}`} disabled={configuration.calculations.some((calculation) => calculation.outputFieldId === field.id || (calculation.type === "MATRIX" && (calculation.rowFieldId === field.id || calculation.columnFieldId === field.id)) || (calculation.type === "THRESHOLD" && calculation.terms.some((term) => term.fieldId === field.id)))} onClick={() => setConfiguration({ ...configuration, fields: configuration.fields.filter((candidate) => candidate.id !== field.id) })} className="h-10 rounded-[5px] px-2 text-[#8b5b57] hover:bg-[#fff0ee] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>
        <input aria-label={`Help text for ${field.label}`} className={`${inputClass()} mt-2`} value={field.helpText} onChange={(event) => update(field.id, { helpText: event.target.value })} placeholder="Helpful guidance for the assessor" />
        {(field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT" || field.type === "CALCULATED") && <FieldOptionsInput field={field} onChange={(options) => update(field.id, { options })} />}
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
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Organization</p><p className="mt-1 text-base font-semibold">{props.configuration.organizationName || "Not set"}</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.units.length} units</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Workflow</p><p className="mt-1 text-base font-semibold">Single owner</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.review.assessorName || "Not assigned"}</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Risk library</p><p className="mt-1 text-base font-semibold">{props.configuration.scenarios.length} scenarios</p><p className="mt-1 text-xs text-[#73807b]">{new Set(props.configuration.scenarios.map((scenario) => scenario.category)).size} categories</p></div><div className="rounded-[7px] border border-[#dfe5e2] p-4"><p className="text-xs text-[#73807b]">Assessment method</p><p className="mt-1 text-base font-semibold">{props.configuration.fields.length} fields</p><p className="mt-1 text-xs text-[#73807b]">{props.configuration.calculations.length} transparent calculations</p></div></div>
    {errors.length ? <div className="rounded-[7px] border border-[#ebc5c0] bg-[#fff5f3] p-4"><p className="text-xs font-semibold text-[#9b3026]">Resolve these items before creating the workspace</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#80504b]">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : <div className="flex items-center gap-3 rounded-[7px] border border-[#b9decf] bg-[#eff9f4] p-4 text-sm text-[#176b4b]"><CheckCircle2 className="h-5 w-5" />Your workspace is ready to create.</div>}
  </div>;
}

interface SetupMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  artifactStage?: Stage;
  pendingArtifactStage?: ConfigurationStage;
  sourceNames?: string[];
  warnings?: string[];
  streaming?: boolean;
}

function SkeletonBar({ className }: { className: string }) {
  return <div className={`skeleton rounded-full ${className}`} />;
}

function SetupArtifactSkeleton({ stage }: { stage: ConfigurationStage }) {
  const definition = setupStages.find((item) => item.stage === stage)!;
  const Icon = definition.icon;
  return <div role="status" aria-label={`Building ${definition.label.toLowerCase()}`} data-testid={`setup-artifact-skeleton-${stage}`} className="mt-3 w-full"><Panel className="w-full overflow-hidden border-[#e4e5ea] shadow-[0_10px_36px_rgba(35,36,45,0.05)]">
    <span className="sr-only">Building the editable {definition.label.toLowerCase()} component.</span>
    <div aria-hidden="true">
      <div className="flex items-center gap-3 border-b border-[#ededf0] bg-[#fcfcfd] px-4 py-3.5 sm:px-5"><div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#f1f2f8] text-[#a1a9d9]"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1 space-y-2"><SkeletonBar className="h-3.5 w-28" /><SkeletonBar className="h-2.5 w-52 max-w-[70%]" /></div><SkeletonBar className="h-6 w-14" /></div>
      <div className="space-y-4 p-4 sm:p-5">
        {stage === "ORGANIZATION" && <><div className="space-y-2"><SkeletonBar className="h-2.5 w-28" /><div className="skeleton h-11 rounded-[10px]" /></div><div className="flex items-center justify-between"><div className="space-y-2"><SkeletonBar className="h-2.5 w-32" /><SkeletonBar className="h-2 w-52" /></div><SkeletonBar className="h-8 w-36" /></div><div className="space-y-2 rounded-[12px] border border-[#ececf0] p-3"><div className="skeleton h-14 rounded-[9px]" /><div className="ml-6 skeleton h-14 rounded-[9px]" /><div className="ml-6 skeleton h-14 rounded-[9px]" /></div></>}
        {stage === "WORKFLOW" && <><div className="skeleton h-20 rounded-[10px]" /><div className="space-y-2"><SkeletonBar className="h-2.5 w-28" /><div className="skeleton h-11 rounded-[10px]" /></div></>}
        {stage === "SCENARIOS" && <><div className="grid gap-3 sm:grid-cols-[1fr_190px]"><div className="skeleton h-11 rounded-[10px]" /><div className="skeleton h-11 rounded-[10px]" /></div><div className="overflow-hidden rounded-[10px] border border-[#e7e8ec]">{Array.from({ length: 4 }, (_, index) => <div key={index} className="grid grid-cols-[70px_1fr_120px] gap-4 border-b border-[#eeeeF1] px-4 py-4 last:border-b-0"><SkeletonBar className="h-3 w-12" /><SkeletonBar className={`h-3 ${index % 2 ? "w-2/3" : "w-4/5"}`} /><SkeletonBar className="h-3 w-20" /></div>)}</div></>}
        {stage === "DESIGN" && <><div className="flex items-center justify-between"><div className="space-y-2"><SkeletonBar className="h-2.5 w-32" /><SkeletonBar className="h-2 w-56" /></div><SkeletonBar className="h-8 w-24" /></div><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-3 rounded-[10px] border border-[#e7e8ec] p-4"><SkeletonBar className="h-3 w-2/5" /><SkeletonBar className="h-2.5 w-4/5" /><div className="skeleton h-10 rounded-[8px]" /></div>)}</div></>}
      </div>
      <div className="flex items-center justify-between border-t border-[#ededf0] bg-[#fafafd] px-4 py-3.5 sm:px-5"><SkeletonBar className="h-2.5 w-56 max-w-[55%]" /><div className="skeleton h-9 w-32 rounded-[9px]" /></div>
    </div>
  </Panel></div>;
}

const initialMessages: SetupMessage[] = [{
  id: "setup-welcome",
  role: "assistant",
  text: "Let’s build this together in one conversation. Start by describing how your organization is structured, or attach the org chart, spreadsheet, image, or notes you already have.",
}];

const suggestions: Record<ConfigurationStage, string[]> = {
  ORGANIZATION: ["We have a simple three-level organization", "I’ll upload our org chart", "Help me map our legal entities"],
  WORKFLOW: ["I own the assessments myself", "Use a single assessment owner", "Help me define the owner’s responsibilities"],
  SCENARIOS: ["I’ll upload our current risk library", "Draft scenarios from our business structure", "Keep our existing risk terminology"],
  DESIGN: ["We use likelihood × impact", "Include control effectiveness", "Recreate our current risk matrix"],
};

function setupMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function stageReady(stage: Stage, configuration: WorkspaceConfiguration) {
  if (stage === "ORGANIZATION") return Boolean(configuration.organizationName.trim() && configuration.units.length);
  if (stage === "WORKFLOW") return Boolean(configuration.review.assessorName.trim());
  if (stage === "SCENARIOS") return configuration.scenarios.length > 0;
  if (stage === "DESIGN") return configuration.fields.length > 0 && configuration.calculations.length > 0;
  return validateConfiguration(configuration).length === 0;
}

function PromptAttachments({ loading, aiConfigured, message }: { loading: boolean; aiConfigured: boolean | null; message: string }) {
  const attachments = usePromptInputAttachments();
  return <>
    {attachments.files.length > 0 && <PromptInputHeader className="gap-2 border-b border-[#ececf0] px-3 py-2.5">{attachments.files.map((file) => <span key={file.id} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-[#f0f1f5] px-2.5 py-1 text-[11px] font-medium text-[#656876]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{file.filename || "Attached file"}</span><button type="button" aria-label={`Remove ${file.filename || "file"}`} onClick={() => attachments.remove(file.id)} className="rounded-full p-0.5 hover:bg-white"><X className="h-3 w-3" /></button></span>)}</PromptInputHeader>}
    <PromptInputFooter className="px-3 pb-3">
      <PromptInputTools><PromptInputButton tooltip="Attach source material" onClick={() => attachments.openFileDialog()} className="rounded-lg px-2.5 text-[#6d7080]"><Paperclip className="h-4 w-4" /><span>Attach</span></PromptInputButton></PromptInputTools>
      <PromptInputSubmit status={loading ? "submitted" : "ready"} disabled={!aiConfigured || loading || (!message.trim() && attachments.files.length === 0)} className="h-9 w-9 rounded-[10px] bg-[#25262f] text-white hover:bg-[#3b3d49]" />
    </PromptInputFooter>
  </>;
}

function SetupArtifact({ stage, configuration, setConfiguration, confirmed, active, warnings, onConfirm, onComplete }: {
  stage: Stage;
  configuration: WorkspaceConfiguration;
  setConfiguration: (configuration: WorkspaceConfiguration) => void;
  confirmed: boolean;
  active: boolean;
  warnings: string[];
  onConfirm: () => void;
  onComplete: () => void;
}) {
  const definition = stage === "REVIEW" ? { label: "Workspace review", icon: CheckCircle2 } : setupStages.find((item) => item.stage === stage)!;
  const Icon = definition.icon;
  const ready = stageReady(stage, configuration);
  return <Panel className="enter-soft mt-3 w-full overflow-hidden border-[#dedfe5] shadow-[0_10px_36px_rgba(35,36,45,0.07)]">
    <div className="flex items-center gap-3 border-b border-[#ededf0] bg-[#fcfcfd] px-4 py-3.5 sm:px-5"><div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#eff1fb] text-[#586ad0]"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#2c2e38]">{definition.label}</p><p className="mt-0.5 text-[11px] text-[#818491]">Generated from this conversation · edit anything inline</p></div>{confirmed ? <Badge tone="success"><Check className="mr-1 h-3 w-3" />Confirmed</Badge> : <Badge tone="info">Draft</Badge>}</div>
    <div className="p-4 sm:p-5"><StructuredEditor stage={stage} configuration={configuration} setConfiguration={setConfiguration} /></div>
    {stage !== "ORGANIZATION" && stage !== "SCENARIOS" && stage !== "DESIGN" && warnings.length > 0 && <div className="border-t border-[#ead5a5] bg-[#fffaf0] px-4 py-3 sm:px-5">{warnings.slice(0, 5).map((warning) => <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-[#735d32]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</p>)}</div>}
    {stage === "REVIEW" ? <div className="flex flex-col gap-3 border-t border-[#ededf0] bg-[#fafafd] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs text-[#727584]">{ready ? "Everything is ready. You can still edit any component above." : "Resolve the checks in the review before creating the workspace."}</p><Button disabled={!ready} onClick={onComplete}>Create my workspace<CheckCircle2 className="h-4 w-4" /></Button></div> : active && !confirmed ? <div className="flex flex-col gap-3 border-t border-[#ededf0] bg-[#fafafd] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs text-[#727584]">{ready ? "Does this look right? You can keep editing after confirming." : "Add the required details before continuing."}</p><Button disabled={!ready} onClick={onConfirm}>Confirm {definition.label.toLowerCase()}<Check className="h-4 w-4" /></Button></div> : null}
  </Panel>;
}

export function Onboarding() {
  const { completeOnboarding, loadSample } = useKimsy();
  const [configuration, setConfiguration] = useState<WorkspaceConfiguration>(() => clone(starterConfiguration));
  const [messages, setMessages] = useState<SetupMessage[]>(initialMessages);
  const [activeStage, setActiveStage] = useState<Stage>("ORGANIZATION");
  const [confirmedStages, setConfirmedStages] = useState<ConfigurationStage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ai/status").then((response) => response.json()).then((result) => setAiConfigured(Boolean(result.configured))).catch(() => setAiConfigured(false));
  }, []);

  const latestArtifacts = new Map<Stage, string>();
  messages.forEach((item) => { if (item.artifactStage) latestArtifacts.set(item.artifactStage, item.id); });
  const activeDefinition = activeStage === "REVIEW" ? null : setupStages.find((item) => item.stage === activeStage)!;
  const progressIndex = activeStage === "REVIEW" ? setupStages.length : setupStages.findIndex((item) => item.stage === activeStage);

  const sendToKimsy = async (input: PromptInputMessage) => {
    if (activeStage === "REVIEW" || (!input.text.trim() && input.files.length === 0)) return;
    setLoading(true);
    setError("");
    const userMessage: SetupMessage = { id: setupMessageId("user"), role: "user", text: input.text.trim() || "Please review the attached source material.", sourceNames: input.files.map((file) => file.filename || "Attached file") };
    const assistantId = setupMessageId("assistant");
    const submittedStage = activeStage;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", text: "", pendingArtifactStage: submittedStage, streaming: true }]);
    setMessage("");
    try {
      const uploadedFiles = await Promise.all(input.files.map(async (file) => {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`Could not read ${file.filename || "an attached file"}.`);
        const blob = await response.blob();
        return new File([blob], file.filename || "source-file", { type: file.mediaType || blob.type });
      }));
      const form = new FormData();
      form.append("stage", activeStage);
      form.append("message", userMessage.text);
      form.append("configuration", JSON.stringify(configuration));
      form.append("conversation", [...messages, userMessage].map((item) => `${item.role === "assistant" ? "Kimsy" : "User"}: ${item.text}`).join("\n"));
      uploadedFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/ai/configure", { method: "POST", body: form });
      if (!response.ok) {
        const result = await readJsonResponse(response);
        throw new Error(String(result.error ?? "Kimsy could not interpret that material."));
      }
      let receivedResult = false;
      const finalState = await consumeSetupAgentStream(response, (state) => {
        if (state.result) {
          receivedResult = true;
          setConfiguration(state.result.configuration);
        }
        setMessages((current) => current.map((item) => item.id === assistantId ? {
          ...item,
          text: state.text || item.text,
          artifactStage: state.result ? submittedStage : item.artifactStage,
          pendingArtifactStage: state.result ? undefined : item.pendingArtifactStage,
          sourceNames: state.result ? state.result.sources.map((source) => source.name || "Source material") : item.sourceNames,
          warnings: state.result?.warnings ?? item.warnings,
          streaming: true,
        } : item));
      });
      if (!receivedResult || !finalState.result) throw new Error("Kimsy’s response ended before the setup proposal was ready.");
      setMessages((current) => current.map((item) => item.id === assistantId ? {
        ...item,
        text: finalState.text || "I’ve turned that into a structured proposal for you to review.",
        streaming: false,
      } : item));
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setError(caught instanceof Error ? caught.message : "Kimsy could not interpret that material.");
      throw caught;
    } finally {
      setLoading(false);
    }
  };

  const revealManualEditor = () => {
    if (activeStage === "REVIEW" || latestArtifacts.has(activeStage)) return;
    setMessages((current) => [...current, {
      id: setupMessageId("manual"),
      role: "assistant",
      text: "Of course. Start with the editable structure below, and tell me whenever you want help refining it.",
      artifactStage: activeStage,
    }]);
  };

  const confirmStage = (stage: ConfigurationStage) => {
    if (!stageReady(stage, configuration)) return;
    if (stage === "WORKFLOW" && (configuration.review.mode !== "SOLO" || configuration.review.reviewerName)) {
      setConfiguration({ ...configuration, review: { ...configuration.review, mode: "SOLO", reviewerName: "" } });
    }
    const index = setupStages.findIndex((item) => item.stage === stage);
    const next = setupStages[index + 1];
    setConfirmedStages((current) => current.includes(stage) ? current : [...current, stage]);
    if (next) {
      setActiveStage(next.stage);
      setMessages((current) => [...current,
        { id: setupMessageId("confirmed"), role: "user", text: `${setupStages[index].label} looks right. Let’s continue.` },
        { id: setupMessageId("question"), role: "assistant", text: next.prompt },
      ]);
    } else {
      setActiveStage("REVIEW");
      setMessages((current) => [...current,
        { id: setupMessageId("confirmed"), role: "user", text: "The assessment method looks right." },
        { id: setupMessageId("review"), role: "assistant", text: "That gives us a complete first version. Review the workspace summary below, make any last edits, and create it when you’re ready.", artifactStage: "REVIEW" },
      ]);
    }
    setMessage("");
    setError("");
  };

  return <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
    <header className="shrink-0"><div className="mx-auto flex h-[72px] max-w-[1180px] items-center px-4 sm:px-6"><BrandMark className="h-7 w-7" /><p className="font-display ml-2 text-[26px] leading-none text-[#20212a]">Kimsy</p><div className="ml-auto flex items-center gap-3"><p className="hidden text-xs text-[#858895] sm:block">Setup stays private to this browser</p><button onClick={loadSample} className="rounded-full border border-[#dedfe5] bg-white px-4 py-2 text-xs font-semibold text-[#4e5261] shadow-sm hover:bg-[#f9f9fb]">Explore sample workspace</button></div></div></header>
    <main className="mx-auto flex w-full max-w-[1080px] flex-1 min-h-0 px-3 pb-3 sm:px-6 sm:pb-6">
      <section className="flex min-h-[680px] w-full flex-col overflow-hidden rounded-[22px] border border-[#e2e3e8] bg-white shadow-[var(--shadow-panel)]" aria-label="Workspace setup conversation">
        <div className="flex shrink-0 flex-col gap-3 border-b border-[#ededf0] bg-[#fcfcfd] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#727687]">Workspace setup</p><h1 className="font-display mt-1 text-[27px] text-[#25262f]">Build it with Kimsy</h1></div><div className="flex items-center gap-1.5">{setupStages.map((item, index) => <div key={item.stage} title={item.label} className={`h-2 rounded-full transition-all ${index < progressIndex ? "w-5 bg-[#586ad0]" : index === progressIndex ? "w-8 bg-[#586ad0]" : "w-5 bg-[#dedfe5]"}`} />)}<span className="ml-2 text-[11px] font-medium text-[#777a88]">{activeStage === "REVIEW" ? "Ready to review" : `${progressIndex + 1} of ${setupStages.length} · ${activeDefinition?.label}`}</span></div></div>

        {aiConfigured === false && <div className="flex shrink-0 items-start gap-3 border-b border-[#ead5a5] bg-[#fffaf0] px-4 py-3 sm:px-6"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6417]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#765514]">AI setup needs an API key</p><p className="mt-1 text-xs leading-5 text-[#7c6a45]">Add <code className="rounded bg-white px-1 py-0.5">OPENAI_API_KEY</code> to <code className="rounded bg-white px-1 py-0.5">.env.local</code> and restart. You can still complete every section manually.</p></div><button onClick={revealManualEditor} className="shrink-0 text-xs font-semibold text-[#765514] underline underline-offset-2">Set up manually</button></div>}

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-[900px] gap-6 px-4 py-7 sm:px-6 sm:py-9">
            {messages.map((item) => <Message from={item.role} key={item.id} className="max-w-full">
              {item.role === "assistant" && <div className="flex items-center gap-2 text-[11px] font-semibold text-[#666a79]"><span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#eff1fb] text-[#586ad0]"><Sparkles className="h-3.5 w-3.5" /></span>Kimsy</div>}
              <MessageContent className={item.role === "assistant" ? "w-full max-w-[760px]" : "max-w-[82%] rounded-[14px] bg-[#f0f1f4] px-4 py-3"}>{item.streaming && !item.text ? <div className="flex items-center gap-2 py-2 text-sm text-[#767987]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#586ad0]" />Structuring your material…</div> : <MessageResponse className="text-[14px] leading-7 text-[#3e414d]">{item.text}</MessageResponse>}</MessageContent>
              {item.sourceNames && item.sourceNames.length > 0 && <div className={`flex flex-wrap gap-1.5 ${item.role === "user" ? "justify-end" : ""}`}>{item.sourceNames.map((name, index) => <span key={`${name}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-[#e0e1e6] bg-white px-2.5 py-1 text-[10px] font-medium text-[#696c79]"><Paperclip className="h-3 w-3" />{name}</span>)}</div>}
              {item.pendingArtifactStage && !item.artifactStage && <SetupArtifactSkeleton stage={item.pendingArtifactStage} />}
              {item.artifactStage && latestArtifacts.get(item.artifactStage) === item.id && <SetupArtifact stage={item.artifactStage} configuration={configuration} setConfiguration={setConfiguration} confirmed={item.artifactStage !== "REVIEW" && confirmedStages.includes(item.artifactStage)} active={activeStage === item.artifactStage} warnings={item.warnings ?? []} onConfirm={() => confirmStage(item.artifactStage as ConfigurationStage)} onComplete={() => completeOnboarding(configuration)} />}
            </Message>)}
          </ConversationContent>
          <ConversationScrollButton className="bottom-3" />
        </Conversation>

        {activeStage !== "REVIEW" ? <div className="shrink-0 border-t border-[#ededf0] bg-[#fcfcfd] px-3 py-3 sm:px-5 sm:py-4"><div className="mx-auto max-w-[860px]">{!latestArtifacts.has(activeStage) && <div className="mb-3 flex items-center gap-2"><Suggestions>{suggestions[activeStage].map((suggestion) => <Suggestion key={suggestion} suggestion={suggestion} onClick={setMessage} className="h-8 border-[#e2e3e8] bg-white px-3 text-[11px] text-[#646775] shadow-sm hover:bg-[#f5f5f8]" />)}</Suggestions><button onClick={revealManualEditor} className="hidden shrink-0 text-[11px] font-semibold text-[#586ad0] sm:block">Enter manually</button></div>}<PromptInput onSubmit={sendToKimsy} onError={(inputError) => setError(inputError.message)} accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/*" multiple maxFiles={8} maxFileSize={15 * 1024 * 1024} className="rounded-[16px] bg-white shadow-[0_8px_28px_rgba(35,36,45,0.08)]"><PromptInputTextarea aria-label="Message Kimsy" value={message} onChange={(event) => setMessage(event.target.value)} disabled={loading} placeholder={activeDefinition?.prompt} className="min-h-[72px] px-4 pt-3 text-sm leading-6" /><PromptAttachments loading={loading} aiConfigured={aiConfigured} message={message} /></PromptInput>{error && <p className="mt-2 flex items-start gap-2 px-1 text-xs leading-5 text-[#9d3328]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}</div></div> : <div className="shrink-0 border-t border-[#ededf0] bg-[#fcfcfd] px-5 py-3 text-center text-xs text-[#7b7e8c]">Review the inline components above. Nothing is saved until you create the workspace.</div>}
      </section>
    </main>
  </div>;
}
