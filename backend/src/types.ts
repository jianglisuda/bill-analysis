export type TaskStatus = "pending" | "processing" | "success" | "failed";
export type BillDirection = "income" | "expense";

export interface AnalysisTask {
  id: string;
  fileName: string;
  filePath: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  totalRecords: number;
}

export interface BillRecordInput {
  taskId: string;
  transactionTime: Date;
  amount: number;
  direction: BillDirection;
  category: string;
  merchant?: string;
  description?: string;
}

export interface BillRecord extends BillRecordInput {
  id: string;
}

export interface SummaryPayload {
  taskId: string;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  recordCount: number;
  anomalyCount: number;
  categoryStats: Array<{ category: string; amount: number; count: number }>;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  anomalies: BillRecord[];
}
