import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchRecords } from "../services/api";
import type { AnalysisTask, BillRecord, RecordPage, RecordQuery } from "../types";
import { EmptyState } from "./EmptyState";

const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

export function RecordsTable({ task }: { task?: AnalysisTask }) {
  const [records, setRecords] = useState<RecordPage>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState("");
  const [direction, setDirection] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BillRecord | null>(null);

  const query = useMemo<RecordQuery>(() => ({ page, pageSize: 10, keyword, direction, sortBy: "transaction_time", sortDirection: "DESC" }), [page, keyword, direction]);

  useEffect(() => {
    if (!task || task.status !== "success") return;
    fetchRecords(task.id, query)
      .then(setRecords)
      .catch((err: Error) => console.error(err));
  }, [task, query]);

  if (!task || task.status !== "success") {
    return <EmptyState title="暂无可查询明细" description="请选择已完成的分析任务，系统会展示分页明细、条件筛选和交易详情。" />;
  }

  const totalPages = Math.max(1, Math.ceil(records.total / records.pageSize));

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl shadow-blue-950/5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600">Record Search</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">账单明细查询</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 min-w-72 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400">
            <Search size={16} className="text-slate-400" />
            <input className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" value={keyword} placeholder="搜索商户、备注或分类" onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
          </label>
          <select className="h-11 cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-600 outline-none" value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}>
            <option value="">全部类型</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 font-semibold">交易时间</th>
              <th className="px-5 py-4 font-semibold">商户</th>
              <th className="px-5 py-4 font-semibold">分类</th>
              <th className="px-5 py-4 font-semibold">类型</th>
              <th className="px-5 py-4 text-right font-semibold">金额</th>
            </tr>
          </thead>
          <tbody>
            {records.items.map((record) => (
              <tr className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60" key={record.id} onClick={() => setSelected(record)}>
                <td className="px-5 py-4 text-slate-600">{new Date(record.transactionTime).toLocaleString()}</td>
                <td className="px-5 py-4 font-medium text-slate-900">{record.merchant || record.description || "账单交易"}</td>
                <td className="px-5 py-4 text-slate-600">{record.category}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.direction === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{record.direction === "income" ? "收入" : "支出"}</span></td>
                <td className={`px-5 py-4 text-right font-bold ${record.direction === "income" ? "text-emerald-600" : "text-red-600"}`}>{currency.format(Math.abs(record.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.items.length === 0 && <div className="p-6"><EmptyState title="没有匹配的交易" description="请调整关键词或收支类型筛选条件后重新查询。" /></div>}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
        <span>共 {records.total} 条，第 {page} / {totalPages} 页</span>
        <div className="flex gap-2">
          <button className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
          <button className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button>
        </div>
      </div>

      {selected && (
        <div className="mt-5 rounded-3xl bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-950">交易详情</h3>
            <button className="cursor-pointer text-sm font-medium text-blue-600" type="button" onClick={() => setSelected(null)}>收起</button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{selected.description || "该记录无额外备注"}</p>
        </div>
      )}
    </section>
  );
}
