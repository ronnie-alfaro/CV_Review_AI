import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import type { OptimizedResume } from "../../../../shared/schemas";
import { useAlignmentStore } from "../../store/useAlignmentStore";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";

export function OptimizedResumeStep() {
  const { analysis, candidate, job, setStep } = useAlignmentStore();
  const [selectedMode, setSelectedMode] = useState<OptimizedResume["mode"]>("Balanced");

  if (!analysis || !candidate) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-8">
        <Panel>
          <h2 className="text-xl font-semibold">No optimized CV available</h2>
          <Button className="mt-5" onClick={() => setStep("analysis")}>Back to Analysis</Button>
        </Panel>
      </section>
    );
  }

  const selected = analysis.optimized.find((item) => item.mode === selectedMode) ?? analysis.optimized[0];
  const contact = [candidate.contact.email, candidate.contact.phone, candidate.contact.location, ...candidate.contact.links].filter(Boolean);
  const roleLabel = job?.title ? `Optimized for ${job.title}` : "Optimized for target role";
  const skills = selected.skillsToEmphasize.length ? selected.skillsToEmphasize : candidate.skills;
  const extraSections = candidate.sections.filter((section) =>
    !["header", "summary", "experience", "skills", "education", "certifications", "projects"].includes(section.kind) && section.lines.length > 0
  );

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 print:p-0">
      <div className="no-print flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
            Truthful optimized CV
          </div>
          <h2 className="text-3xl font-semibold">Final CV Preview</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Select the rewrite level, review the content, then download it as a PDF from your browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setStep("analysis")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Analysis
          </Button>
          <Button onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <Panel className="no-print">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-lg font-semibold">Optimization mode</h3>
            <p className="mt-1 text-sm text-muted-foreground">Each mode keeps the original CV structure and changes only the level of emphasis.</p>
          </div>
          <div className="grid grid-cols-3 rounded-md border border-border bg-muted p-1">
            {analysis.optimized.map((item) => (
              <button
                key={item.mode}
                className={`rounded px-3 py-2 text-sm font-medium ${selectedMode === item.mode ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setSelectedMode(item.mode)}
              >
                {item.mode}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <article className="resume-print mx-auto w-full max-w-5xl bg-white px-10 py-12 text-slate-900 shadow-panel print:max-w-none print:shadow-none">
        <header className="border-b border-slate-300 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-800">{roleLabel}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">{candidate.name || selected.headline}</h1>
          {contact.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
              {contact.map((item) => <span key={item}>{item}</span>)}
            </div>
          )}
        </header>

        <ResumeSection title="Professional Summary">
          <p className="text-sm leading-7 text-slate-700">{selected.summary}</p>
        </ResumeSection>

        <ResumeSection title="Core Skills">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700">{skill}</span>
            ))}
          </div>
        </ResumeSection>

        <ResumeSection title="Professional Experience">
          <div className="grid gap-5">
            {candidate.experience.map((item, index) => (
              <div key={`${item.company}-${item.title}-${index}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  {item.dates && <span className="text-sm text-slate-500">{item.dates}</span>}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-600">{item.company}</p>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                  {getDisplayBullets(item.bullets, selected.experienceBullets, candidate.experience.length, index).map((bullet) => (
                    <li key={bullet} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ResumeSection>

        {candidate.projects.length > 0 && (
          <ResumeSection title="Projects">
            <ul className="grid gap-2 text-sm leading-6 text-slate-700">
              {candidate.projects.map((project) => (
                <li key={project} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">{project.replace(/^[-•]\s*/, "").trim()}</li>
              ))}
            </ul>
          </ResumeSection>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {candidate.education.length > 0 && (
            <ResumeSection title="Education">
              <ul className="grid gap-2 text-sm leading-6 text-slate-700">
                {candidate.education.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </ResumeSection>
          )}
          {candidate.certifications.length > 0 && (
            <ResumeSection title="Certifications">
              <ul className="grid gap-2 text-sm leading-6 text-slate-700">
                {candidate.certifications.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </ResumeSection>
          )}
        </div>

        {extraSections.map((section) => (
          <ResumeSection key={`${section.heading}-${section.kind}`} title={section.heading}>
            <ul className="grid gap-2 text-sm leading-6 text-slate-700">
              {section.lines.map((line) => (
                <li key={line} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">{line.replace(/^[-•]\s*/, "").trim()}</li>
              ))}
            </ul>
          </ResumeSection>
        ))}

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          Optimization mode: {selected.mode}. This version preserves the original CV evidence and should be reviewed before submission.
        </footer>
      </article>
    </section>
  );
}

function getDisplayBullets(originalBullets: string[], optimizedBullets: string[], experienceCount: number, experienceIndex: number): string[] {
  const cleanedOriginal = originalBullets.map((bullet) => bullet.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  if (experienceCount === 1 && experienceIndex === 0 && optimizedBullets.length > 0) {
    const optimizedSet = new Set(optimizedBullets.map(normalizeBullet));
    const reordered = optimizedBullets.filter((bullet) => cleanedOriginal.some((original) => normalizeBullet(original) === normalizeBullet(bullet)));
    const remaining = cleanedOriginal.filter((bullet) => !optimizedSet.has(normalizeBullet(bullet)));
    return [...reordered, ...remaining];
  }
  return cleanedOriginal;
}

function normalizeBullet(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ResumeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      {children}
    </section>
  );
}
