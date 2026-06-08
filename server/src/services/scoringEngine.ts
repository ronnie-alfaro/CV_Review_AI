import type { Analysis, CandidateProfile, JobDescription, RequirementEvidence, Score } from "../../../shared/schemas.js";
import { analysisSchema } from "../../../shared/schemas.js";
import { llmClient } from "./llmClient.js";
import { unique } from "./text.js";
import { buildStructuredPrompt } from "./promptBuilder.js";

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
    if (matchesRequirement(`${item.title} ${item.company}`)) evidence.push(`Role history includes ${item.title} at ${item.company}.`);
    const matched = item.bullets.find((bullet) => matchesRequirement(bullet));
    if (matched) evidence.push(`${item.title} at ${item.company}: ${matched}`);
  }
  const project = candidate.projects.find((item) => matchesRequirement(item));
  if (project) evidence.push(`Project: ${project}`);
  return unique(evidence).slice(0, 3);
}

function uniqueFixes(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.replace(/^.+?:\s*/, "").toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
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

  let suggestions = unique([
    ...missingSkills.slice(0, 6).map((skill) => `If accurate, add where you used ${skill} and what outcome it supported.`),
    "Keep all claims grounded in resume evidence and remove anything that cannot be defended in an interview.",
    "Move the most job-relevant achievements into the top third of the resume."
  ]);

  const seenRequirements = new Set<string>();
  const requirements = unique([
    ...job.requiredSkills.map((item) => `Skill::Critical::${item}`),
    ...job.technicalRequirements.map((item) => `Technical::Important::${item}`),
    ...job.leadershipRequirements.map((item) => `Leadership::Important::${item}`),
    ...job.responsibilities.map((item) => `Responsibility::Important::${item}`),
    ...job.preferredSkills.map((item) => `Skill::Nice to have::${item}`),
    ...job.softSkills.map((item) => `Soft Skill::Nice to have::${item}`)
  ]).filter((entry) => {
    const requirement = entry.split("::")[2]?.toLowerCase().trim();
    if (!requirement || seenRequirements.has(requirement)) return false;
    seenRequirements.add(requirement);
    return true;
  }).map((entry) => {
    const [category, importance, requirement] = entry.split("::") as [RequirementEvidence["category"], RequirementEvidence["importance"], string];
    return makeRequirement(candidate, requirement, category, importance);
  }).slice(0, 18);

  const criticalGaps = requirements.filter((item) => item.importance === "Critical" && ["Missing", "Transferable"].includes(item.status));
  const weakImportant = requirements.filter((item) => item.importance !== "Nice to have" && item.status === "Weak");
  const actionableRequirements = requirements.filter((item) => ["Missing", "Transferable", "Weak"].includes(item.status));
  suggestions = unique([
    ...actionableRequirements.slice(0, 6).map((item) => item.recommendedAction),
    "Keep all claims grounded in resume evidence and remove anything that cannot be defended in an interview.",
    "Move the most job-relevant achievements into the top third of the resume."
  ]);
  const topFixes = uniqueFixes(unique([
    ...criticalGaps.slice(0, 3).map((item) => `${item.requirement}: ${item.recommendedAction}`),
    ...weakImportant.slice(0, 3).map((item) => `${item.requirement}: ${item.recommendedAction}`),
    ...suggestions.slice(0, 2)
  ])).slice(0, 5);

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
  const alternativeRoles = suggestAlternativeRoles(candidate, matchedSkills);

  return { scores, requirements, suggestions, topFixes, recruiterLens, hiringManagerConcerns, interviewDefense, doNotFabricate, alternativeRoles, optimized: [] };
}

export async function analyzeAlignment(candidate: CandidateProfile, job: JobDescription): Promise<Analysis> {
  const fallback = heuristicAnalysis(candidate, job);
  const prompt = buildStructuredPrompt({
    persona: "You are a talent intelligence review board: an ATS matching architect, senior technical recruiter, hiring manager, career strategist, and truthfulness auditor.",
    task: "Compare the candidate ATS profile against the job requisition and produce a structured, evidence-first hiring alignment analysis.",
    context: `Candidate ATS profile:\n${JSON.stringify(candidate)}\n\nJob requisition:\n${JSON.stringify(job)}`,
    instructions: [
      "Build a requirement evidence matrix for important job requirements.",
      "Classify each requirement as Critical, Important, or Nice to have.",
      "Classify candidate evidence as Strong, Weak, Transferable, or Missing.",
      "Identify top fixes, recruiter lens, hiring manager concerns, interview defense topics, do-not-fabricate items, and alternative roles the candidate could search for.",
      "Use concrete CV evidence whenever possible."
    ],
    constraints: [
      "Do not write or rewrite a CV.",
      "Do not fabricate experience, certifications, skills, metrics, dates, employers, or credentials.",
      "If evidence is related but not exact, mark it Transferable.",
      "Return only valid JSON matching analysisSchema."
    ],
    outputFormat: "JSON matching analysisSchema: scores, requirements, suggestions, topFixes, recruiterLens, hiringManagerConcerns, interviewDefense, doNotFabricate, alternativeRoles, optimized.",
    recap: "Evidence-first analysis only. The product is the audit, not CV generation."
  });
  const parsed = await llmClient.generateJson(
    [
      { role: "system", content: "Follow the structured prompt exactly. Output JSON only." },
      { role: "user", content: prompt }
    ],
    analysisSchema,
    fallback
  );
  return {
    ...parsed,
    requirements: parsed.requirements.length ? parsed.requirements : fallback.requirements,
    topFixes: parsed.topFixes.length ? parsed.topFixes : fallback.topFixes,
    recruiterLens: parsed.recruiterLens.length ? parsed.recruiterLens : fallback.recruiterLens,
    hiringManagerConcerns: parsed.hiringManagerConcerns.length ? parsed.hiringManagerConcerns : fallback.hiringManagerConcerns,
    interviewDefense: parsed.interviewDefense.length ? parsed.interviewDefense : fallback.interviewDefense,
    alternativeRoles: parsed.alternativeRoles.length ? parsed.alternativeRoles : fallback.alternativeRoles,
    optimized: []
  };
}

function suggestAlternativeRoles(candidate: CandidateProfile, matchedSkills: string[]): Analysis["alternativeRoles"] {
  const experienceEvidence = candidate.experience.map((item) => `${item.title} at ${item.company}`);
  const experienceText = candidate.experience
    .map((item) => `${item.title} ${item.company} ${item.bullets.join(" ")}`)
    .join(" ");
  const text = `${candidate.skills.join(" ")} ${candidate.projects.join(" ")} ${experienceText}`.toLowerCase();
  const roles: Analysis["alternativeRoles"] = [];
  const add = (title: string, why: string, keywords: string[], evidence: string[]) => {
    roles.push({ title, why, searchKeywords: keywords, evidence: evidence.slice(0, 4) });
  };
  if (/manager|team leader|leadership|mentor|stakeholder|ownership|team|global operations/.test(text)) {
    add(
      "Engineering Manager",
      "The CV shows formal management, team leadership, operational ownership, or stakeholder-facing leadership evidence.",
      ["Engineering Manager", "Software Engineering Manager", "Technical Engineering Manager"],
      experienceEvidence
    );
  }
  if (/support engineering|customer support|incident management|servicenow|operations|platform reliability|global operations/.test(text)) {
    add(
      "Support Engineering Manager",
      "The CV combines support engineering leadership, incident management, platform operations, and customer-facing technical escalation signals.",
      ["Support Engineering Manager", "Technical Support Manager", "Escalation Engineering Manager"],
      experienceEvidence
    );
  }
  if (/ai|llm|rag|semantic|automation|platform/.test(text) && /manager|team leader|leadership|global operations/.test(text)) {
    add(
      "AI Platform Engineering Manager",
      "The CV combines leadership history with applied AI, RAG, semantic search, platform, or automation evidence.",
      ["AI Platform Engineering Manager", "AI Engineering Manager", "Applied AI Engineering Manager"],
      [...experienceEvidence, ...candidate.projects]
    );
  }
  if (/llm|rag|embedding|semantic|ai|machine learning|python/.test(text)) {
    add("AI Application Engineer", "The CV shows applied AI, RAG, semantic search, or Python project evidence.", ["AI Application Engineer", "RAG Engineer", "LLM Engineer"], candidate.projects);
  }
  if (/api|platform|aws|docker|kubernetes|cloud|systems/.test(text)) {
    add("Platform Engineer", "The CV contains platform, API, cloud, or systems evidence.", ["Platform Engineer", "Backend Platform Engineer", "Cloud Platform Engineer"], [...matchedSkills, ...candidate.skills]);
  }
  if (/data|analytics|sql|dashboard|metadata|recommendation/.test(text)) {
    add("Data / Analytics Engineer", "The CV shows SQL, analytics, metadata, recommendation, or dashboard signals.", ["Analytics Engineer", "Data Engineer", "BI Engineer"], candidate.projects);
  }
  if (/react|typescript|javascript|web|ui|frontend/.test(text)) {
    add("Full Stack Engineer", "The CV has web/frontend plus backend or project delivery signals.", ["Full Stack Engineer", "Frontend Engineer", "Product Engineer"], candidate.skills);
  }
  return roles.slice(0, 5);
}
