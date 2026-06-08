import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", router);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = fs.existsSync(path.resolve(process.cwd(), "dist/client/index.html"))
  ? path.resolve(process.cwd(), "dist/client")
  : path.resolve(__dirname, "../client");
const clientIndex = path.join(clientDist, "index.html");

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(clientIndex));
} else {
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      message: "API is running. In development, open the web app at http://localhost:5173."
    });
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(400).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Career Alignment AI API listening on http://localhost:${config.port}`);
});
