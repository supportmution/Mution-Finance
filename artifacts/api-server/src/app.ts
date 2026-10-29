import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import waRouter from "./routes/wa";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WhatsApp routes (/wa, /api/wa/status, /api/wa/qr)
app.use(waRouter);

// Base API routes (/api/...)
app.use("/api", router);

// Serve frontend static files if they exist
const candidateStaticPaths = [
  path.resolve(process.cwd(), "artifacts/mution-finance/dist/public"),
  path.resolve(__dirname, "../../mution-finance/dist/public"),
];

const staticDir = candidateStaticPaths.find((p) => fs.existsSync(p));

if (staticDir) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api") ||
      req.path.startsWith("/wa")
    ) {
      return next();
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
