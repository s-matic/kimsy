"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileWarning,
  TrendingUp,
} from "lucide-react";
import { Badge, Metric, PageHeader, Panel, PanelHeader, Progress } from "@/components/ui";
import { ratingTone } from "@/lib/risk";
import { useKimsy } from "@/lib/store";

function statusBadge(status: string) {
  if (status === "FINALIZED") return <Badge tone="success">Finalized</Badge>;
  if (status === "IN_REVIEW") return <Badge tone="warning">In review</Badge>;
  if (status === "AI_DRAFT_READY") return <Badge tone="info">AI draft ready</Badge>;
  return <Badge>Fact gathering</Badge>;
}

export default function Home() {
  const { state } = useKimsy();
  const active = state.assessments.filter((assessment) => assessment.status !== "FINALIZED");
  const openExceptions = state.assessments.flatMap((assessment) => assessment.exceptions).filter((item) => item.status === "OPEN");
  const scenarios = state.assessments.flatMap((assessment) => assessment.scenarioAssessments);
  const breaches = scenarios.filter((scenario) => scenario.relevant && !scenario.withinAppetite);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance risk oversight"
        title="Good morning, Jordan"
        description="A focused view of assessments, exceptions, and material changes requiring attention."
        actions={
          <Link href="/assessments/new" className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-[#0f766e] bg-[#0f766e] px-3.5 text-sm font-semibold text-white hover:bg-[#0b625c]">
            New assessment
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <Panel className="grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active assessments" value={active.length} detail="Across 2 business units" />
        <Metric label="Open exceptions" value={openExceptions.length} detail="3 require compliance judgment" tone="danger" />
        <Metric label="Outside appetite" value={breaches.length} detail="1 material increase this period" tone="danger" />
        <Metric label="Evidence coverage" value="76%" detail="Up 8 points since last review" tone="success" />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)]">
        <Panel className="min-w-0 overflow-hidden">
          <PanelHeader
            title="Assessment portfolio"
            description="Current assessment cycles and completion"
            action={<Link href="/assessments" className="text-xs font-semibold text-[#0f766e] hover:underline">View all</Link>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e2e7e5] bg-[#f8faf9] text-[10px] font-bold uppercase text-[#71807a]">
                  <th className="px-5 py-3">Business unit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-5 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {state.assessments.map((assessment) => (
                  <tr key={assessment.id} className="border-b border-[#e7ebe9] last:border-b-0 hover:bg-[#fafcfb]">
                    <td className="px-5 py-4">
                      <Link href={`/assessments/${assessment.id}`} className="text-sm font-semibold text-[#1c2824] hover:text-[#0f766e]">{assessment.businessUnit}</Link>
                      <p className="mt-1 text-[11px] text-[#77837e]">{assessment.reference} · {assessment.period}</p>
                    </td>
                    <td className="px-4 py-4">{statusBadge(assessment.status)}</td>
                    <td className="px-4 py-4 text-xs text-[#4d5b56]">{assessment.owner}</td>
                    <td className="w-44 px-4 py-4"><Progress value={assessment.completion} /></td>
                    <td className="px-5 py-4 text-right text-xs text-[#4d5b56]">{assessment.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Your priority actions" description="Ordered by urgency and impact" />
          <div className="divide-y divide-[#e7ebe9]">
            {state.tasks.filter((task) => !task.complete).map((task) => (
              <div key={task.id} className="flex gap-3 px-4 py-4 sm:px-5">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] ${task.priority === "High" ? "bg-[#fff0ee] text-[#b42318]" : "bg-[#fff7df] text-[#8a6417]"}`}>
                  {task.priority === "High" ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-5 text-[#26322e]">{task.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#76827d]">{task.context}</p>
                </div>
                <span className="text-[11px] font-semibold text-[#825b15]">{task.due}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Exposure requiring attention" description="Relevant scenarios outside appetite or materially changed" />
          <div className="divide-y divide-[#e7ebe9]">
            {breaches.map((scenario) => {
              const risk = state.frameworkVersions[0].scenarios.find((item) => item.id === scenario.scenarioId);
              return (
                <div key={scenario.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[#fff0ee] text-[#b42318]"><FileWarning className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#26322e]">{risk?.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#78847f]">{risk?.code} · {risk?.category}</p>
                  </div>
                  <Badge tone={ratingTone(scenario.proposedRating)}>{scenario.proposedRating}</Badge>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent material changes" description="Business changes tracked for reassessment" />
          <div className="divide-y divide-[#e7ebe9]">
            {state.changes.map((change) => (
              <div key={change.id} className="flex gap-4 px-5 py-4">
                <div className="mt-0.5 text-[#0f766e]">{change.impactStatus === "Assessed" ? <CheckCircle2 className="h-5 w-5" /> : <CircleDot className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#26322e]">{change.title}</p>
                    <Badge tone={change.impactStatus === "Assessed" ? "success" : "warning"}>{change.impactStatus}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#687670]">{change.detail}</p>
                  <p className="mt-1.5 text-[11px] text-[#87918d]">{change.businessUnit} · {change.recordedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#76837e]">
        <TrendingUp className="h-3.5 w-3.5 text-[#0f766e]" />
        Portfolio data last recalculated today at 09:42 using framework v4.2.
        <CalendarDays className="ml-2 h-3.5 w-3.5" />
        Next scheduled review: 28 Aug 2026.
      </div>
    </div>
  );
}
