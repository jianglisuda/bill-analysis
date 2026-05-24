export type TaskStatus = "pending" | "processing" | "success" | "failed";
export type BillDirection = "income" | "expense";

export interface AnalysisTask {
  id: string;
  fileName: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  totalRecords: number;
}

export interface BillRecord {
  id: string;
  taskId: string;
  transactionTime: string;
  amount: number;
  direction: BillDirection;
  category: string;
  merchant?: string;
  description?: string;
}

export interface AnalysisSummary {
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

export interface RecordQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  direction?: string;
  category?: string;
  sortBy?: "transaction_time" | "amount" | "category";
  sortDirection?: "ASC" | "DESC";
}

export interface RecordPage {
  items: BillRecord[];
  total: number;
  page: number;
  pageSize: number;
}
