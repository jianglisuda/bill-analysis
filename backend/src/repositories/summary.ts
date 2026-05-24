import type { RowDataPacket } from "mysql2/promise";
import { execute, queryRows } from "../db.js";
import type { BillRecord, SummaryPayload } from "../types.js";

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

interface SummaryRow extends RowDataPacket {
  task_id: string;
  total_income: number | string;
  total_expense: number | string;
  net_amount: number | string;
  record_count: number;
  anomaly_count: number;
  category_stats: unknown;
  monthly_trend: unknown;
  anomalies: unknown;
}

const parseJson = <T>(value: unknown): T => {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
};

export async function deleteSummaryForTask(taskId: string) {
  await execute("DELETE FROM analysis_summaries WHERE task_id = ?", [taskId]);
}

export async function buildAndSaveSummary(taskId: string, records: BillRecord[]) {
  const totalIncome = records.filter((item) => item.direction === "income").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const totalExpense = records.filter((item) => item.direction === "expense").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expenseRecords = records.filter((item) => item.direction === "expense");
  const avgExpense = expenseRecords.length ? totalExpense / expenseRecords.length : 0;

  const categoryMap = new Map<string, { amount: number; count: number }>();
  expenseRecords.forEach((item) => {
    const current = categoryMap.get(item.category) ?? { amount: 0, count: 0 };
    current.amount += Math.abs(item.amount);
    current.count += 1;
    categoryMap.set(item.category, current);
  });

  const trendMap = new Map<string, { month: string; income: number; expense: number }>();
  records.forEach((item) => {
    const key = monthKey(item.transactionTime);
    const current = trendMap.get(key) ?? { month: key, income: 0, expense: 0 };
    if (item.direction === "income") current.income += Math.abs(item.amount);
    if (item.direction === "expense") current.expense += Math.abs(item.amount);
    trendMap.set(key, current);
  });

  const anomalies = expenseRecords
    .filter((item) => Math.abs(item.amount) > Math.max(avgExpense * 2.5, 3000))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 8);

  const payload: SummaryPayload = {
    taskId,
    totalIncome,
    totalExpense,
    netAmount: totalIncome - totalExpense,
    recordCount: records.length,
    anomalyCount: anomalies.length,
    categoryStats: Array.from(categoryMap.entries())
      .map(([category, value]) => ({ category, amount: Number(value.amount.toFixed(2)), count: value.count }))
      .sort((a, b) => b.amount - a.amount),
    monthlyTrend: Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    anomalies,
  };

  await execute(
    `INSERT INTO analysis_summaries (task_id, total_income, total_expense, net_amount, record_count, anomaly_count, category_stats, monthly_trend, anomalies)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_income = VALUES(total_income),
       total_expense = VALUES(total_expense),
       net_amount = VALUES(net_amount),
       record_count = VALUES(record_count),
       anomaly_count = VALUES(anomaly_count),
       category_stats = VALUES(category_stats),
       monthly_trend = VALUES(monthly_trend),
       anomalies = VALUES(anomalies),
       updated_at = CURRENT_TIMESTAMP(3)`,
    [taskId, payload.totalIncome, payload.totalExpense, payload.netAmount, payload.recordCount, payload.anomalyCount, JSON.stringify(payload.categoryStats), JSON.stringify(payload.monthlyTrend), JSON.stringify(payload.anomalies)],
  );
  return payload;
}

export async function getSummary(taskId: string) {
  const rows = await queryRows<SummaryRow>("SELECT * FROM analysis_summaries WHERE task_id = ?", [taskId]);
  if (!rows[0]) return undefined;
  const row = rows[0];
  return {
    taskId: row.task_id,
    totalIncome: Number(row.total_income),
    totalExpense: Number(row.total_expense),
    netAmount: Number(row.net_amount),
    recordCount: Number(row.record_count),
    anomalyCount: Number(row.anomaly_count),
    categoryStats: parseJson<SummaryPayload["categoryStats"]>(row.category_stats),
    monthlyTrend: parseJson<SummaryPayload["monthlyTrend"]>(row.monthly_trend),
    anomalies: parseJson<SummaryPayload["anomalies"]>(row.anomalies),
  };
}
