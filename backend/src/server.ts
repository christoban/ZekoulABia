// let create a simple server
import cookieParser from "cookie-parser";
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";

import { serve } from "inngest/express";
import { inngest } from "./infrastructure/inngest/client/index.ts";
import {
  generateReportCards,
  sendPaymentReminders,
  computeStudentHealthScores,
  handleCriticalHealthAlert,
  handleWarningHealthAlert,
  handlePositiveHealthAlert,
  sendProfessorPrincipalDigest,
  handleGradeLockedDropDetection,
  handleGradeLockedBatchDropDetection,
  markOverdueLoans,
  checkAbsenceThreshold,
  checkAcademicEvents,
  checkOrientationCheckpoints,
  checkYearEndClosingProximity,
  checkSuspiciousAiActionPattern,
  purgerCorbeille,
  BackupSchoolDataJob,
  purgeAnnoncesExpirees,
  purgeSchoolLogs,
  handleTimetableSeancesAppliquees,
  proposeTimetablesGlobally,
} from "./infrastructure/inngest/functions/functions.ts";
import { syncCarteScolaire, relancePaiements, auditMatricules } from "./infrastructure/inngest/functions/paiementJobs.ts";
import { relanceOnboarding } from "./infrastructure/inngest/functions/eleveOnboardingJobs.ts";
import { relanceProfilRH } from "./infrastructure/inngest/functions/hrSelfServiceJobs.ts";
import { exporterOffsiteNocturne } from "./infrastructure/inngest/functions/backupOffsiteJob.ts";
import { escaladerNotificationUrgente } from "./infrastructure/inngest/functions/notificationJobs.ts";
import { initSocket } from "./infrastructure/socket/SocketServer.ts";
import { bootstrapHexagonal } from './infrastructure/config/hexagonal.bootstrap';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { idempotency } from './infrastructure/http/middlewares/idempotency.ts';
import { checkLibreOfficeAvailable } from '@application/statisticalCampaign/xlsEngine';

// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (["1", "true"].includes((process.env.TRUST_PROXY || "").toLowerCase())) {
  app.set("trust proxy", 1);
}

// next add security middlewares/headers + make sure to listen on *root file* for changes

app.use(helmet()); // Security middleware to set various HTTP headers for app security
app.use(express.json({ limit: "5mb" })); // Parse JSON payloads (logo uploads are base64)
app.use(express.urlencoded({ extended: true, limit: "5mb" })); // Middleware to parse URL-encoded bodies
app.use(cookieParser()); // Middleware to parse cookies

// log http requests to console
// NODE_ENV missing in .env
if (process.env.STAGE === "development") {
  app.use(morgan("dev"));
}

// cross-origin resource sharing (CORS) middleware

// CORS: allow the configured client origin plus common local dev hosts
const rawClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = Array.from(new Set([
  rawClientUrl,
  // also allow 127.0.0.1 variant used by some dev setups / Playwright
  rawClientUrl.replace("localhost", "127.0.0.1"),
  // ensure localhost is present
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Next.js dev server (proxy forwarding keeps Origin: localhost:3000)
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]));

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser callers (curl, server-side) or undefined origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  // Idempotency-Key : en-tête envoyé par la file de synchronisation offline (Plan
  // offline-first V1) lors du rejeu d'une action — voir middleware/idempotency.ts.
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Idempotence de la file de synchronisation offline (Plan offline-first V1 §4) — no-op pour
// toute requête sans en-tête Idempotency-Key, donc monté globalement une seule fois plutôt que
// sur chacun des 9+ endpoints concernés individuellement. Voir middleware/idempotency.ts.
app.use(idempotency(prisma));

// LibreOffice health check — vérifié une fois au démarrage (pas seulement découvert en échec
// au moment où un admin génère une déclaration statistique MINESEC), puis exposé ci-dessous.
let libreOfficeHealth: { available: boolean; version?: string; error?: string } | null = null;
checkLibreOfficeAvailable().then((h) => {
  libreOfficeHealth = h;
  if (!h.available) {
    console.warn(`[LibreOffice] Binaire indisponible au démarrage — la génération de déclarations statistiques MINESEC échouera : ${h.error}`);
  } else {
    console.log(`[LibreOffice] Disponible (${h.version})`);
  }
});

// health check route
app.get("/", (req: Request, res: Response) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  res.status(200).json({ status: "OK", message: "Server is healthy", libreOffice: libreOfficeHealth });
});

// SPA Fallback: serve index.html for all non-API routes (enables SPA routing on direct links)
// Note: Build frontend first (cd frontend && bun run build), then use NODE_ENV=production
const staticPath = process.env.STATIC_PATH || join(process.cwd(), "..", "frontend", "dist");
const enableFallback = process.env.NODE_ENV === "production" || process.env.ENABLE_SPA_FALLBACK === "true";

if (enableFallback && existsSync(staticPath)) {
  app.use(express.static(staticPath, {
    setHeaders: (res) => {
      res.setHeader("ngrok-skip-browser-warning", "true");
    },
  }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/socket.io") && !req.path.includes(".")) {
      const indexPath = join(staticPath, "index.html");
      if (existsSync(indexPath)) {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("ngrok-skip-browser-warning", "true");
        res.send(readFileSync(indexPath, "utf-8"));
        return;
      }
    }
    next();
  });
}

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      generateReportCards,
      sendPaymentReminders,
      computeStudentHealthScores,
      handleCriticalHealthAlert,
      handleWarningHealthAlert,
      handlePositiveHealthAlert,
      sendProfessorPrincipalDigest,
      handleGradeLockedDropDetection,
      handleGradeLockedBatchDropDetection,
      markOverdueLoans,
      checkAbsenceThreshold,
      checkAcademicEvents,
      checkOrientationCheckpoints,
      checkYearEndClosingProximity,
      checkSuspiciousAiActionPattern,
      purgerCorbeille,
      BackupSchoolDataJob,
      purgeAnnoncesExpirees,
      purgeSchoolLogs,
      handleTimetableSeancesAppliquees,
      proposeTimetablesGlobally,
      syncCarteScolaire,
      relancePaiements,
      auditMatricules,
      relanceOnboarding,
      relanceProfilRH,
      exporterOffsiteNocturne,
      escaladerNotificationUrgente,
    ],
  })
);

// global error handler middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

bootstrapHexagonal(app);
initSocket(httpServer, allowedOrigins);
httpServer.listen(PORT, () => {
  console.log("Server is running on port 5000");
});
// you can use any of these scripts in your package.json to run the server with nodemon or bun
//    "dev" : "nodemon --exec bun run index.ts",
// "start": "bun --watch index.ts"

// if it's the first time you will redirect to create a new project. The page we are now