"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { EmptyState, Panel } from "@/components/ui";
import { useKimsy } from "@/lib/store";

export default function LegacyAssessmentRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, hydrated } = useKimsy();
  const assessment = state.assessments.find((item) => item.id === params.id);

  useEffect(() => {
    if (!hydrated || !assessment) return;
    router.replace(`/register?unit=${encodeURIComponent(assessment.unitId)}`);
  }, [assessment, hydrated, router]);

  if (!hydrated || assessment) {
    return <div className="flex min-h-72 items-center justify-center text-[#777a88]"><LoaderCircle className="h-5 w-5 animate-spin" aria-label="Opening risk register" /></div>;
  }

  return <Panel><EmptyState icon={<ArrowLeft className="h-5 w-5" />} title="Assessment not found" description="Return to the risk register and choose an available scenario." /><div className="flex justify-center border-t border-[#ededf0] p-4"><Link href="/register" className="text-sm font-semibold text-[#586ad0]">Open risk register</Link></div></Panel>;
}
