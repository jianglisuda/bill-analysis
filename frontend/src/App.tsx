import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Navigation } from "./components/Navigation";
import { RecordsTable } from "./components/RecordsTable";
import { TaskCenter } from "./components/TaskCenter";
import { UploadCard } from "./components/UploadCard";
import { deleteTask, fetchSummary, fetchTask, fetchTasks } from "./services/api";
import type { AnalysisSummary, AnalysisTask } from "./types";

export default function App() {
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AnalysisTask | undefined>();
  const [summary, setSummary] = useState<AnalysisSummary | undefined>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshTasks = () => {
    fetchTasks()
      .then((items) => {
        setTasks(items);
        if (!selectedTask && items[0]) setSelectedTask(items[0]);
      })
      .catch((err: Error) => console.error(err));
  };

  useEffect(() => {
    refreshTasks();
  }, []);

  useEffect(() => {
    if (!selectedTask || selectedTask.status === "success" || selectedTask.status === "failed") return;
    const timer = window.setInterval(() => {
      fetchTask(selectedTask.id)
        .then((task) => {
          setSelectedTask(task);
          setTasks((items) => items.map((item) => (item.id === task.id ? task : item)));
        })
        .catch((err: Error) => console.error(err));
    }, 1600);
    return () => window.clearInterval(timer);
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedTask || selectedTask.status !== "success") {
      setSummary(undefined);
      return;
    }
    setSummaryLoading(true);
    fetchSummary(selectedTask.id)
      .then(setSummary)
      .catch((err: Error) => console.error(err))
      .finally(() => setSummaryLoading(false));
  }, [selectedTask]);

  const onCreated = (task: AnalysisTask) => {
    setNotice("分析任务已创建，后台 Worker 正在处理账单文件。");
    setSelectedTask(task);
    setTasks((items) => [task, ...items.filter((item) => item.id !== task.id)]);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const onDelete = (taskId: string) => {
    deleteTask(taskId)
      .then(() => {
        setTasks((items) => items.filter((item) => item.id !== taskId));
        if (selectedTask?.id === taskId) {
          setSelectedTask(undefined);
          setSummary(undefined);
        }
      })
      .catch((err: Error) => console.error(err));
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),radial-gradient(circle_at_top_right,#ccfbf1,transparent_28%),linear-gradient(180deg,#f8fafc,#eff6ff)] text-slate-950">
      <Navigation />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-12 pt-28">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <UploadCard onCreated={onCreated} />
          <TaskCenter tasks={tasks} selectedTaskId={selectedTask?.id} onSelect={setSelectedTask} onDelete={onDelete} />
        </div>
        {notice && <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-700 shadow-sm">{notice}</div>}
        <Dashboard task={selectedTask} summary={summary} loading={summaryLoading} />
        <RecordsTable task={selectedTask} />
      </main>
      <footer className="border-t border-white/70 bg-white/60 px-6 py-6 text-center text-sm text-slate-500 backdrop-blur-xl">
        面向大文件账单的异步分析工作台 · 支持持久化结果回看、明细检索与异常摘要
      </footer>
    </div>
  );
}
