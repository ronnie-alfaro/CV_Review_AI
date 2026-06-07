import express from "express";
import multer from "multer";
import { z } from "zod";
import { parseDocument } from "./services/documentParser.js";
import { extractCandidateProfile } from "./services/profileExtractor.js";
import { extractJobDescription } from "./services/jobExtractor.js";
import { analyzeAlignment } from "./services/scoringEngine.js";
import { llmClient } from "./services/llmClient.js";
import { saveAnalysis, saveCandidate, saveJob } from "./repositories.js";
import { candidateProfileSchema, jobDescriptionSchema } from "../../shared/schemas.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
export const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, ai: "llama.cpp OpenAI-compatible endpoint optional" });
});

router.get("/llm/status", async (_req, res) => {
  res.json(await llmClient.status());
});

router.post("/resume/parse", upload.single("file"), async (req, res, next) => {
  try {
    const rawText = req.file
      ? await parseDocument(req.file.buffer, req.file.originalname)
      : z.object({ text: z.string() }).parse(req.body).text;
    const profile = await extractCandidateProfile(rawText);
    res.json(await saveCandidate(profile));
  } catch (error) {
    next(error);
  }
});

router.post("/job/parse", upload.single("file"), async (req, res, next) => {
  try {
    const rawText = req.file
      ? await parseDocument(req.file.buffer, req.file.originalname, req.body.text)
      : z.object({ text: z.string().min(20) }).parse(req.body).text;
    const job = await extractJobDescription(rawText);
    res.json(await saveJob(job));
  } catch (error) {
    next(error);
  }
});

router.post("/analysis", async (req, res, next) => {
  try {
    const body = z.object({
      candidate: candidateProfileSchema,
      job: jobDescriptionSchema
    }).parse(req.body);
    const analysis = await analyzeAlignment(body.candidate, body.job);
    const candidateId = body.candidate.id ?? (await saveCandidate(body.candidate)).id;
    const jobId = body.job.id ?? (await saveJob(body.job)).id;
    res.json(await saveAnalysis(candidateId!, jobId!, analysis));
  } catch (error) {
    next(error);
  }
});
