import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "@e965/xlsx";

export interface ExtractedSection {
  locator: string;
  text: string;
}

export interface ExtractedFrameworkSource {
  fileName: string;
  mediaType: string;
  sections: ExtractedSection[];
}

function extension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export async function extractFrameworkSource(file: File): Promise<ExtractedFrameworkSource> {
  if (file.size > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
  const ext = extension(file.name);
  if (!new Set(["pdf", "docx", "xlsx", "csv"]).has(ext)) {
    throw new Error("Supported formats are PDF, DOCX, XLSX, and CSV.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let sections: ExtractedSection[] = [];

  if (ext === "pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      sections = result.pages
        .map((page) => ({ locator: `page ${page.num}`, text: normalize(page.text) }))
        .filter((section) => section.text);
    } finally {
      await parser.destroy();
    }
  } else if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    sections = result.value
      .split(/\n\s*\n/)
      .map(normalize)
      .filter(Boolean)
      .map((text, index) => ({ locator: `paragraph ${index + 1}`, text }));
  } else {
    const workbook = XLSX.read(bytes, { type: "array" });
    sections = workbook.SheetNames.flatMap((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<Array<unknown>>(workbook.Sheets[sheetName], {
        header: 1,
        blankrows: false,
        defval: "",
      });
      return rows
        .map((row, index) => ({
          locator: `${sheetName}, row ${index + 1}`,
          text: normalize(row.map(String).join(" | ")),
        }))
        .filter((section) => section.text);
    });
  }

  if (!sections.length) throw new Error("No readable content was found in the uploaded file.");
  return { fileName: file.name, mediaType: file.type || ext, sections };
}
