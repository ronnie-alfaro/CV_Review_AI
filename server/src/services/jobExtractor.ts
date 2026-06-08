import { jobDescriptionSchema, type JobDescription } from "../../../shared/schemas.js";
import { splitLines, unique } from "./text.js";
import { llmClient } from "./llmClient.js";
import { buildStructuredPrompt } from "./promptBuilder.js";

const commonSkills = [
  "typescript", "javascript", "react", "node", "python", "sql", "aws", "azure", "gcp",
  "kubernetes", "docker", "api", "leadership", "mentoring", "stakeholder", "analytics",
  "communication", "security", "architecture", "machine learning", "llm", "rag", "vector databases",
  "semantic search", "fastapi", "postgresql", "incident management", "lean six sigma", "gitlab"
];

function splitSentences(rawText: string): string[] {
  return splitLines(rawText)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter((line) => line.length > 8);
}

function extractListedSkills(text: string, marker: RegExp): string[] {
  const match = text.match(marker);
  if (!match?.[1]) return [];
  return match[1]
    .split(/,|;|\band\b/i)
    .map((item) => item.replace(/\.$/, "").trim())
    .filter((item) => item.length > 1);
}

function splitListedItems(value: string): string[] {
  return value
    .split(/,\s*|\band\b/i)
    .map((item) => item.replace(/\.$/, "").trim())
    .filter((item) => item.length > 6);
}

function extractMarkedList(text: string, marker: RegExp): string[] {
  const match = text.match(marker);
  return match?.[1] ? splitListedItems(match[1]) : [];
}

function isContextOnlyLine(value: string): boolean {
  return (
    /^(required skills|preferred experience|responsibilities|strong communication)/i.test(value) ||
    /^we are looking for/i.test(value) ||
    /^https?:\/\//i.test(value) ||
    value.length < 10
  );
}

function sameNormalized(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function cleanRequirementLines(values: string[], title?: string): string[] {
  return unique(values
    .map((value) => value.trim().replace(/\.$/, ""))
    .filter((value) => !isContextOnlyLine(value))
    .filter((value) => !title || !sameNormalized(value, title)));
}

function cleanSkills(values: string[], demote: string[] = []): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim().replace(/\.$/, ""))
    .filter((value) => value.length > 1)
    .filter((value) => !demote.some((preferred) => sameNormalized(value, preferred)))
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function isInvalidTitle(value?: string): boolean {
  if (!value) return true;
  const clean = value.trim();
  return /^https?:\/\//i.test(clean) || /gitlab\.com|github\.com|linkedin\.com/i.test(clean) || clean.length > 90;
}

function inferTitle(lines: string[]): string | undefined {
  return lines.find((line) => {
    const clean = line.trim();
    if (isInvalidTitle(clean)) return false;
    if (/job description|responsibilities|requirements|skills|about the role|about us/i.test(clean)) return false;
    if (/\b(engineer|developer|manager|director|architect|analyst|designer|consultant|specialist|lead|principal|staff|senior|head|vp)\b/i.test(clean)) return true;
    return false;
  });
}

function heuristicExtract(rawText: string): JobDescription {
  const lines = splitLines(rawText);
  const sentences = splitSentences(rawText);
  const lower = rawText.toLowerCase();
  const explicitRequired = extractListedSkills(rawText, /required skills include\s+(.+?)(?:\.|responsibilities include|preferred experience includes|strong communication|$)/i);
  const explicitPreferred = extractListedSkills(rawText, /preferred experience includes\s+(.+?)(?:\.|strong communication|$)/i);
  const explicitResponsibilities = extractMarkedList(rawText, /responsibilities include\s+(.+?)(?:\.|preferred experience includes|strong communication|$)/i);
  const inferredSkills = commonSkills.filter((skill) => lower.includes(skill) && !explicitPreferred.some((preferred) => sameNormalized(skill, preferred)));
  const requiredSkills = cleanSkills(explicitRequired.length ? explicitRequired : inferredSkills);
  const responsibilities = unique(sentences.flatMap((sentence) => {
    if (/responsibilities include/i.test(sentence)) return [];
    if (isContextOnlyLine(sentence)) return [];
    if (/required skills|preferred experience/i.test(sentence)) return [];
    return /lead|build|own|manage|design|partner|deliver|develop|improv|translat/i.test(sentence) ? [sentence] : [];
  })).slice(0, 12);
  const leadershipRequirements = unique([
    ...explicitRequired.filter((item) => /leadership|mentor|stakeholder|management/i.test(item)),
    ...explicitResponsibilities.filter((item) => /lead|team|stakeholder|partner/i.test(item)),
    ...sentences.filter((line) => !isContextOnlyLine(line) && !/required skills|preferred experience/i.test(line) && /mentor|lead|stakeholder|manager|ownership|cross-functional|team|communication/i.test(line))
  ]).slice(0, 8);
  const technicalRequirements = unique([
    ...explicitRequired.filter((item) => /llm|rag|vector|api|cloud|aws|docker|kubernetes|python|database|platform|fastapi|postgres/i.test(item)),
    ...explicitResponsibilities.filter((item) => /ai|automation|platform|reliability|workflow|system|api|data/i.test(item)),
    ...sentences.filter((line) => !isContextOnlyLine(line) && !/required skills|preferred experience/i.test(line) && /system|api|cloud|database|architecture|software|platform|data|automation|reliability|llm|rag|vector/i.test(line))
  ]).slice(0, 10);
  const softSkills = unique(["communication", "collaboration", "ownership"].filter((skill) => lower.includes(skill)));

  return {
    title: inferTitle(lines),
    requiredSkills,
    preferredSkills: cleanSkills(explicitPreferred),
    seniority: /senior|staff|principal|director|vp/i.test(rawText) ? "Senior" : "Not specified",
    responsibilities: unique([...explicitResponsibilities, ...responsibilities]).slice(0, 12),
    leadershipRequirements,
    technicalRequirements,
    softSkills,
    rawText
  };
}

export async function extractJobDescription(rawText: string): Promise<JobDescription> {
  const fallback = heuristicExtract(rawText);
  const prompt = buildStructuredPrompt({
    persona: "You are a job requisition analysis panel: an ATS job parser, recruiter, hiring manager, and compensation/workforce taxonomy analyst.",
    task: "Extract job requirements as structured ATS-style job data.",
    context: `Job description text:\n${rawText}`,
    instructions: [
      "Extract title, company, seniority, required skills, preferred skills, responsibilities, leadership requirements, technical requirements, and soft skills.",
      "Rank strict requirements separately from preferred/nice-to-have language.",
      "Use title only if it is a real role title, not a URL, company boilerplate, or section label."
    ],
    constraints: [
      "Do not invent requirements not present in the job description.",
      "Do not use URLs as title or company.",
      "Return only valid JSON matching the schema."
    ],
    outputFormat: "JSON matching jobDescriptionSchema.",
    recap: "Structured job extraction only. Preserve requirement categories. No URLs as role titles."
  });
  const parsed = await llmClient.generateJson(
    [
      { role: "system", content: "Follow the structured prompt exactly. Output JSON only." },
      { role: "user", content: prompt }
    ],
    jobDescriptionSchema,
    fallback
  );
  const title = isInvalidTitle(parsed.title) ? fallback.title : parsed.title;
  const preferredSkills = cleanSkills(parsed.preferredSkills.length ? parsed.preferredSkills : fallback.preferredSkills);
  const requiredSkills = cleanSkills(parsed.requiredSkills.length ? parsed.requiredSkills : fallback.requiredSkills, preferredSkills);
  const responsibilities = cleanRequirementLines(parsed.responsibilities.length ? parsed.responsibilities : fallback.responsibilities, title);
  const leadershipRequirements = cleanRequirementLines(parsed.leadershipRequirements.length ? parsed.leadershipRequirements : fallback.leadershipRequirements, title);
  const technicalRequirements = cleanRequirementLines(parsed.technicalRequirements.length ? parsed.technicalRequirements : fallback.technicalRequirements, title);
  return {
    ...parsed,
    title,
    requiredSkills,
    preferredSkills,
    responsibilities: responsibilities.length ? responsibilities : fallback.responsibilities,
    leadershipRequirements: leadershipRequirements.length ? leadershipRequirements : fallback.leadershipRequirements,
    technicalRequirements: technicalRequirements.length ? technicalRequirements : fallback.technicalRequirements,
    rawText
  };
}
