import type { TaskStatus } from "../types";

const statusMap: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "排队中", className: "bg-amber-100 text-amber-700 ring-amber-200" },
  processing: { label: "解析中", className: "bg-blue-100 text-blue-700 ring-blue-200" },
  success: { label: "已完成", className: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  failed: { label: "失败", className: "bg-red-100 text-red-700 ring-red-200" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const item = statusMap[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${item.className}`}>{item.label}</span>;
}
