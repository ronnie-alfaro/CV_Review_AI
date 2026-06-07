import { create } from "zustand";
import type { Analysis, CandidateProfile, JobDescription } from "../../../shared/schemas";

type Step = "landing" | "resume" | "job" | "jobReview" | "analysis";

type AlignmentState = {
  step: Step;
  candidate?: CandidateProfile;
  job?: JobDescription;
  analysis?: Analysis;
  loading: boolean;
  error?: string;
  setStep: (step: Step) => void;
  setCandidate: (candidate: CandidateProfile) => void;
  setJob: (job: JobDescription) => void;
  setAnalysis: (analysis: Analysis) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
};

export const useAlignmentStore = create<AlignmentState>((set) => ({
  step: "landing",
  loading: false,
  setStep: (step) => set({ step }),
  setCandidate: (candidate) => set({ candidate }),
  setJob: (job) => set({ job }),
  setAnalysis: (analysis) => set({ analysis }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
