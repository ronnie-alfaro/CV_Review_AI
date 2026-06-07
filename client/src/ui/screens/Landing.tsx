import { ArrowRight, CircleCheck, FileSearch, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { useAlignmentStore } from "../../store/useAlignmentStore";

export function Landing() {
  const setStep = useAlignmentStore((state) => state.setStep);
  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f7f5ef_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl content-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            Local-first analysis. No fabricated experience.
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal text-foreground md:text-6xl">
            Compare your CV against a role before you apply.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            See what matches, what is missing, and whether you should apply, improve your CV, or target a better-fit role.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="h-12 px-5 text-base" onClick={() => setStep("resume")}>
              Upload CV
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-4 rounded-lg border border-border bg-white p-5 shadow-panel">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-teal-700" />
            <div className="text-sm font-semibold">Analysis preview</div>
          </div>
          <div className="rounded-md border-2 border-amber-500 p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Verdict</div>
            <div className="mt-2 text-xl font-semibold">Optimize before applying</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Strong platform overlap, but Kubernetes and ownership evidence need clarification.</p>
          </div>
          {["AWS: strong evidence found", "Kubernetes: transferable evidence only", "Leadership scope: needs more detail"].map((label) => (
            <div key={label} className="flex items-start gap-3 rounded-md bg-muted/40 px-3 py-3">
              <CircleCheck className="mt-0.5 h-4 w-4 text-teal-700" />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
