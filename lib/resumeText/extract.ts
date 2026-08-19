import type { ResumeExtractionStatus } from "@/lib/types/enums";
import { getLogger } from "@/lib/logging";

export interface TextExtractionResult {
  status: ResumeExtractionStatus;
  text: string;
  error?: string;
}

const MIN_MEANINGFUL_CHARS = 50;

function isPdf(mimeType: string, fileName: string) {
  return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

function isDocx(mimeType: string, fileName: string) {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  );
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Imported dynamically, server-only — see next.config.ts's serverExternalPackages.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

/**
 * Extracts plain text from an uploaded resume file. Only PDF and DOCX are supported — anything
 * else (including scanned/image-only PDFs, which come back with near-zero extractable text) is
 * surfaced as an explicit status the UI turns into a manual-correction prompt, never a silent
 * guess.
 */
export async function extractResumeText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<TextExtractionResult> {
  if (!isPdf(mimeType, fileName) && !isDocx(mimeType, fileName)) {
    return {
      status: "UNSUPPORTED_FORMAT",
      text: "",
      error: "Only PDF and DOCX files are supported right now. Try exporting to one of those, or paste your resume text directly.",
    };
  }

  try {
    const text = isPdf(mimeType, fileName)
      ? await extractPdfText(buffer)
      : await extractDocxText(buffer);

    const meaningfulLength = text.replace(/\s+/g, " ").trim().length;

    if (meaningfulLength < MIN_MEANINGFUL_CHARS) {
      return {
        status: "FAILED",
        text,
        error:
          "We couldn't extract readable text from this file — it may be a scanned image rather than a text-based document. Please upload a text-based PDF/DOCX, or paste your resume text directly.",
      };
    }

    return { status: "SUCCESS", text };
  } catch (err) {
    // Was previously a bare `catch {}` -- swallowed the real error entirely, so a production
    // failure left no trace to diagnose from. Logged now; user-facing behavior is unchanged.
    getLogger().error("Resume text extraction threw", {
      fileName,
      mimeType,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    });
    return {
      status: "FAILED",
      text: "",
      error:
        "We couldn't parse this file. Please try re-exporting it, or paste your resume text directly.",
    };
  }
}
