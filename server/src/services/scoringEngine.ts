import type { Analysis, CandidateProfile, JobDescription, RequirementEvidence, Score } from "../../../shared/schemas.js";
import { analysisSchema } from "../../../shared/schemas.js";
import { llmClient } from "./llmClient.js";
import { unique } from "./text.js";

function includesAny(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function score(
  label: Score["label"],
  value: number,
  why: string,
  strengths: string[],
  weaknesses: string[],
  missingEvidence: string[],
  opportunities: string[]
): Score {
  return { label, value: clamp(value), why, strengths, weaknesses, missingEvidence, opportunities };
}

function cleanBullet(bullet: string): string {
  return bullet.replace(/^[-•]\s*/, "").trim();
}

function relevanceRank(bullet: string, terms: string[]): number {
  const lower = bullet.toLowerCase();
  return terms.reduce((total, term) => total + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function reorderByRelevance(bullets: string[], terms: string[]): string[] {
  return [...bullets]
    .map((bullet, index) => ({ bullet, index, rank: relevanceRank(bullet, terms) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((item) => cleanBullet(item.bullet));
}

function evidenceForRequirement(candidate: CandidateProfile, requirement: string): string[] {
  const needle = requirement.toLowerCase();
  const tokens = needle.split(/\W+/).filter((token) => token.length > 3);
  const matchesRequirement = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes(needle) || (tokens.length > 0 && tokens.every((token) => lower.includes(token)));
  };
  const evidence: string[] = [];
  if (candidate.summary && matchesRequirement(candidate.summary)) evidence.push(`Summary supports ${requirement}.`);
  for (const skill of candidate.skills) {
    if (skill.toLowerCase().includes(needle) || needle.includes(skill.toLowerCase())) evidence.push(`Skills include ${skill}.`);
  }
  for (const item of candidate.experience) {
    const matched = item.bullets.find((bullet) => matchesRequirement(bullet));
    if (matched) evidence.push(`${item.title} at ${item.company}: ${matched}`);
  }
  const project = candidate.projects.find((item) => matchesRequirement(item));
  if (project) evidence.push(`Project: ${project}`);
  return unique(evidence).slice(0, 3);
}

function transferableEvidence(candidate: CandidateProfile, requirement: string, category: RequirementEvidence["category"]): string[] {
  const text = `${candidate.skills.join(" ")} ${candidate.experience.flatMap((item) => item.bullets).join(" ")} ${candidate.projects.join(" ")}`.toLowerCase();
  const related: Record<string, string[]> = {
    kubernetes: ["docker", "container", "deployment", "cloud"],
    aws: ["cloud", "infrastructure", "server", "lambda"],
    leadership: ["mentor", "stakeholder", "owner", "team", "lead"],
    communication: ["stakeholder", "customer", "documentation", "presentation"],
    api: ["integration", "backend", "service", "platform"]
  };
  const key = Object.keys(related).find((item) => requirement.toLowerCase().includes(item));
  const matches = key ? related[key].filter((term) => text.includes(term)) : [];
  if (matches.length) return [`Related evidence found: ${matches.join(", ")}.`];
  if (category === "Leadership" && /mentor|stakeholder|lead|team|owner/.test(text)) return ["Related leadership language appears in the CV."];
  if (category === "Technical" && /api|cloud|database|system|docker|sql|python|typescript|react|node/.test(text)) return ["Related technical background appears in the CV."];
  return [];
}

function makeRequirement(
  candidate: CandidateProfile,
  requirement: string,
  category: RequirementEvidence["category"],
  importance: RequirementEvidence["importance"]
): RequirementEvidence {
  const direct = evidenceForRequirement(candidate, requirement);
  const transferable = direct.length ? [] : transferableEvidence(candidate, requirement, category);
  const status: RequirementEvidence["status"] = direct.length >= 2 ? "Strong" : direct.length === 1 ? "Weak" : transferable.length ? "Transferable" : "Missing";
  const bestCvLocation = category === "Skill" || category === "Technical" ? "Skills or Experience" : category === "Leadership" ? "Experience" : "Summary or Experience";
  return {
    requirement,
    category,
    importance,
    status,
    cvEvidence: direct.length ? direct : transferable,
    gap: status === "Strong" ? "No major gap detected." : status === "Weak" ? "Evidence exists, but it needs more context or stronger placement." : status === "Transferable" ? "Related evidence exists, but the exact requirement is not explicit." : "No clear evidence found in the CV.",
    recommendedAction: status === "Missing"
      ? `Add ${requirement} only if it is truthful and defensible.`
      : status === "Transferable"
        ? `Clarify how the related experience connects to ${requirement}, without claiming direct experience if it is not true.`
        : status === "Weak"
          ? `Add scope, context, or outcome around ${requirement}.`
          : "Keep this evidence visible.",
    bestCvLocation
  };
}

export function heuristicAnalysis(candidate: CandidateProfile, job: JobDescription): Analysis {
  const candidateEvidence = [
    candidate.rawText,
    candidate.summary,
    candidate.skills.join(" "),
    candidate.education.join(" "),
    candidate.certifications.join(" "),
    candidate.projects.join(" "),
    candidate.experience.map((item) => `${item.company} ${item.title} ${item.bullets.join(" ")}`).join(" ")
  ].filter(Boolean).join("\n");
  const resumeText = candidateEvidence.toLowerCase();
  const jobSkills = unique([...job.requiredSkills, ...job.preferredSkills]);
  const matchedSkills = jobSkills.filter((skill) => resumeText.includes(skill.toLowerCase()));
  const missingSkills = jobSkills.filter((skill) => !resumeText.includes(skill.toLowerCase()));
  const leadershipTerms = ["lead", "mentor", "stakeholder", "ownership", "team", "manager", "strategy"];
  const technicalTerms = unique([...job.technicalRequirements.join(" ").split(/\W+/), ...job.requiredSkills]).filter((term) => term.length > 3);
  const impactTerms = ["improved", "reduced", "increased", "launched", "delivered", "%", "$", "saved", "grew"];

  const atsValue = 55 + (candidate.summary ? 8 : 0) + (candidate.skills.length ? 12 : 0) + (candidate.experience.length ? 15 : 0) + (candidate.education.length ? 5 : 0);
  const roleValue = 45 + includesAny(candidateEvidence, job.responsibilities) * 4 + matchedSkills.length * 5;
  const skillValue = jobSkills.length ? (matchedSkills.length / jobSkills.length) * 100 : 65;
  const leadershipValue = 35 + includesAny(candidateEvidence, leadershipTerms) * 10 + includesAny(candidateEvidence, job.leadershipRequirements) * 5;
  const technicalValue = 35 + includesAny(candidateEvidence, technicalTerms.slice(0, 25)) * 4;
  const communicationValue = 45 + includesAny(candidateEvidence, impactTerms) * 8 + (candidate.summary && candidate.summary.length > 80 ? 10 : 0);

  const scores = [
    score(
      "ATS Readability",
      atsValue,
      "This measures whether the resume has recognizable sections and parseable content.",
      ["Recognizable profile information was extracted.", candidate.skills.length ? "Skills are grouped clearly." : ""].filter(Boolean),
      candidate.experience[0]?.bullets.length ? [] : ["Work history needs clearer bullet structure."],
      candidate.contact.email ? [] : ["Email address was not detected."],
      ["Use standard headings such as Summary, Experience, Skills, Education, and Certifications."]
    ),
    score(
      "Role Alignment",
      roleValue,
      "This compares the candidate's described experience with the job's responsibilities and context.",
      matchedSkills.slice(0, 5).map((skill) => `Evidence found for ${skill}.`),
      missingSkills.slice(0, 5).map((skill) => `The resume does not clearly show ${skill}.`),
      job.responsibilities.slice(0, 3).filter((item) => !resumeText.includes(item.toLowerCase())),
      ["Reorder bullets so the most relevant responsibilities appear first."]
    ),
    score(
      "Skills Coverage",
      skillValue,
      "This reflects how many required and preferred skills appear with supporting resume evidence.",
      matchedSkills.map((skill) => `Matched ${skill}.`).slice(0, 8),
      missingSkills.map((skill) => `Missing explicit evidence for ${skill}.`).slice(0, 8),
      missingSkills.slice(0, 6),
      ["Add truthful context around tools, platforms, and methods already used."]
    ),
    score(
      "Leadership Signals",
      leadershipValue,
      "This looks for mentoring, ownership, stakeholder management, and team leadership language.",
      leadershipTerms.filter((term) => resumeText.includes(term)).map((term) => `Resume mentions ${term}.`),
      ["Leadership outcomes could be stated more directly."],
      job.leadershipRequirements.slice(0, 4),
      ["Clarify ownership scope, stakeholders supported, and teams influenced."]
    ),
    score(
      "Technical Signals",
      technicalValue,
      "This measures evidence of tools, systems, technical depth, and implementation responsibility.",
      matchedSkills.slice(0, 6).map((skill) => `Technical evidence includes ${skill}.`),
      missingSkills.slice(0, 4).map((skill) => `${skill} is not explicit.`),
      job.technicalRequirements.slice(0, 4),
      ["Name systems, integrations, data flows, and operational responsibilities where truthful."]
    ),
    score(
      "Communication Signals",
      communicationValue,
      "This looks for clear impact statements, achievements, and readable executive-level phrasing.",
      includesAny(candidateEvidence, impactTerms) ? ["Some impact-oriented language is present."] : [],
      ["More bullets should connect actions to outcomes."],
      ["Quantified business or operational outcomes."],
      ["Convert task-only bullets into action, context, and result statements."]
    )
  ];

  const suggestions = unique([
    ...missingSkills.slice(0, 6).map((skill) => `If accurate, add where you used ${skill} and what outcome it supported.`),
    "Keep all claims grounded in resume evidence and remove anything that cannot be defended in an interview.",
    "Move the most job-relevant achievements into the top third of the resume."
  ]);

  const requirements = unique([
    ...job.requiredSkills.map((item) => `Skill::Critical::${item}`),
    ...job.technicalRequirements.map((item) => `Technical::Important::${item}`),
    ...job.leadershipRequirements.map((item) => `Leadership::Important::${item}`),
    ...job.responsibilities.map((item) => `Responsibility::Important::${item}`),
    ...job.preferredSkills.map((item) => `Skill::Nice to have::${item}`),
    ...job.softSkills.map((item) => `Soft Skill::Nice to have::${item}`)
  ]).map((entry) => {
    const [category, importance, requirement] = entry.split("::") as [RequirementEvidence["category"], RequirementEvidence["importance"], string];
    return makeRequirement(candidate, requirement, category, importance);
  }).slice(0, 18);

  const criticalGaps = requirements.filter((item) => item.importance === "Critical" && ["Missing", "Transferable"].includes(item.status));
  const weakImportant = requirements.filter((item) => item.importance !== "Nice to have" && item.status === "Weak");
  const topFixes = unique([
    ...criticalGaps.slice(0, 3).map((item) => `${item.requirement}: ${item.recommendedAction}`),
    ...weakImportant.slice(0, 3).map((item) => `${item.requirement}: ${item.recommendedAction}`),
    ...suggestions.slice(0, 2)
  ]).slice(0, 5);

  const recruiterLens = unique([
    matchedSkills.length ? `Recruiter will likely see visible overlap in ${matchedSkills.slice(0, 5).join(", ")}.` : "Recruiter may not see enough immediate keyword overlap.",
    missingSkills.length ? `Recruiter may notice missing or unclear evidence for ${missingSkills.slice(0, 4).join(", ")}.` : "Most named skills appear in the CV.",
    leadershipValue >= 65 ? "Leadership signals are visible." : "Leadership scope may look unclear without stronger examples."
  ]);

  const hiringManagerConcerns = unique([
    technicalValue < 65 ? "Whether the candidate has enough hands-on technical depth for the role." : "Technical depth appears plausible, but scale and ownership may still be probed.",
    leadershipValue < 65 ? "Whether ownership, mentoring, or stakeholder scope is strong enough." : "Leadership evidence exists; expect questions about scope and outcomes.",
    criticalGaps.length ? `Critical gaps: ${criticalGaps.map((item) => item.requirement).slice(0, 4).join(", ")}.` : "No critical requirement gap is dominant."
  ]);

  const interviewDefense = unique([
    ...requirements.filter((item) => item.status !== "Missing").slice(0, 4).map((item) => `Be ready to explain your evidence for ${item.requirement}.`),
    ...criticalGaps.slice(0, 3).map((item) => `Be honest if asked about ${item.requirement}; do not overstate it.`)
  ]).slice(0, 6);

  const doNotFabricate = unique([
    ...missingSkills.slice(0, 5),
    ...requirements.filter((item) => item.status === "Missing").map((item) => item.requirement).slice(0, 5),
    "Certifications, metrics, tools, or responsibilities that are not supported by the CV."
  ]).slice(0, 8);

  const baseBullets = candidate.experience.flatMap((item) => item.bullets).map(cleanBullet).filter(Boolean).slice(0, 12);
  const relevantTerms = unique([...matchedSkills, ...job.responsibilities, ...job.technicalRequirements, ...job.leadershipRequirements]);
  const emphasizedSkills = unique([...matchedSkills, ...candidate.skills]).slice(0, 14);
  const originalSummary = candidate.summary || "Experienced professional with relevant background for the target role.";
  const roleContext = matchedSkills.length ? ` Role-relevant strengths already present: ${matchedSkills.slice(0, 5).join(", ")}.` : "";
  const optimized = [
    {
      mode: "Conservative" as const,
      headline: candidate.name ? `${candidate.name} - CV optimization` : "CV optimization",
      summary: originalSummary,
      experienceBullets: baseBullets,
      skillsToEmphasize: emphasizedSkills,
      truthfulnessNotes: ["Preserves the original CV content and applies formatting, ordering, and light cleanup only."]
    },
    {
      mode: "Balanced" as const,
      headline: job.title ? `${candidate.name ?? "Candidate"} - aligned for ${job.title}` : "Aligned CV optimization",
      summary: `${originalSummary}${roleContext}`,
      experienceBullets: reorderByRelevance(baseBullets, relevantTerms),
      skillsToEmphasize: emphasizedSkills,
      truthfulnessNotes: ["Keeps the candidate's original evidence and reorders emphasis toward the target role."]
    },
    {
      mode: "Strategic" as const,
      headline: job.title ? `${candidate.name ?? "Candidate"} - targeted CV for ${job.title}` : "Targeted CV optimization",
      summary: `${originalSummary}${roleContext}`,
      experienceBullets: reorderByRelevance(baseBullets, relevantTerms),
      skillsToEmphasize: emphasizedSkills,
      truthfulnessNotes: ["Strategic mode strengthens positioning while preserving the same underlying roles, projects, skills, and evidence."]
    }
  ];

  return { scores, requirements, suggestions, topFixes, recruiterLens, hiringManagerConcerns, interviewDefense, doNotFabricate, optimized };
}

export async function analyzeAlignment(candidate: CandidateProfile, job: JobDescription): Promise<Analysis> {
  const fallback = heuristicAnalysis(candidate, job);
  return llmClient.generateJson(
    [
      { role: "system", content: "You are a truthful career alignment analyst. Do not write marketing copy. Do not fabricate achievements, skills, jobs, certifications, or metrics. The core output is structured analysis: requirement evidence matrix, recruiter lens, hiring manager concerns, interview defense, and do-not-fabricate warnings. Every score must explain why it was assigned." },
      { role: "user", content: `Analyze this resume against this job and return JSON matching the schema: scores, requirements, suggestions, topFixes, recruiterLens, hiringManagerConcerns, interviewDefense, doNotFabricate, optimized. For each requirement, map requirement, category, importance, status, cvEvidence, gap, recommendedAction, bestCvLocation. Prefer concrete CV evidence over generic commentary.\nCandidate:\n${JSON.stringify(candidate)}\nJob:\n${JSON.stringify(job)}` }
    ],
    analysisSchema,
    fallback
  );
}
