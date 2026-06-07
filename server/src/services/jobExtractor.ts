import { jobDescriptionSchema, type JobDescription } from "../../../shared/schemas.js";
import { splitLines, unique } from "./text.js";
import { llmClient } from "./llmClient.js";

const commonSkills = [
  "typescript", "javascript", "react", "node", "python", "sql", "aws", "azure", "gcp",
  "kubernetes", "docker", "api", "leadership", "mentoring", "stakeholder", "analytics",
  "communication", "security", "architecture", "machine learning"
];

function heuristicExtract(rawText: string): JobDescription {
  const lines = splitLines(rawText);
  const lower = rawText.toLowerCase();
  const requiredSkills = unique(commonSkills.filter((skill) => lower.includes(skill)));
  const responsibilities = lines.filter((line) => /lead|build|own|manage|design|partner|deliver|develop/i.test(line)).slice(0, 12);
  const leadershipRequirements = lines.filter((line) => /mentor|lead|stakeholder|manager|ownership|cross-functional/i.test(line)).slice(0, 8);
  const technicalRequirements = lines.filter((line) => /system|api|cloud|database|architecture|software|platform|data/i.test(line)).slice(0, 10);
  const softSkills = unique(["communication", "collaboration", "ownership"].filter((skill) => lower.includes(skill)));

  return {
    title: lines[0],
    requiredSkills,
    preferredSkills: [],
    seniority: /senior|staff|principal|director|vp/i.test(rawText) ? "Senior" : "Not specified",
    responsibilities,
    leadershipRequirements,
    technicalRequirements,
    softSkills,
    rawText
  };
}

export async function extractJobDescription(rawText: string): Promise<JobDescription> {
  const fallback = heuristicExtract(rawText);
  return llmClient.generateJson(
    [
      { role: "system", content: "Extract job requirements as JSON. Only include requirements supported by the text." },
      { role: "user", content: `Return JSON matching this shape: title, company, requiredSkills, preferredSkills, seniority, responsibilities, leadershipRequirements, technicalRequirements, softSkills, rawText.\nJob description:\n${rawText}` }
    ],
    jobDescriptionSchema,
    fallback
  );
}
