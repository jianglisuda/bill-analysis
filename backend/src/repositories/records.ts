import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { execute, queryRows, type SqlValue } from "../db.js";
import type { BillRecord, BillRecordInput } from "../types.js";

const allowedSort = new Set(["transaction_time", "amount", "category"]);
const allowedDirection = new Set(["ASC", "DESC"]);

interface RecordRow extends RowDataPacket {
  id: string;
  task_id: string;
  transaction_time: Date | string;
  amount: number | string;
  direction: "income" | "expense";
  category: string;
  merchant: string | null;
  description: string | null;
}

interface CountRow extends RowDataPacket {
  count: number | string;
}

const mapRecord = (row: RecordRow): BillRecord => ({
  id: row.id,
  taskId: row.task_id,
  transactionTime: new Date(row.transaction_time),
  amount: Number(row.amount),
  direction: row.direction,
  category: row.category,
  merchant: row.merchant ?? undefined,
  description: row.description ?? undefined,
});

export async function insertRecords(records: BillRecordInput[]) {
  if (records.length === 0) return;
  const values: SqlValue[] = [];
  const placeholders = records.map((record) => {
    values.push(randomUUID(), record.taskId, record.transactionTime, record.amount, record.direction, record.category, record.merchant ?? null, record.description ?? null);
    return "(?, ?, ?, ?, ?, ?, ?, ?)";
  });
  await execute(
    `INSERT INTO bill_records (id, task_id, transaction_time, amount, direction, category, merchant, description)
     VALUES ${placeholders.join(",")}`,
    values,
  );
}

export async function deleteRecordsForTask(taskId: string) {
  await execute("DELETE FROM bill_records WHERE task_id = ?", [taskId]);
}

export async function queryRecords(taskId: string, query: Record<string, string | undefined>) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 10)));
  const sortBy = allowedSort.has(query.sortBy ?? "") ? query.sortBy! : "transaction_time";
  const sortDirection = allowedDirection.has((query.sortDirection ?? "DESC").toUpperCase()) ? (query.sortDirection ?? "DESC").toUpperCase() : "DESC";
  const values: SqlValue[] = [taskId];
  const where = ["task_id = ?"];

  if (query.direction === "income" || query.direction === "expense") {
    values.push(query.direction);
    where.push("direction = ?");
  }
  if (query.keyword) {
    values.push(`%${query.keyword.toLowerCase()}%`);
    where.push("(LOWER(COALESCE(merchant, '')) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ? OR LOWER(category) LIKE ?)");
    values.push(values[values.length - 1], values[values.length - 1]);
  }

  const whereSql = where.join(" AND ");
  const countRows = await queryRows<CountRow>(`SELECT COUNT(*) AS count FROM bill_records WHERE ${whereSql}`, values);
  const dataRows = await queryRows<RecordRow>(
    `SELECT * FROM bill_records
     WHERE ${whereSql}
     ORDER BY ${sortBy} ${sortDirection}
     LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  return {
    items: dataRows.map(mapRecord),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function fetchAllRecords(taskId: string) {
  const rows = await queryRows<RecordRow>("SELECT * FROM bill_records WHERE task_id = ? ORDER BY transaction_time ASC", [taskId]);
  return rows.map(mapRecord);
}
