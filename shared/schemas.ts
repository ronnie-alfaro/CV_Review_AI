import { z } from "zod";

export const contactInfoSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(z.string()).default([])
});

export const experienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  dates: z.string().optional(),
  bullets: z.array(z.string()).default([])
});

export const resumeSectionSchema = z.object({
  heading: z.string(),
  kind: z.string(),
  lines: z.array(z.string()).default([])
});

export const parseAuditSchema = z.object({
  status: z.enum(["Pass", "Review", "Needs attention"]).default("Review"),
  warnings: z.array(z.string()).default([]),
  sectionCounts: z.record(z.number()).default({}),
  extractedCounts: z.object({
    roles: z.number().default(0),
    skills: z.number().default(0),
    projects: z.number().default(0),
    education: z.number().default(0),
    certifications: z.number().default(0)
  }).default({ roles: 0, skills: 0, projects: 0, education: 0, certifications: 0 })
});

export const candidateSignalSchema = z.object({
  label: z.string(),
  value: z.string(),
  evidence: z.array(z.string()).default([])
});

export const candidateSwotSchema = z.object({
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  threats: z.array(z.string()).default([])
});

export const candidateCardSchema = z.object({
  headline: z.string().default("Candidate profile"),
  archetype: z.string().default("Professional profile"),
  marketPositioning: z.string().default("The resume does not yet communicate a clear market positioning."),
  sellingNarrative: z.string().default("The resume needs a clearer professional narrative."),
  readerTakeaway: z.string().default("A reader may need more evidence to understand the candidate's strongest value."),
  trajectory: z.string().default("Career trajectory could not be determined confidently."),
  strongestSignals: z.array(candidateSignalSchema).default([]),
  technicalIdentity: z.array(z.string()).default([]),
  leadershipIdentity: z.array(z.string()).default([]),
  evidenceHighlights: z.array(z.string()).default([]),
  swot: candidateSwotSchema.default({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: []
  }),
  riskFlags: z.array(z.string()).default([])
});

export const candidateProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  contact: contactInfoSchema.default({ links: [] }),
  summary: z.string().optional(),
  experience: z.array(experienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(z.string()).default([]),
  sections: z.array(resumeSectionSchema).default([]),
  parseAudit: parseAuditSchema.default({
    status: "Review",
    warnings: [],
    sectionCounts: {},
    extractedCounts: { roles: 0, skills: 0, projects: 0, education: 0, certifications: 0 }
  }),
  candidateCard: candidateCardSchema.default({
    headline: "Candidate profile",
    archetype: "Professional profile",
    marketPositioning: "The resume does not yet communicate a clear market positioning.",
    sellingNarrative: "The resume needs a clearer professional narrative.",
    readerTakeaway: "A reader may need more evidence to understand the candidate's strongest value.",
    trajectory: "Career trajectory could not be determined confidently.",
    strongestSignals: [],
    technicalIdentity: [],
    leadershipIdentity: [],
    evidenceHighlights: [],
    swot: {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    },
    riskFlags: []
  }),
  rawText: z.string()
});

export const jobDescriptionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  seniority: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  leadershipRequirements: z.array(z.string()).default([]),
  technicalRequirements: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  rawText: z.string()
});

export const scoreKeySchema = z.enum([
  "ATS Readability",
  "Role Alignment",
  "Skills Coverage",
  "Leadership Signals",
  "Technical Signals",
  "Communication Signals"
]);

export const scoreSchema = z.object({
  label: scoreKeySchema,
  value: z.number().min(0).max(100),
  why: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([])
});

export const requirementEvidenceSchema = z.object({
  requirement: z.string(),
  category: z.enum(["Skill", "Technical", "Leadership", "Responsibility", "Soft Skill", "Seniority", "Other"]),
  importance: z.enum(["Critical", "Important", "Nice to have"]),
  status: z.enum(["Strong", "Weak", "Transferable", "Missing"]),
  cvEvidence: z.array(z.string()).default([]),
  gap: z.string(),
  recommendedAction: z.string(),
  bestCvLocation: z.string()
});

export const optimizationModeSchema = z.enum(["Conservative", "Balanced", "Strategic"]);

export const optimizedResumeSchema = z.object({
  mode: optimizationModeSchema,
  headline: z.string(),
  summary: z.string(),
  experienceBullets: z.array(z.string()).default([]),
  skillsToEmphasize: z.array(z.string()).default([]),
  truthfulnessNotes: z.array(z.string()).default([])
});

export const analysisSchema = z.object({
  id: z.string().optional(),
  scores: z.array(scoreSchema),
  requirements: z.array(requirementEvidenceSchema).default([]),
  suggestions: z.array(z.string()).default([]),
  topFixes: z.array(z.string()).default([]),
  recruiterLens: z.array(z.string()).default([]),
  hiringManagerConcerns: z.array(z.string()).default([]),
  interviewDefense: z.array(z.string()).default([]),
  doNotFabricate: z.array(z.string()).default([]),
  alternativeRoles: z.array(z.object({
    title: z.string(),
    why: z.string(),
    evidence: z.array(z.string()).default([]),
    searchKeywords: z.array(z.string()).default([])
  })).default([]),
  optimized: z.array(optimizedResumeSchema)
});

export type CandidateProfile = z.output<typeof candidateProfileSchema>;
export type JobDescription = z.output<typeof jobDescriptionSchema>;
export type Score = z.output<typeof scoreSchema>;
export type Analysis = z.output<typeof analysisSchema>;
export type OptimizedResume = z.output<typeof optimizedResumeSchema>;
export type RequirementEvidence = z.output<typeof requirementEvidenceSchema>;
