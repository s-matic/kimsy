import { NextResponse } from "next/server";
import { assessmentRequestSchema } from "@/lib/ai/schema";
import { getAiProvider } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = assessmentRequestSchema.parse(await request.json());
    const result = await getAiProvider().buildAssessment(input);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate assessment";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
