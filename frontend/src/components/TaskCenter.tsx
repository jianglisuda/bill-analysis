import { Clock, FileText, Trash2 } from "lucide-react";
import type { AnalysisTask } from "../types";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";

interface TaskCenterProps {
  tasks: AnalysisTask[];
  selectedTaskId?: string;
  onSelect: (task: AnalysisTask) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCenter({ tasks, selectedTaskId, onSelect, onDelete }: TaskCenterProps) {
  return (
    <section id="tasks" className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-950/5 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-600">Task Center</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">历史分析任务</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">{tasks.length} 个任务</span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="尚未创建分析任务" description="上传 CSV 或 Excel 账单后，任务会在这里展示排队、解析、完成和失败状态。" />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const active = selectedTaskId === task.id;
            return (
              <article
                className={`group rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-blue-300 bg-blue-50/70" : "border-slate-100 bg-white"}`}
                key={task.id}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <button className="flex flex-1 cursor-pointer items-start gap-4 text-left" type="button" onClick={() => onSelect(task)}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-teal-100 text-blue-700">
                      <FileText size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-slate-950">{task.fileName}</h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <Clock size={14} /> {new Date(task.createdAt).toLocaleString()} · {task.totalRecords} 条明细
                      </p>
                      {task.errorMessage && <p className="mt-2 text-sm text-red-600">失败原因：{task.errorMessage}</p>}
                    </div>
                  </button>
                  <div className="flex items-center gap-4 md:w-64">
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
                        <span>处理进度</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500 transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                    <button
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      type="button"
                      aria-label={`删除 ${task.fileName}`}
                      onClick={() => onDelete(task.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
