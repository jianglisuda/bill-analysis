import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillRecordInput } from "../src/types.js";

const dbMock = vi.hoisted(() => ({
  execute: vi.fn(),
  queryRows: vi.fn(),
}));

vi.mock("../src/db.js", () => dbMock);

const { deleteRecordsForTask, insertRecords, queryRecords } = await import("../src/repositories/records.js");

beforeEach(() => {
  dbMock.execute.mockReset();
  dbMock.queryRows.mockReset();
});

describe("records repository", () => {
  it("批量插入账单明细时使用占位符和参数绑定", async () => {
    const records: BillRecordInput[] = [
      {
        taskId: "task-1",
        transactionTime: new Date("2026-01-01T00:00:00.000Z"),
        amount: -20,
        direction: "expense",
        category: "餐饮消费",
        merchant: "咖啡店",
        description: "早餐",
      },
      {
        taskId: "task-1",
        transactionTime: new Date("2026-01-02T00:00:00.000Z"),
        amount: 1000,
        direction: "income",
        category: "工资收入",
      },
    ];

    await insertRecords(records);

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMock.execute.mock.calls[0];
    expect(sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?),(?, ?, ?, ?, ?, ?, ?, ?)");
    expect(params).toHaveLength(16);
    expect(params[1]).toBe("task-1");
    expect(params[4]).toBe("expense");
    expect(params[12]).toBe("income");
  });

  it("查询明细时过滤非法排序字段，避免动态 SQL 注入", async () => {
    dbMock.queryRows
      .mockResolvedValueOnce([{ count: "1" }])
      .mockResolvedValueOnce([
        {
          id: "r1",
          task_id: "task-1",
          transaction_time: "2026-01-01T00:00:00.000Z",
          amount: "20.50",
          direction: "expense",
          category: "餐饮消费",
          merchant: "咖啡店",
          description: "早餐",
        },
      ]);

    const page = await queryRecords("task-1", {
      keyword: "咖啡",
      direction: "expense",
      sortBy: "amount; DROP TABLE bill_records;" as "amount",
      sortDirection: "DESC; DROP TABLE analysis_tasks;" as "DESC",
      page: "2",
      pageSize: "20",
    });

    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 20 });
    expect(page.items[0]).toMatchObject({ id: "r1", amount: 20.5, direction: "expense" });
    const countSql = dbMock.queryRows.mock.calls[0][0];
    const dataSql = dbMock.queryRows.mock.calls[1][0];
    expect(countSql).toContain("task_id = ?");
    expect(dataSql).toContain("ORDER BY transaction_time DESC");
    expect(dataSql).not.toContain("DROP TABLE");
    expect(dbMock.queryRows.mock.calls[1][1]).toEqual(["task-1", "expense", "%咖啡%", "%咖啡%", "%咖啡%", 20, 20]);
  });

  it("按任务 ID 删除明细", async () => {
    await deleteRecordsForTask("task-1");

    expect(dbMock.execute).toHaveBeenCalledWith("DELETE FROM bill_records WHERE task_id = ?", ["task-1"]);
  });
});
