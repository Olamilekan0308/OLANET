import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Render runs the API and frontend as one web service. The frontend is built
// into skillhub/dist/public by Vite, so serve it directly from Express.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(currentDir, "../../skillhub/dist/public");
const frontendIndex = path.join(frontendDir, "index.html");

app.use(express.static(frontendDir));

// SPA fallback for client-side routes, while leaving unknown API routes alone.
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(frontendIndex, (err) => {
      if (err) next(err);
    });
    return;
  }
  next();
});

export default app;
