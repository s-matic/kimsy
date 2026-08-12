import { NextResponse } from "next/server";
import { extractFrameworkSource } from "@/lib/framework-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A framework source file is required." }, { status: 400 });
    }
    const result = await extractFrameworkSource(file);
    return NextResponse.json({
      ...result,
      preview: result.sections.slice(0, 4).map((section) => `${section.locator}: ${section.text}`).join("\n"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import framework source";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
