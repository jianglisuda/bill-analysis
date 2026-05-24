import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config, maxFileBytes } from "./config.js";
import { initDb } from "./db.js";
import { processBillTask } from "./processor.js";
import { queryRecords } from "./repositories/records.js";
import { getSummary } from "./repositories/summary.js";
import { createTask, deleteTaskById, getTask, listTasks } from "./repositories/tasks.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedExt = new Set([".csv", ".xlsx"]);

const sanitizeFileName = (fileName: string) => {
  const base = path.basename(fileName).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return /^[=+\-@]/.test(base) ? `_${base}` : base;
};

const app = express();
await fs.mkdir(config.uploadDir, { recursive: true });
await initDb();

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileBytes },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, allowedExt.has(ext));
  },
});

const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const requireUuid = (value: string) => {
  if (!uuidPattern.test(value)) {
    const error = new Error("无效的任务 ID");
    error.name = "ValidationError";
    throw error;
  }
};

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/files/upload", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "请上传 CSV 或 XLSX 文件" });
  const filePath = req.file.path;
  const task = await createTask(sanitizeFileName(req.file.originalname), filePath);
  setImmediate(() => {
    void processBillTask(task.id, filePath);
  });
  return res.status(201).json(task);
}));

app.get("/api/tasks", asyncHandler(async (_req, res) => {
  res.json(await listTasks());
}));

app.get("/api/tasks/:id", asyncHandler(async (req, res) => {
  const taskId = String(req.params.id);
  requireUuid(taskId);
  const task = await getTask(taskId);
  if (!task) return res.status(404).json({ message: "任务不存在" });
  return res.json(task);
}));

app.get("/api/tasks/:id/summary", asyncHandler(async (req, res) => {
  const taskId = String(req.params.id);
  requireUuid(taskId);
  const summary = await getSummary(taskId);
  if (!summary) return res.status(404).json({ message: "分析结果尚未生成" });
  return res.json(summary);
}));

app.get("/api/tasks/:id/records", asyncHandler(async (req, res) => {
  const taskId = String(req.params.id);
  requireUuid(taskId);
  const records = await queryRecords(taskId, req.query as Record<string, string | undefined>);
  res.json(records);
}));

app.delete("/api/tasks/:id", asyncHandler(async (req, res) => {
  const taskId = String(req.params.id);
  requireUuid(taskId);
  const task = await getTask(taskId);
  if (task) await fs.rm(task.filePath, { force: true });
  await deleteTaskById(taskId);
  res.json({ ok: true });
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? `文件超过 ${config.maxFileMb}MB 限制` : "文件上传失败" });
  }
  if (error instanceof Error && error.name === "ValidationError") return res.status(400).json({ message: error.message });
  return res.status(500).json({ message: "服务处理失败，请稍后重试" });
});

app.listen(config.port, () => {
  console.log(`API 服务已启动: http://localhost:${config.port}`);
});
