import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";

const app: Express = express();

app.use(cors());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", authRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Vercel API error", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
