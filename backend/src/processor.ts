import { parseBillFile } from "./parser.js";
import { deleteRecordsForTask, fetchAllRecords } from "./repositories/records.js";
import { buildAndSaveSummary, deleteSummaryForTask } from "./repositories/summary.js";
import { updateTaskRecordCount, updateTaskStatus } from "./repositories/tasks.js";

export async function processBillTask(taskId: string, filePath: string) {
  try {
    await updateTaskStatus(taskId, "processing", 10);
    await deleteSummaryForTask(taskId);
    await deleteRecordsForTask(taskId);

    const totalRecords = await parseBillFile(taskId, filePath, async (progress) => {
      await updateTaskStatus(taskId, "processing", progress);
    });

    await updateTaskRecordCount(taskId, totalRecords);
    await updateTaskStatus(taskId, "processing", 88);
    const records = await fetchAllRecords(taskId);
    await buildAndSaveSummary(taskId, records);
    await updateTaskStatus(taskId, "success", 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "账单解析失败";
    await updateTaskStatus(taskId, "failed", 100, message);
    console.error(`账单分析任务失败: ${taskId}`, error);
  }
}
