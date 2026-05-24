import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillRecord } from "../src/types.js";

const dbMock = vi.hoisted(() => ({
  execute: vi.fn(),
  queryRows: vi.fn(),
}));

vi.mock("../src/db.js", () => dbMock);

const { buildAndSaveSummary, deleteSummaryForTask, getSummary } = await import("../src/repositories/summary.js");

const records: BillRecord[] = [
  {
    id: "r1",
    taskId: "task-1",
    transactionTime: new Date("2026-01-02T00:00:00.000Z"),
    amount: -120,
    direction: "expense",
    category: "餐饮消费",
    merchant: "餐厅",
    description: "午餐",
  },
  {
    id: "r2",
    taskId: "task-1",
    transactionTime: new Date("2026-01-15T00:00:00.000Z"),
    amount: -8000,
    direction: "expense",
    category: "购物消费",
    merchant: "商场",
    description: "大额消费",
  },
  {
    id: "r3",
    taskId: "task-1",
    transactionTime: new Date("2026-01-20T00:00:00.000Z"),
    amount: -100,
    direction: "expense",
    category: "餐饮消费",
    merchant: "便利店",
    description: "零食",
  },
  {
    id: "r4",
    taskId: "task-1",
    transactionTime: new Date("2026-01-21T00:00:00.000Z"),
    amount: -100,
    direction: "expense",
    category: "交通出行",
    merchant: "地铁",
    description: "通勤",
  },
  {
    id: "r5",
    taskId: "task-1",
    transactionTime: new Date("2026-02-01T00:00:00.000Z"),
    amount: 10000,
    direction: "income",
    category: "工资收入",
    merchant: "公司",
    description: "工资",
  },
];

beforeEach(() => {
  dbMock.execute.mockReset();
  dbMock.queryRows.mockReset();
});

describe("summary repository", () => {
  it("生成统计结果并使用参数化 SQL 保存", async () => {
    const payload = await buildAndSaveSummary("task-1", records);

    expect(payload).toMatchObject({
      taskId: "task-1",
      totalIncome: 10000,
      totalExpense: 8320,
      netAmount: 1680,
      recordCount: 5,
      anomalyCount: 1,
    });
    expect(payload.categoryStats).toEqual([
      { category: "购物消费", amount: 8000, count: 1 },
      { category: "餐饮消费", amount: 220, count: 2 },
      { category: "交通出行", amount: 100, count: 1 },
    ]);
    expect(payload.monthlyTrend).toEqual([
      { month: "2026-01", income: 0, expense: 8320 },
      { month: "2026-02", income: 10000, expense: 0 },
    ]);
    expect(payload.anomalies).toHaveLength(1);
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMock.execute.mock.calls[0];
    expect(sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    expect(params.slice(0, 6)).toEqual(["task-1", 10000, 8320, 1680, 5, 1]);
    expect(JSON.parse(params[6])).toEqual(payload.categoryStats);
  });

  it("读取统计结果时解析 MySQL JSON 字符串字段", async () => {
    dbMock.queryRows.mockResolvedValueOnce([
      {
        task_id: "task-1",
        total_income: "100.00",
        total_expense: "30.00",
        net_amount: "70.00",
        record_count: 2,
        anomaly_count: 0,
        category_stats: JSON.stringify([{ category: "餐饮消费", amount: 30, count: 1 }]),
        monthly_trend: JSON.stringify([{ month: "2026-01", income: 100, expense: 30 }]),
        anomalies: JSON.stringify([]),
      },
    ]);

    const summary = await getSummary("task-1");

    expect(summary).toEqual({
      taskId: "task-1",
      totalIncome: 100,
      totalExpense: 30,
      netAmount: 70,
      recordCount: 2,
      anomalyCount: 0,
      categoryStats: [{ category: "餐饮消费", amount: 30, count: 1 }],
      monthlyTrend: [{ month: "2026-01", income: 100, expense: 30 }],
      anomalies: [],
    });
  });

  it("按任务 ID 删除统计结果", async () => {
    await deleteSummaryForTask("task-1");

    expect(dbMock.execute).toHaveBeenCalledWith("DELETE FROM analysis_summaries WHERE task_id = ?", ["task-1"]);
  });
});
