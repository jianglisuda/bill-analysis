import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BillRecordInput } from "../src/types.js";

const insertedRecords: BillRecordInput[] = [];

vi.mock("../src/repositories/records.js", () => ({
  insertRecords: vi.fn(async (records: BillRecordInput[]) => {
    insertedRecords.push(...records);
  }),
}));

const { parseBillFile } = await import("../src/parser.js");

let tempDir: string | undefined;

afterEach(async () => {
  insertedRecords.length = 0;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("parseBillFile", () => {
  it("解析 CSV 账单并标准化收入、支出、分类和商户信息", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "bill-parser-"));
    const filePath = path.join(tempDir, "bill.csv");
    await writeFile(
      filePath,
      [
        "交易时间,金额,收支类型,商户,备注",
        "2026-01-02 10:30:00,-35.5,支出,星巴克咖啡,早餐",
        "2026-01-03 09:00:00,12000,收入,公司,工资",
        "2026-01-04 12:00:00,0,支出,无效,零金额应跳过",
      ].join("\n"),
      "utf8",
    );

    const count = await parseBillFile("task-1", filePath, vi.fn());

    expect(count).toBe(2);
    expect(insertedRecords).toHaveLength(2);
    expect(insertedRecords[0]).toMatchObject({
      taskId: "task-1",
      amount: -35.5,
      direction: "expense",
      category: "餐饮消费",
      merchant: "星巴克咖啡",
      description: "早餐",
    });
    expect(insertedRecords[1]).toMatchObject({
      taskId: "task-1",
      amount: 12000,
      direction: "income",
      category: "工资收入",
      merchant: "公司",
      description: "工资",
    });
  });

  it("支持收入/支出分列的 CSV 账单", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "bill-parser-"));
    const filePath = path.join(tempDir, "split-columns.csv");
    await writeFile(
      filePath,
      [
        "交易日期,收入,支出,交易对方,摘要",
        "2026/02/01,5000,,客户,转入",
        "2026/02/02,,88.8,地铁,通勤",
      ].join("\n"),
      "utf8",
    );

    const count = await parseBillFile("task-2", filePath, vi.fn());

    expect(count).toBe(2);
    expect(insertedRecords.map((record) => record.direction)).toEqual(["income", "expense"]);
    expect(insertedRecords.map((record) => record.amount)).toEqual([5000, -88.8]);
  });
});
