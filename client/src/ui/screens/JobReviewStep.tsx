import { BarChart3, FileText, Pencil, Radar, Sparkles } from "lucide-react";
import { runAnalysis } from "../../lib/api";
import { useAlignmentStore } from "../../store/useAlignmentStore";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import type { JobDescription } from "../../../../shared/schemas";

export function JobReviewStep() {
  const store = useAlignmentStore();

  async function analyze() {
    if (!store.candidate || !store.job) return;
    store.setLoading(true);
    store.setError(undefined);
    try {
      store.setAnalysis(await runAnalysis(store.candidate, store.job));
      store.setStep("analysis");
    } catch (error) {
      store.setError(error instanceof Error ? error.message : "Could not analyze alignment.");
    } finally {
      store.setLoading(false);
    }
  }

  if (!store.job) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-8">
        <Panel>
          <h2 className="text-xl font-semibold">No job description parsed yet</h2>
          <Button className="mt-5" onClick={() => store.setStep("job")}>Add Job Description</Button>
        </Panel>
      </section>
    );
  }

  const skillEmphasis = getSkillEmphasis(store.job);
  const roleSignals = getRoleSignals(store.job);

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <FileText className="h-4 w-4" />
            Job description parsed
          </div>
          <h2 className="text-3xl font-semibold">Review extracted requirements</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Check what the system found before generating the resume alignment analysis.
          </p>
        </div>
        <Button variant="secondary" onClick={() => store.setStep("job")}>
          <Pencil className="h-4 w-4" />
          Edit Description
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-teal-700" />
            <h3 className="text-lg font-semibold">What this role is really asking for</h3>
          </div>
          <div className="mt-5 grid gap-4">
            {roleSignals.map((signal) => (
              <div key={signal.title} className="rounded-md border border-border bg-muted/30 p-4">
                <div className="text-sm font-semibold">{signal.title}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-700" />
            <h3 className="text-lg font-semibold">Skill emphasis</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Larger items appear in more important requirement groups.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {skillEmphasis.map((skill) => (
              <span
                key={skill.name}
                className={`rounded-md border px-3 py-2 font-medium ${skill.weight >= 3 ? "border-teal-700 bg-teal-50 text-teal-900 text-sm" : skill.weight === 2 ? "border-slate-300 bg-white text-slate-700 text-sm" : "border-border bg-muted text-muted-foreground text-xs"}`}
              >
                {skill.name}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RequirementPanel title="Required Skills" items={store.job.requiredSkills} />
        <RequirementPanel title="Preferred Skills" items={store.job.preferredSkills} />
        <RequirementPanel title="Responsibilities" items={store.job.responsibilities} />
        <RequirementPanel title="Leadership Requirements" items={store.job.leadershipRequirements} />
        <RequirementPanel title="Technical Requirements" items={store.job.technicalRequirements} />
        <RequirementPanel title="Soft Skills" items={store.job.softSkills} />
      </div>

      <Panel className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{store.job.title ?? "Target role"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Seniority: {store.job.seniority ?? "Not specified"}</p>
        </div>
        <Button className="md:min-w-52" disabled={store.loading} onClick={analyze}>
          <BarChart3 className="h-4 w-4" />
          {store.loading ? "Generating..." : "Generate Analysis"}
        </Button>
      </Panel>
    </section>
  );
}

function getSkillEmphasis(job: JobDescription) {
  const weights = new Map<string, number>();
  const add = (items: string[], weight: number) => {
    items.forEach((item) => {
      const key = item.trim();
      if (!key) return;
      weights.set(key, (weights.get(key) ?? 0) + weight);
    });
  };
  add(job.requiredSkills, 3);
  add(job.technicalRequirements, 2);
  add(job.leadershipRequirements, 2);
  add(job.preferredSkills, 1);
  add(job.softSkills, 1);
  return Array.from(weights.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, 18);
}

function getRoleSignals(job: JobDescription) {
  const seniority = job.seniority && job.seniority !== "Not specified" ? job.seniority : "seniority not clearly specified";
  const technical = job.technicalRequirements.slice(0, 3).join(", ") || job.requiredSkills.slice(0, 3).join(", ") || "technical execution";
  const leadership = job.leadershipRequirements.slice(0, 2).join(", ") || "ownership and collaboration";
  const responsibilities = job.responsibilities.slice(0, 2).join(" and ") || "delivering the core responsibilities of the role";
  return [
    {
      title: "Role level",
      description: `The description points to ${seniority}. The CV should make scope, ownership, and level of autonomy easy to see.`
    },
    {
      title: "Core work",
      description: `The role appears centered on ${responsibilities}. These themes should show up near the top of the resume.`
    },
    {
      title: "Technical emphasis",
      description: `The strongest technical signals are ${technical}. The resume should show where these were used, not only list them.`
    },
    {
      title: "Leadership signal",
      description: `They are looking for evidence around ${leadership}. Add truthful examples of influence, mentoring, stakeholders, or ownership.`
    }
  ];
}

function RequirementPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel className="shadow-none">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-2">
        {(items.length ? items : ["No explicit evidence found."]).map((item) => (
          <div key={item} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}
