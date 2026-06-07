import { useState } from "react";
import { CircleAlert, CircleCheck, Filter, MapPin, RotateCcw } from "lucide-react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { LlmStatusBadge } from "../components/LlmStatusBadge";
import { useAlignmentStore } from "../../store/useAlignmentStore";
import type { RequirementEvidence, Score } from "../../../../shared/schemas";

export function AnalysisDashboard() {
  const { analysis, setStep } = useAlignmentStore();
  if (!analysis) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-8">
        <Panel>No analysis available.</Panel>
      </section>
    );
  }
  const verdict = getVerdict(analysis.scores);

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Analysis Dashboard</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Scores are separated so you can see where the resume is strong, where evidence is missing, and what can be improved without inventing experience.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LlmStatusBadge />
          <Button variant="secondary" onClick={() => setStep("resume")}>
            <RotateCcw className="h-4 w-4" />
            Start Over
          </Button>
        </div>
      </div>

      <Panel className="border-2" style={{ borderColor: verdict.color }}>
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div>
            <div className="text-sm font-semibold uppercase text-muted-foreground">Verdict</div>
            <div className="mt-3 rounded-md px-4 py-3 text-lg font-semibold text-white" style={{ backgroundColor: verdict.color }}>
              {verdict.title}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">Average score: {verdict.average}/100</div>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{verdict.headline}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{verdict.explanation}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {verdict.reasons.map((reason) => (
                <div key={reason} className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <InsightPanel title="Top fixes before applying" items={analysis.topFixes.length ? analysis.topFixes : analysis.suggestions} tone="action" />

      {analysis.requirements.length > 0 && <RequirementEvidenceMatrix requirements={analysis.requirements} />}

      <div className="grid gap-4">
        {analysis.scores.map((score) => (
          <ScoreRow key={score.label} score={score} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <InsightPanel title="Recruiter lens" items={analysis.recruiterLens} tone="neutral" />
        <InsightPanel title="Hiring manager concerns" items={analysis.hiringManagerConcerns} tone="warn" />
        <InsightPanel title="Interview defense" items={analysis.interviewDefense} tone="neutral" />
      </div>

      {analysis.doNotFabricate.length > 0 && (
        <Panel className="border-red-200 bg-red-50/60 shadow-none">
          <h3 className="text-xl font-semibold text-red-950">Do not fabricate</h3>
          <p className="mt-2 text-sm leading-6 text-red-900">These items should only be added if they are true and defensible in an interview.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.doNotFabricate.map((item) => (
              <span key={item} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-900">{item}</span>
            ))}
          </div>
        </Panel>
      )}
    </section>
  );
}

function ScoreRow({ score }: { score: Score }) {
  const color = getScoreColor(score.value);
  return (
    <Panel className="shadow-none">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-start">
        <div className="grid gap-3">
          <h3 className="text-lg font-semibold">{score.label}</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-md text-xl font-semibold text-white" style={{ backgroundColor: color }}>
              {score.value}
            </div>
            <div className="h-3 flex-1 rounded-full bg-muted">
              <div className="h-3 rounded-full" style={{ width: `${score.value}%`, backgroundColor: color }} />
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm leading-6 text-muted-foreground">{score.why}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <List title="Strengths" items={score.strengths} icon="good" />
            <List title="Weaknesses" items={score.weaknesses} icon="warn" />
            <List title="Missing evidence" items={score.missingEvidence} icon="missing" />
            <List title="Opportunities" items={score.opportunities} icon="pin" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function List({ title, items, icon }: { title: string; items: string[]; icon?: "good" | "warn" | "missing" | "pin" }) {
  const Icon = icon === "good" ? CircleCheck : icon === "pin" ? MapPin : CircleAlert;
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-2 grid gap-2 text-sm leading-5 text-muted-foreground">
        {(items.length ? items : ["No major issue detected."]).slice(0, 6).map((item) => (
          <li key={item} className="flex gap-2">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon === "good" ? "text-teal-700" : icon === "pin" ? "text-blue-700" : "text-amber-700"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementEvidenceMatrix({ requirements }: { requirements: RequirementEvidence[] }) {
  const [filter, setFilter] = useState<"All" | "Critical" | "Missing" | "Transferable">("All");
  const visibleRequirements = requirements.filter((item) => {
    if (filter === "Critical") return item.importance === "Critical";
    if (filter === "Missing") return item.status === "Missing";
    if (filter === "Transferable") return item.status === "Transferable";
    return true;
  });

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-700" />
            <h3 className="text-xl font-semibold">Requirement evidence matrix</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This is the core comparison: what the role asks for, how important it is, what the CV proves, and what to do next.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", "Critical", "Missing", "Transferable"] as const).map((item) => (
            <button
              key={item}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${filter === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-muted-foreground"}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[1.1fr_120px_120px_1.4fr_1.2fr] gap-0 bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid">
          <div>Requirement</div>
          <div>Importance</div>
          <div>Status</div>
          <div>CV evidence</div>
          <div>Action</div>
        </div>
        <div className="divide-y divide-border">
          {visibleRequirements.map((item) => (
            <div key={`${item.category}-${item.requirement}`} className="grid gap-3 bg-white px-4 py-4 text-sm lg:grid-cols-[1.1fr_120px_120px_1.4fr_1.2fr]">
              <div>
                <div className="font-semibold">{item.requirement}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.category} · Best in {item.bestCvLocation}</div>
              </div>
              <div><Badge label={item.importance} tone={item.importance === "Critical" ? "red" : item.importance === "Important" ? "amber" : "slate"} /></div>
              <div><Badge label={item.status} tone={item.status === "Strong" ? "green" : item.status === "Missing" ? "red" : item.status === "Transferable" ? "blue" : "amber"} /></div>
              <div className="grid gap-2 text-muted-foreground">
                {(item.cvEvidence.length ? item.cvEvidence : [item.gap]).slice(0, 3).map((evidence) => <div key={evidence}>{evidence}</div>)}
              </div>
              <div className="text-muted-foreground">{item.recommendedAction}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function InsightPanel({ title, items, tone }: { title: string; items: string[]; tone: "action" | "neutral" | "warn" }) {
  const border = tone === "warn" ? "border-amber-200" : tone === "action" ? "border-teal-200" : "border-border";
  return (
    <Panel className={`shadow-none ${border}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-3">
        {(items.length ? items : ["No major issue detected."]).slice(0, 6).map((item) => (
          <div key={item} className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "red" | "amber" | "blue" | "slate" }) {
  const classes = {
    green: "border-teal-200 bg-teal-50 text-teal-900",
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    slate: "border-slate-200 bg-slate-50 text-slate-700"
  };
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>;
}

function getScoreColor(value: number): string {
  const hue = Math.round((Math.max(0, Math.min(100, value)) / 100) * 135);
  return `hsl(${hue}, 72%, 32%)`;
}

function getVerdict(scores: Score[]) {
  const average = Math.round(scores.reduce((total, score) => total + score.value, 0) / Math.max(scores.length, 1));
  const byLabel = new Map(scores.map((score) => [score.label, score]));
  const role = byLabel.get("Role Alignment")?.value ?? average;
  const skills = byLabel.get("Skills Coverage")?.value ?? average;
  const technical = byLabel.get("Technical Signals")?.value ?? average;
  const ats = byLabel.get("ATS Readability")?.value ?? average;
  const weakScores = scores.filter((score) => score.value < 60).map((score) => score.label);

  if (average >= 78 && role >= 75 && skills >= 70 && ats >= 70) {
    return {
      title: "Apply as is",
      headline: "This CV is already a credible match for the role.",
      average,
      color: "#166534",
      explanation: "The resume has enough alignment and evidence to apply without a major rewrite. Small wording edits may help, but the current profile is defensible.",
      reasons: [
        `Role alignment is ${role}/100.`,
        `Skills coverage is ${skills}/100.`,
        "No major optimization is required before applying.",
        weakScores.length ? `Watch weaker areas: ${weakScores.join(", ")}.` : "No score is below 60."
      ]
    };
  }

  if (average >= 58 && role >= 55 && (skills >= 50 || technical >= 50)) {
    return {
      title: "Optimize before applying",
      headline: "This role is possible, but the CV should be improved first.",
      average,
      color: "#b45309",
      explanation: "There is enough overlap to keep pursuing the role, but the resume needs clearer evidence before submission. Focus on missing skills, role-specific examples, and stronger impact statements.",
      reasons: [
        `Role alignment is ${role}/100.`,
        `Skills coverage is ${skills}/100.`,
        `Technical signals are ${technical}/100.`,
        weakScores.length ? `Improve these areas first: ${weakScores.join(", ")}.` : "Scores are moderate but not yet strong."
      ]
    };
  }

  return {
    title: "Consider other roles",
    headline: "This may not be the best target role right now.",
    average,
    color: "#991b1b",
    explanation: "The gap appears meaningful enough that applying may produce a weak outcome unless the resume is missing major truthful evidence. It may be better to target roles closer to the current profile or build the missing experience first.",
    reasons: [
      `Average score is ${average}/100.`,
      `Role alignment is ${role}/100.`,
      `Skills coverage is ${skills}/100.`,
      weakScores.length ? `Low areas: ${weakScores.join(", ")}.` : "The overall score is still below the recommended threshold."
    ]
  };
}
