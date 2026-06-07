import type { Analysis, CandidateProfile, JobDescription } from "../../shared/schemas.js";
import { prisma } from "./db.js";

export async function saveCandidate(profile: CandidateProfile): Promise<CandidateProfile> {
  const row = await prisma.candidateProfile.create({
    data: {
      name: profile.name,
      contactJson: JSON.stringify(profile.contact),
      summary: profile.summary,
      experienceJson: JSON.stringify(profile.experience),
      skillsJson: JSON.stringify(profile.skills),
      educationJson: JSON.stringify(profile.education),
      certsJson: JSON.stringify(profile.certifications),
      projectsJson: JSON.stringify(profile.projects),
      sectionsJson: JSON.stringify(profile.sections),
      rawText: profile.rawText
    }
  });
  return { ...profile, id: row.id };
}

export async function saveJob(job: JobDescription): Promise<JobDescription> {
  const row = await prisma.jobDescription.create({
    data: {
      title: job.title,
      company: job.company,
      requiredSkillsJson: JSON.stringify(job.requiredSkills),
      preferredJson: JSON.stringify(job.preferredSkills),
      responsibilitiesJson: JSON.stringify(job.responsibilities),
      leadershipJson: JSON.stringify(job.leadershipRequirements),
      technicalJson: JSON.stringify(job.technicalRequirements),
      softSkillsJson: JSON.stringify(job.softSkills),
      seniority: job.seniority,
      rawText: job.rawText
    }
  });
  return { ...job, id: row.id };
}

export async function saveAnalysis(candidateProfileId: string, jobDescriptionId: string, analysis: Analysis): Promise<Analysis> {
  const row = await prisma.analysis.create({
    data: {
      candidateProfileId,
      jobDescriptionId,
      scoresJson: JSON.stringify(analysis.scores),
      suggestionsJson: JSON.stringify({
        suggestions: analysis.suggestions,
        requirements: analysis.requirements,
        topFixes: analysis.topFixes,
        recruiterLens: analysis.recruiterLens,
        hiringManagerConcerns: analysis.hiringManagerConcerns,
        interviewDefense: analysis.interviewDefense,
        doNotFabricate: analysis.doNotFabricate
      }),
      optimizedJson: JSON.stringify(analysis.optimized)
    }
  });
  return { ...analysis, id: row.id };
}
