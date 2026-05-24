import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { execute, queryRows } from "../db.js";
import type { AnalysisTask, TaskStatus } from "../types.js";

interface TaskRow extends RowDataPacket {
  id: string;
  file_name: string;
  file_path: string;
  status: TaskStatus;
  progress: number;
  created_at: Date | string;
  updated_at: Date | string;
  error_message: string | null;
  total_records: number;
}

const mapTask = (row: TaskRow): AnalysisTask => ({
  id: row.id,
  fileName: row.file_name,
  filePath: row.file_path,
  status: row.status,
  progress: Number(row.progress),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  errorMessage: row.error_message ?? undefined,
  totalRecords: Number(row.total_records),
});

export async function createTask(fileName: string, filePath: string) {
  const id = randomUUID();
  await execute(
    "INSERT INTO analysis_tasks (id, file_name, file_path, status, progress) VALUES (?, ?, ?, 'pending', 5)",
    [id, fileName, filePath],
  );
  const task = await getTask(id);
  if (!task) throw new Error("任务创建失败");
  return task;
}

export async function listTasks() {
  const rows = await queryRows<TaskRow>("SELECT * FROM analysis_tasks ORDER BY created_at DESC LIMIT 50");
  return rows.map(mapTask);
}

export async function getTask(taskId: string) {
  const rows = await queryRows<TaskRow>("SELECT * FROM analysis_tasks WHERE id = ?", [taskId]);
  return rows[0] ? mapTask(rows[0]) : undefined;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, progress: number, errorMessage?: string) {
  await execute(
    "UPDATE analysis_tasks SET status = ?, progress = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [status, progress, errorMessage ?? null, taskId],
  );
  return getTask(taskId);
}

export async function updateTaskRecordCount(taskId: string, totalRecords: number) {
  await execute("UPDATE analysis_tasks SET total_records = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [totalRecords, taskId]);
}

export async function deleteTaskById(taskId: string) {
  await execute("DELETE FROM analysis_tasks WHERE id = ?", [taskId]);
}
