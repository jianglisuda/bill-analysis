import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillRecord } from "../src/types.js";

const mocks = vi.hoisted(() => ({
  parseBillFile: vi.fn(),
  deleteRecordsForTask: vi.fn(),
  fetchAllRecords: vi.fn(),
  buildAndSaveSummary: vi.fn(),
  deleteSummaryForTask: vi.fn(),
  updateTaskRecordCount: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock("../src/parser.js", () => ({ parseBillFile: mocks.parseBillFile }));
vi.mock("../src/repositories/records.js", () => ({
  deleteRecordsForTask: mocks.deleteRecordsForTask,
  fetchAllRecords: mocks.fetchAllRecords,
}));
vi.mock("../src/repositories/summary.js", () => ({
  buildAndSaveSummary: mocks.buildAndSaveSummary,
  deleteSummaryForTask: mocks.deleteSummaryForTask,
}));
vi.mock("../src/repositories/tasks.js", () => ({
  updateTaskRecordCount: mocks.updateTaskRecordCount,
  updateTaskStatus: mocks.updateTaskStatus,
}));

const { processBillTask } = await import("../src/processor.js");

const records: BillRecord[] = [
  {
    id: "r1",
    taskId: "task-1",
    transactionTime: new Date("2026-01-01T00:00:00.000Z"),
    amount: -20,
    direction: "expense",
    category: "餐饮消费",
  },
];

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("processBillTask", () => {
  it("成功解析任务时刷新旧数据、保存统计并更新状态", async () => {
    mocks.parseBillFile.mockImplementationOnce(async (_taskId: string, _filePath: string, onProgress: (progress: number) => Promise<void>) => {
      await onProgress(45);
      return 1;
    });
    mocks.fetchAllRecords.mockResolvedValueOnce(records);

    await processBillTask("task-1", "/tmp/bill.csv");

    expect(mocks.updateTaskStatus).toHaveBeenNthCalledWith(1, "task-1", "processing", 10);
    expect(mocks.deleteSummaryForTask).toHaveBeenCalledWith("task-1");
    expect(mocks.deleteRecordsForTask).toHaveBeenCalledWith("task-1");
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "processing", 45);
    expect(mocks.updateTaskRecordCount).toHaveBeenCalledWith("task-1", 1);
    expect(mocks.fetchAllRecords).toHaveBeenCalledWith("task-1");
    expect(mocks.buildAndSaveSummary).toHaveBeenCalledWith("task-1", records);
    expect(mocks.updateTaskStatus).toHaveBeenLastCalledWith("task-1", "success", 100);
  });

  it("解析失败时将任务标记为失败并保存错误信息", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.parseBillFile.mockRejectedValueOnce(new Error("文件格式错误"));

    await processBillTask("task-1", "/tmp/bill.csv");

    expect(mocks.updateTaskStatus).toHaveBeenLastCalledWith("task-1", "failed", 100, "文件格式错误");
    consoleError.mockRestore();
  });
});
