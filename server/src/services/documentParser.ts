import mammoth from "mammoth";
import pdf from "pdf-parse";
import { normalizeText } from "./text.js";

export async function parseDocument(buffer: Buffer, filename: string, fallbackText = ""): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const parsed = await pdf(buffer);
    return normalizeText(parsed.text);
  }
  if (lower.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value);
  }
  return normalizeText(fallbackText || buffer.toString("utf8"));
}
