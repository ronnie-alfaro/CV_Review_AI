import { candidateProfileSchema, type CandidateProfile } from "../../../shared/schemas.js";
import { findSection, splitLines, unique } from "./text.js";
import { llmClient } from "./llmClient.js";
import { buildStructuredPrompt } from "./promptBuilder.js";

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

function normalizeSectionHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSectionHeading(line: string): boolean {
  const clean = line.trim().replace(/:$/, "");
  if (/^[-•●]/.test(clean)) return false;
  if (/^https?:\/\//i.test(clean) || /gitlab\.com|github\.com/i.test(clean)) return false;
  if (clean.length < 3 || clean.length > 70) return false;
  const normalized = normalizeSectionHeading(clean);
  const sectionHeadings = [
    "summary", "profile", "professional summary", "objective",
    "experience", "professional experience", "employment", "employment history", "work history",
    "skills", "technical skills", "core skills", "tools and technologies",
    "education", "academic background",
    "certifications", "certificates", "credentials", "licenses",
    "projects", "technical projects", "ai projects", "ai and technical projects", "selected projects", "portfolio projects",
    "achievements", "accomplishments", "awards", "honors",
    "languages", "publications", "speaking", "volunteer", "community", "patents", "research"
  ];
  if (sectionHeadings.includes(normalized)) return true;
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
  let pendingBullet = "";
  let bulletBreakPending = false;

  const flushBullet = () => {
    if (current && pendingBullet.trim()) {
      current.bullets.push(pendingBullet.replace(/\s+/g, " ").trim());
    }
    pendingBullet = "";
  };

  const flushRole = () => {
    flushBullet();
    if (current && (current.title !== "Role" || current.bullets.length > 0)) entries.push(current);
    current = undefined;
  };

  for (const line of lines) {
    const clean = line.replace(/^[-•▪●]\s*/, "").trim();
    if (/^[-•▪●]$/.test(line.trim())) {
      flushBullet();
      bulletBreakPending = true;
      continue;
    }
    if (!clean || /\|\s*page\s+\d+$/i.test(clean)) continue;
    const looksLikeDate = /\b(19|20)\d{2}\b|present|current|actualidad|presente/i.test(clean);
    const looksLikeBullet = /^[-•▪●]/.test(line) || clean.length > 110 || /\b(led|built|managed|created|developed|implemented|improved|supported|designed|owned|delivered|scaled|defined|drove|operated|resolved|architected|maintained|integrated|champion)\b/i.test(clean);
    const looksLikeHeading = !looksLikeBullet && clean.length <= 90 && (/\s[-–—|]\s/.test(clean) || looksLikeDate || /^[A-Z][A-Za-z0-9 .,&/()'-]+$/.test(clean));

    if (looksLikeHeading) {
      flushRole();
      const parts = (clean.includes("|") ? clean.split("|") : clean.split(/\s[-–—]\s/)).map((part) => part.trim()).filter(Boolean);
      const rawCompany = parts.slice(1).join(" | ") || "Company";
      const companyDate = splitCompanyAndDates(rawCompany);
      current = {
        title: parts[0] ?? "Role",
        company: companyDate.company,
        dates: companyDate.dates,
        bullets: []
      };
      continue;
    }

    if (!current) {
      current = { company: "Experience", title: "Role", bullets: [] };
    }
    if (/^[-•▪●]/.test(line) || !pendingBullet || bulletBreakPending) {
      flushBullet();
      pendingBullet = clean;
      bulletBreakPending = false;
    } else {
      pendingBullet = `${pendingBullet} ${clean}`;
    }
  }

  flushRole();
  return entries.length ? entries : [{ company: "Experience", title: "Role", bullets: lines.filter((line) => line.length > 12) }];
}

function splitCompanyAndDates(value: string): { company: string; dates?: string } {
  const clean = value.trim();
  const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[–-]\s*(?:Present|Current|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?|(19|20)\d{2}\s*[–-]\s*(?:Present|Current|(19|20)\d{2})/i;
  const match = clean.match(datePattern);
  if (!match || match.index === undefined) return { company: clean || "Company" };
  return {
    company: clean.slice(0, match.index).trim() || "Company",
    dates: clean.slice(match.index).trim()
  };
}

function looksLikeProjectHeading(line: string, nextLine?: string): boolean {
  const clean = line.replace(/^[-•●]\s*/, "").trim();
  if (!clean || /^https?:\/\//i.test(clean)) return false;
  if (/^[-•●]/.test(line)) return false;
  if (/\b(19|20)\d{2}\b/.test(clean)) return true;
  if (/\|\s*(personal|professional|open source|academic|capstone|side)\s+project/i.test(clean)) return true;
  if (/\|\s*$/.test(clean) && nextLine && /\bproject\b/i.test(nextLine)) return true;
  return false;
}

function parseProjects(projectsText: string): string[] {
  const lines = splitLines(projectsText);
  const projects: string[] = [];
  let currentTitle = "";
  let currentDetails: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    const details = currentDetails.join(" ").replace(/\s+/g, " ").trim();
    projects.push(details ? `${currentTitle} - ${details}` : currentTitle);
    currentTitle = "";
    currentDetails = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const clean = line.replace(/^[-•●]\s*/, "").trim();
    const nextLine = lines[index + 1];
    if (/^https?:\/\//i.test(clean) || /gitlab\.com|github\.com|portfolio/i.test(clean) || /\|\s*page\s+\d+$/i.test(clean)) {
      continue;
    }

    if (looksLikeProjectHeading(line, nextLine)) {
      flush();
      if (/\|\s*$/.test(clean) && nextLine && /\bproject\b/i.test(nextLine)) {
        currentTitle = `${clean} ${nextLine}`.replace(/\s+/g, " ").trim();
        index += 1;
      } else {
        currentTitle = clean;
      }
      continue;
    }

    if (currentTitle) {
      currentDetails.push(clean);
      continue;
    }

    if (clean.length > 0) {
      currentTitle = clean;
    }
  }

  flush();
  return unique(projects);
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
  const projectsText = findSection(rawText, [
    "projects",
    "technical projects",
    "ai projects",
    "ai and technical projects",
    "selected projects",
    "professional projects",
    "portfolio projects"
  ]);
  const projects = parseProjects(projectsText);
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
    candidateCard: {
      headline: buildHeadline(lines[0], experience, skills),
      archetype: inferArchetype(skills, projects, experience),
      marketPositioning: inferMarketPositioning(skills, projects, experience),
      sellingNarrative: inferSellingNarrative(skills, projects, experience),
      readerTakeaway: inferReaderTakeaway(skills, projects, experience),
      trajectory: inferTrajectory(experience, projects),
      strongestSignals: buildStrongestSignals(skills, experience, projects),
      technicalIdentity: inferTechnicalIdentity(skills, projects),
      leadershipIdentity: inferLeadershipIdentity(experience),
      evidenceHighlights: buildEvidenceHighlights(experience, projects),
      swot: buildCandidateSwot(skills, experience, projects),
      riskFlags: []
    },
    rawText
  };

  return {
    ...baseProfile,
    parseAudit: auditProfile(baseProfile)
  };
}

function mergeWithFallback(parsed: CandidateProfile, fallback: CandidateProfile): CandidateProfile {
  const projectSectionCount = countProjectSectionItems(fallback.sections);
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
    candidateCard: parsed.candidateCard?.headline && parsed.candidateCard.headline !== "Candidate profile" ? parsed.candidateCard : fallback.candidateCard,
    rawText: parsed.rawText || fallback.rawText
  };
  return {
    ...merged,
    candidateCard: {
      ...fallback.candidateCard,
      ...merged.candidateCard,
      riskFlags: auditProfile(merged).warnings
    },
    parseAudit: auditProfile(merged)
  };
}

function countSectionItems(sections: CandidateProfile["sections"], kind: string): number {
  return sections
    .filter((section) => section.kind === kind)
    .reduce((total, section) => total + section.lines.filter((line) => line.trim().length > 0).length, 0);
}

function countProjectSectionItems(sections: CandidateProfile["sections"]): number {
  return sections
    .filter((section) => section.kind === "projects")
    .reduce((total, section) => total + parseProjects(section.lines.join("\n")).length, 0);
}

function auditProfile(profile: Omit<CandidateProfile, "id" | "parseAudit">): CandidateProfile["parseAudit"] {
  const sectionCounts = profile.sections.reduce<Record<string, number>>((counts, section) => {
    const count = section.kind === "projects" ? parseProjects(section.lines.join("\n")).length : section.lines.filter((line) => line.trim().length > 0).length;
    counts[section.kind] = (counts[section.kind] ?? 0) + count;
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
  const prompt = buildStructuredPrompt({
    persona: "You are an ATS resume parsing panel: an ATS data extraction engineer, a recruiter operations analyst, and a talent intelligence analyst.",
    task: "Extract a candidate profile as structured ATS-style data and a candidate card that summarizes the person without inventing facts.",
    context: `Resume text:\n${rawText}`,
    instructions: [
      "Convert the resume into searchable ATS fields: contact, summary, work experience entries, skills, education, certifications, projects, sections, and candidateCard.",
      "Preserve every role, company, date range, project title, and original section heading that is present.",
      "For projects, count project entries by project title, not by wrapped description lines.",
      "Use candidateCard to describe the person the CV is selling: market positioning, selling narrative, reader takeaway, trajectory, strongest evidence, technical identity, leadership identity, SWOT/FODA, and risk flags."
    ],
    constraints: [
      "Never infer jobs, certifications, skills, dates, degrees, metrics, or achievements not present in the resume.",
      "Do not collapse multiple jobs into one.",
      "Do not treat URLs, page numbers, or wrapped paragraph lines as project titles.",
      "Return only valid JSON matching the requested schema."
    ],
    outputFormat: "JSON matching candidateProfileSchema: name, contact, summary, experience, skills, education, certifications, projects, sections, parseAudit, candidateCard, rawText.",
    recap: "Structured ATS extraction only. Preserve evidence. Count projects by title. No fabrication."
  });
  const parsed = await llmClient.generateJson(
    [
      { role: "system", content: "Follow the structured prompt exactly. Output JSON only." },
      { role: "user", content: prompt }
    ],
    candidateProfileSchema,
    fallback
  );
  return mergeWithFallback(parsed, fallback);
}

function buildHeadline(name: string | undefined, experience: CandidateProfile["experience"], skills: string[]): string {
  const latest = experience[0]?.title && experience[0].title !== "Role" ? experience[0].title : undefined;
  const skill = skills[0];
  return [name, latest, skill].filter(Boolean).join(" · ") || "Candidate profile";
}

function inferArchetype(skills: string[], projects: string[], experience: CandidateProfile["experience"]): string {
  const text = profileText(skills, projects, experience);
  if (/manager|team leader|leadership|global operations|support engineering/.test(text) && /llm|rag|semantic|ai|automation|platform/.test(text)) return "Technical leader with applied AI and platform depth";
  if (/manager|team leader|leadership|global operations|support engineering/.test(text)) return "Technical operations and engineering leadership profile";
  if (/llm|rag|embedding|semantic|ai|machine learning/.test(text)) return "AI / applied intelligence builder";
  if (/platform|api|cloud|kubernetes|docker|aws|systems/.test(text)) return "Platform and systems technologist";
  return "Cross-functional professional profile";
}

function profileText(skills: string[], projects: string[], experience: CandidateProfile["experience"]): string {
  return `${skills.join(" ")} ${projects.join(" ")} ${experience.map((item) => `${item.title} ${item.company} ${item.bullets.join(" ")}`).join(" ")}`.toLowerCase();
}

function inferMarketPositioning(skills: string[], projects: string[], experience: CandidateProfile["experience"]): string {
  const text = profileText(skills, projects, experience);
  if (/manager|team leader|leadership|global operations|support engineering/.test(text) && /llm|rag|semantic|ai|automation/.test(text)) {
    return "The CV sells a technical leader who can connect support engineering, operations, platform reliability, and applied AI initiatives.";
  }
  if (/manager|team leader|global operations|support engineering/.test(text)) {
    return "The CV sells an engineering and operations leader with credibility across support, systems, incident management, and team execution.";
  }
  if (/llm|rag|semantic|ai|machine learning/.test(text)) {
    return "The CV sells an applied AI builder with project evidence in semantic search, RAG, and knowledge-intensive systems.";
  }
  if (/platform|api|cloud|kubernetes|docker|aws|systems/.test(text)) {
    return "The CV sells a platform and systems profile with cloud, infrastructure, and technical delivery signals.";
  }
  return "The CV sells a broad professional profile, but the market positioning could be sharper.";
}

function inferSellingNarrative(skills: string[], projects: string[], experience: CandidateProfile["experience"]): string {
  const latest = experience[0];
  const rolePath = experience.filter((item) => item.title && item.company).slice(0, 3).map((item) => `${item.title} at ${item.company}`);
  const technicalSignals = inferTechnicalIdentity(skills, projects).slice(0, 5);
  const leadershipSignals = inferLeadershipIdentity(experience).slice(0, 2);
  const parts = [
    latest ? `Current signal: ${latest.title} at ${latest.company}.` : undefined,
    rolePath.length > 1 ? `Career proof: ${rolePath.join(" -> ")}.` : undefined,
    technicalSignals.length ? `Technical proof: ${technicalSignals.join(", ")}.` : undefined,
    leadershipSignals.length ? `Leadership proof: ${leadershipSignals.join(" ")}` : undefined
  ].filter(Boolean);
  return parts.join(" ") || "The CV needs clearer evidence to build a strong selling narrative.";
}

function inferReaderTakeaway(skills: string[], projects: string[], experience: CandidateProfile["experience"]): string {
  const text = profileText(skills, projects, experience);
  if (/manager|team leader|support engineering|global operations/.test(text) && /ai|llm|rag|semantic/.test(text)) {
    return "A recruiter should see a leadership candidate who also has enough technical curiosity and applied AI evidence to operate near modern platform teams.";
  }
  if (/manager|team leader|support engineering|global operations/.test(text)) {
    return "A recruiter should see a leader for technical support, operations, reliability, or engineering execution roles.";
  }
  if (/ai|llm|rag|semantic/.test(text)) {
    return "A recruiter should see a technical builder with applied AI project evidence, but may need stronger role-based proof.";
  }
  return "A recruiter may see useful experience, but the CV should make the core professional identity more obvious.";
}

function inferTrajectory(experience: CandidateProfile["experience"], projects: string[]): string {
  const roles = experience.filter((item) => item.title && item.title !== "Role").map((item) => item.title);
  if (roles.length > 1) return `Trajectory across ${roles.slice(0, 3).join(" -> ")}.`;
  if (projects.length) return `Project-driven profile with ${projects.length} notable project${projects.length === 1 ? "" : "s"}.`;
  return "Trajectory needs review because limited role evidence was detected.";
}

function buildStrongestSignals(skills: string[], experience: CandidateProfile["experience"], projects: string[]) {
  return [
    skills.length ? { label: "Skills base", value: `${skills.length} extracted skills`, evidence: skills.slice(0, 8) } : undefined,
    experience.length ? { label: "Experience base", value: `${experience.length} role${experience.length === 1 ? "" : "s"} detected`, evidence: experience.map((item) => `${item.title} at ${item.company}`).slice(0, 4) } : undefined,
    projects.length ? { label: "Project base", value: `${projects.length} project${projects.length === 1 ? "" : "s"} detected`, evidence: projects.slice(0, 4) } : undefined
  ].filter((item): item is { label: string; value: string; evidence: string[] } => Boolean(item));
}

function inferTechnicalIdentity(skills: string[], projects: string[]): string[] {
  return unique([...skills, ...projects.flatMap((project) => project.match(/\b[A-Z][A-Za-z0-9.+#-]{1,}\b/g) ?? [])]).slice(0, 12);
}

function inferLeadershipIdentity(experience: CandidateProfile["experience"]): string[] {
  const bullets = experience.flatMap((item) => item.bullets);
  return bullets.filter((bullet) => /lead|mentor|stakeholder|own|manage|strategy|team/i.test(bullet)).slice(0, 6);
}

function buildEvidenceHighlights(experience: CandidateProfile["experience"], projects: string[]): string[] {
  return unique([
    ...experience.flatMap((item) => item.bullets).filter((bullet) => bullet.length > 40).slice(0, 5),
    ...projects.slice(0, 4)
  ]).slice(0, 8);
}

function buildCandidateSwot(skills: string[], experience: CandidateProfile["experience"], projects: string[]): CandidateProfile["candidateCard"]["swot"] {
  const text = profileText(skills, projects, experience);
  const strengths = unique([
    experience.some((item) => /manager|team leader|lead/i.test(item.title)) ? "Visible leadership path through management and team lead roles." : undefined,
    /incident management|operations|support engineering|platform reliability/i.test(text) ? "Operational credibility across support, incident management, and reliability contexts." : undefined,
    /aws|docker|kubernetes|sql|api|linux|python/i.test(text) ? "Technical foundation is visible through infrastructure, systems, data, and software signals." : undefined,
    projects.length ? `Project portfolio adds ${projects.length} current proof point${projects.length === 1 ? "" : "s"} beyond formal employment.` : undefined,
    /llm|rag|semantic|ai|embedding/i.test(text) ? "Applied AI narrative is present through RAG, semantic search, LLM, or automation evidence." : undefined
  ].filter((item): item is string => Boolean(item))).slice(0, 5);

  const weaknesses = unique([
    skills.length < 8 ? "Skills section may be too thin for quick ATS and recruiter scanning." : undefined,
    !/[$%]|\b(reduced|increased|improved|saved|grew|launched|delivered)\b/i.test(text) ? "Impact is not consistently quantified, so scope may be underestimated." : undefined,
    projects.length && !experience.some((item) => /ai|ml|data|platform/i.test(item.title)) ? "AI strength may read as project-led unless connected more clearly to professional outcomes." : undefined,
    !/stakeholder|executive|cross-functional|customer|client/i.test(text) ? "Stakeholder and cross-functional influence may need more explicit language." : undefined
  ].filter((item): item is string => Boolean(item))).slice(0, 5);

  const opportunities = unique([
    /manager|team leader|support engineering|global operations/i.test(text) ? "Target leadership roles where technical operations, support engineering, reliability, and AI adoption intersect." : undefined,
    /llm|rag|semantic|ai/i.test(text) ? "Position recent AI projects as evidence of practical modernization and technical learning velocity." : undefined,
    /incident management|operations/i.test(text) ? "Use incident management and operations experience to support reliability, platform, and escalation leadership roles." : undefined,
    "Make the top third of the CV state the market identity more directly."
  ].filter((item): item is string => Boolean(item))).slice(0, 5);

  const threats = unique([
    /llm|rag|semantic|ai/i.test(text) ? "AI roles may question whether the AI experience is production-grade or primarily project-based." : undefined,
    /manager|team leader/i.test(text) ? "Individual contributor roles may undervalue the leadership trajectory or see the profile as overqualified." : undefined,
    !/certification|certified|degree|education/i.test(text) ? "Some screeners may look for formal education or certifications if the job requires them." : undefined,
    "If the CV does not connect achievements to outcomes, recruiters may miss the seniority level."
  ].filter((item): item is string => Boolean(item))).slice(0, 5);

  return { strengths, weaknesses, opportunities, threats };
}
