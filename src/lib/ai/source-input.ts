import "server-only";
import { extractFrameworkSource } from "@/lib/framework-import";
import type { AiImageInput, AiSourceInput } from "@/lib/ai/source-types";
import type { SourceDocument } from "@/lib/types";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 60 * 1024 * 1024;

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function isImage(file: File) {
  return IMAGE_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(extension(file.name));
}

function imageMediaType(file: File) {
  if (IMAGE_TYPES.has(file.type)) return file.type;
  const ext = extension(file.name);
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

export async function prepareAiInput(formData: FormData): Promise<{
  input: AiSourceInput;
  sources: SourceDocument[];
}> {
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 8) throw new Error("Attach no more than 8 files at a time.");
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) throw new Error("Attachments must be 60 MB or smaller in total.");

  const textParts: string[] = [];
  const images: AiImageInput[] = [];
  const sources: SourceDocument[] = [];

  for (const [index, file] of files.entries()) {
    if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} is larger than 25 MB.`);
    if (isImage(file)) {
      const mediaType = imageMediaType(file);
      const bytes = Buffer.from(await file.arrayBuffer());
      images.push({
        data: bytes.toString("base64"),
        mediaType,
        filename: file.name,
      });
      textParts.push(`IMAGE SOURCE: ${file.name}\n[image 1] Visual source attached after this text.`);
      sources.push({
        id: `source-${Date.now()}-${index}`,
        name: file.name,
        mediaType,
        size: file.size,
        locators: ["image 1"],
        addedAt: "Just now",
      });
      continue;
    }

    const extracted = await extractFrameworkSource(file);
    const readable = extracted.sections
      .map((section) => `[${section.locator}] ${section.text}`)
      .join("\n")
      .slice(0, 80000);
    textParts.push(`SOURCE: ${file.name}\n${readable}`);
    sources.push({
      id: `source-${Date.now()}-${index}`,
      name: file.name,
      mediaType: extracted.mediaType,
      size: file.size,
      locators: extracted.sections.slice(0, 30).map((section) => section.locator),
      addedAt: "Just now",
    });
  }

  return {
    input: { text: textParts.join("\n\n").slice(0, 160000), images },
    sources,
  };
}
