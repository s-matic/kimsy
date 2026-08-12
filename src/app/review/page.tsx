"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Filter, ShieldCheck } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Panel } from "@/components/ui";
import { useKimsy } from "@/lib/store";

const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export default function ReviewPage() {
  const { state } = useKimsy();
  const items = state.assessments.flatMap((assessment) => assessment.exceptions.map((exception) => ({ assessment, exception }))).filter(({ exception }) => exception.status === "OPEN").sort((a, b) => rank[b.exception.severity] - rank[a.exception.severity]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Review by exception" title="Compliance review queue" description="Questionable ratings, missing evidence, material changes, and appetite breaches requiring human judgment." actions={<Button variant="secondary"><Filter className="h-4 w-4" />Filter queue</Button>} />
      <div className="grid gap-4 sm:grid-cols-3"><Panel className="px-5 py-4"><p className="text-xs text-[#6b7873]">Open exceptions</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></Panel><Panel className="px-5 py-4"><p className="text-xs text-[#6b7873]">Critical or high</p><p className="mt-2 text-2xl font-semibold text-[#a42c21]">{items.filter(({ exception }) => ["Critical", "High"].includes(exception.severity)).length}</p></Panel><Panel className="px-5 py-4"><p className="text-xs text-[#6b7873]">Assessments affected</p><p className="mt-2 text-2xl font-semibold">{new Set(items.map(({ assessment }) => assessment.id)).size}</p></Panel></div>
      <Panel className="overflow-hidden">
        {items.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Queue is clear" description="There are no unresolved exceptions requiring compliance attention." /> : <div className="divide-y divide-[#e2e7e5]">{items.map(({ assessment, exception }) => <div key={exception.id} className="grid gap-4 px-5 py-5 hover:bg-[#fafcfb] md:grid-cols-[34px_minmax(0,1fr)_170px_110px_36px] md:items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-[4px] ${exception.severity === "Critical" ? "bg-[#8f1c14] text-white" : "bg-[#fff0ee] text-[#a42c21]"}`}>{exception.kind === "APPETITE_BREACH" ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{exception.title}</p><Badge tone={exception.severity === "Critical" ? "critical" : exception.severity === "High" ? "danger" : "warning"}>{exception.severity}</Badge></div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#66746e]">{exception.detail}</p></div><div><p className="text-xs font-semibold">{assessment.businessUnit}</p><p className="mt-1 text-[11px] text-[#7b8782]">{assessment.reference}</p></div><Badge tone="info">{assessment.operatingModelSnapshot === "FIRST_LINE_LED" ? "Review" : "Officer check"}</Badge><Link href={`/assessments/${assessment.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] text-[#52605b] hover:bg-[#edf2f0]" aria-label={`Review ${exception.title}`}><ArrowRight className="h-4 w-4" /></Link></div>)}</div>}
      </Panel>
    </div>
  );
}
