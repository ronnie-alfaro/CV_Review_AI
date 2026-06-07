import { candidateProfileSchema, type CandidateProfile } from "../../../shared/schemas.js";
import { findSection, splitLines, unique } from "./text.js";
import { llmClient } from "./llmClient.js";

const skillHints = [
  "typescript", "javascript", "react", "node", "python", "sql", "aws", "azure", "gcp",
  "kubernetes", "docker", "api", "leadership", "mentoring", "stakeholder", "analytics",
  "prisma", "postgresql", "sqlite", "machine learning", "customer", "security"
];

function classifyHeading(heading: string): string {
  const normalized = heading.toLowerCase().replace(/&/g, " and ");
  if (/summary|profile|objective/.test(normalized)) return "summary";
  if (/experience|employment|work history|career/.test(normalized)) return "experience";
  if (/skill|technology|tool|competenc/.test(normalized)) return "skills";
  if (/education|academic|degree/.test(normalized)) return "education";
  if (/certification|certificate|credential|license/.test(normalized)) return "certifications";
  if (/project|portfolio/.test(normalized)) return "projects";
  if (/achievement|accomplishment|award|honor/.test(normalized)) return "achievements";
  if (/language/.test(normalized)) return "languages";
  if (/publication|speaking|conference|presentation/.test(normalized)) return "publications";
  return "other";
}

function looksLikeSectionHeading(line: string): boolean {
  const clean = line.trim().replace(/:$/, "");
  if (/^[-•]/.test(clean)) return false;
  if (clean.length < 3 || clean.length > 70) return false;
  const normalized = clean.toLowerCase();
  if (/(summary|profile|experience|employment|work history|skills|technical skills|education|certification|certificate|project|achievement|award|language|publication|speaking|volunteer|community|patent|research)/i.test(clean)) return true;
  return clean === clean.toUpperCase() && /[A-Z]/.test(clean);
}

function extractResumeSections(rawText: string): CandidateProfile["sections"] {
  const lines = splitLines(rawText);
  const sections: CandidateProfile["sections"] = [];
  let current: CandidateProfile["sections"][number] | undefined;

  for (const line of lines) {
    if (looksLikeSectionHeading(line)) {
      if (current) sections.push(current);
      const heading = line.replace(/:$/, "").trim();
      current = { heading, kind: classifyHeading(heading), lines: [] };
      continue;
    }
    if (!current) {
      current = { heading: "Header", kind: "header", lines: [] };
    }
    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections.filter((section) => section.lines.length > 0 || section.kind !== "header");
}

function findPhone(rawText: string): string | undefined {
  const candidates = rawText.match(/(\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  return candidates.find((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    const isYearRange = /\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b|\b(19|20)\d{2}\s*[-–—]\s*(present|current|actualidad|presente)\b/i.test(candidate);
    return digits.length >= 10 && !isYearRange;
  });
}

function parseExperience(experienceText: string): CandidateProfile["experience"] {
  const lines = splitLines(experienceText);
  const entries: CandidateProfile["experience"] = [];
  let current: CandidateProfile["experience"][number] | undefined;

  for (const line of lines) {
    const clean = line.replace(/^[-•]\s*/, "").trim();
    const looksLikeDate = /\b(19|20)\d{2}\b|present|current|actualidad|presente/i.test(clean);
    const looksLikeBullet = /^[-•]/.test(line) || clean.length > 80 || /\b(led|built|managed|created|developed|implemented|improved|supported|designed|owned|delivered)\b/i.test(clean);
    const looksLikeHeading = !looksLikeBullet && clean.length <= 90 && (/\s[-–—|]\s/.test(clean) || looksLikeDate || /^[A-Z][A-Za-z0-9 .,&/()'-]+$/.test(clean));

    if (looksLikeHeading) {
      if (current) entries.push(current);
      const parts = (clean.includes("|") ? clean.split("|") : clean.split(/\s[-–—]\s/)).map((part) => part.trim()).filter(Boolean);
      current = {
        title: parts[0] ?? "Role",
        company: parts[1] ?? "Company",
        dates: parts.find((part) => /\b(19|20)\d{2}\b|present|current|actualidad|presente/i.test(part)),
        bullets: []
      };
      continue;
    }

    if (!current) {
      current = { company: "Experience", title: "Role", bullets: [] };
    }
    current.bullets.push(clean);
  }

  if (current) entries.push(current);
  return entries.length ? entries : [{ company: "Experience", title: "Role", bullets: lines.filter((line) => line.length > 12) }];
}

function heuristicExtract(rawText: string): CandidateProfile {
  const lines = splitLines(rawText);
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = findPhone(rawText);
  const links = unique(rawText.match(/https?:\/\/\S+|linkedin\.com\/\S+|github\.com\/\S+/gi) ?? []);
  const summary = findSection(rawText, ["summary", "profile", "professional summary"]) || lines.slice(1, 5).join(" ");
  const skillsText = findSection(rawText, ["skills", "technical skills", "core skills"]);
  const skills = unique([
    ...skillsText.split(/[,|•\n]/),
    ...skillHints.filter((skill) => rawText.toLowerCase().includes(skill))
  ]).slice(0, 30);
  const education = findSection(rawText, ["education"]).split("\n").filter(Boolean);
  const certifications = findSection(rawText, ["certifications", "certificates"]).split("\n").filter(Boolean);
  const projects = findSection(rawText, [
    "projects",
    "technical projects",
    "ai projects",
    "ai and technical projects",
    "selected projects",
    "professional projects",
    "portfolio projects"
  ]).split("\n").map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  const experienceText = findSection(rawText, ["experience", "work experience", "professional experience"]);
  const experience = parseExperience(experienceText);
  const sections = extractResumeSections(rawText);
  const baseProfile = {
    name: lines[0],
    contact: { email, phone, links },
    summary,
    experience,
    skills,
    education,
    certifications,
    projects,
    sections,
    rawText
  };

  return {
    ...baseProfile,
    parseAudit: auditProfile(baseProfile)
  };
}

function mergeWithFallback(parsed: CandidateProfile, fallback: CandidateProfile): CandidateProfile {
  const projectSectionCount = countSectionItems(fallback.sections, "projects");
  const projectsAreSuspicious =
    fallback.projects.length > 0 &&
    parsed.projects.length > Math.max(fallback.projects.length + 2, projectSectionCount + 2);

  const experienceIsSuspicious =
    fallback.experience.length > 1 &&
    parsed.experience.length < fallback.experience.length;

  const merged = {
    ...parsed,
    contact: {
      ...fallback.contact,
      ...parsed.contact,
      links: unique([...(parsed.contact.links ?? []), ...(fallback.contact.links ?? [])])
    },
    summary: parsed.summary || fallback.summary,
    experience: experienceIsSuspicious ? fallback.experience : parsed.experience.length >= fallback.experience.length ? parsed.experience : fallback.experience,
    skills: parsed.skills.length ? unique(parsed.skills) : fallback.skills,
    education: parsed.education.length ? parsed.education : fallback.education,
    certifications: parsed.certifications.length ? parsed.certifications : fallback.certifications,
    projects: projectsAreSuspicious ? fallback.projects : parsed.projects.length ? parsed.projects.map((line) => line.replace(/^[-•]\s*/, "").trim()).filter(Boolean) : fallback.projects,
    sections: fallback.sections.length ? fallback.sections : parsed.sections,
    rawText: parsed.rawText || fallback.rawText
  };
  return {
    ...merged,
    parseAudit: auditProfile(merged)
  };
}

function countSectionItems(sections: CandidateProfile["sections"], kind: string): number {
  return sections
    .filter((section) => section.kind === kind)
    .reduce((total, section) => total + section.lines.filter((line) => line.trim().length > 0).length, 0);
}

function auditProfile(profile: Omit<CandidateProfile, "id" | "parseAudit">): CandidateProfile["parseAudit"] {
  const sectionCounts = profile.sections.reduce<Record<string, number>>((counts, section) => {
    counts[section.kind] = (counts[section.kind] ?? 0) + section.lines.filter((line) => line.trim().length > 0).length;
    return counts;
  }, {});
  const extractedCounts = {
    roles: profile.experience.length,
    skills: profile.skills.length,
    projects: profile.projects.length,
    education: profile.education.length,
    certifications: profile.certifications.length
  };
  const warnings: string[] = [];
  const projectSectionCount = sectionCounts.projects ?? 0;
  const experienceSectionCount = sectionCounts.experience ?? 0;

  if (projectSectionCount > 0 && extractedCounts.projects > projectSectionCount + 2) {
    warnings.push(`Project count looks high: extracted ${extractedCounts.projects}, project section has about ${projectSectionCount} lines.`);
  }
  if (projectSectionCount > 0 && extractedCounts.projects === 0) {
    warnings.push("Project section was detected, but no projects were extracted.");
  }
  if (experienceSectionCount > 4 && extractedCounts.roles <= 1) {
    warnings.push("Experience section is substantial, but only one role was detected.");
  }
  if (!profile.name) warnings.push("Candidate name was not detected.");
  if (!profile.contact.email) warnings.push("Email was not detected.");

  return {
    status: warnings.length >= 2 ? "Needs attention" : warnings.length === 1 ? "Review" : "Pass",
    warnings,
    sectionCounts,
    extractedCounts
  };
}

export async function extractCandidateProfile(rawText: string): Promise<CandidateProfile> {
  const fallback = heuristicExtract(rawText);
  const parsed = await llmClient.generateJson(
    [
      { role: "system", content: "Extract a truthful candidate profile as JSON. Do not infer facts not present in the resume. Preserve every role, company, date range, project, and section you can identify. Do not collapse multiple jobs into one." },
      { role: "user", content: `Return JSON matching this shape: name, contact, summary, experience, skills, education, certifications, projects, sections, rawText. For sections, return the original CV section headings in order with their lines.\nResume:\n${rawText}` }
    ],
    candidateProfileSchema,
    fallback
  );
  return mergeWithFallback(parsed, fallback);
}
