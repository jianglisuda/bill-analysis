import { AlertTriangle, ArrowDownRight, ArrowUpRight, WalletCards } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisSummary, AnalysisTask } from "../types";
import { EmptyState } from "./EmptyState";

const colors = ["#2563EB", "#14B8A6", "#7C3AED", "#F59E0B", "#16A34A", "#DC2626"];
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

interface DashboardProps {
  task?: AnalysisTask;
  summary?: AnalysisSummary;
  loading: boolean;
}

export function Dashboard({ task, summary, loading }: DashboardProps) {
  if (!task) return <EmptyState title="请选择任务查看分析看板" description="完成解析的任务会展示收入、支出、趋势、分类占比和异常交易摘要。" />;
  if (task.status !== "success") {
    return <EmptyState title="分析结果尚未就绪" description="后台正在进行字段识别、数据清洗和统计预计算，请稍后查看。" />;
  }
  if (loading || !summary) return <EmptyState title="正在载入看板" description="正在读取持久化统计结果并生成图表。" />;

  const cards = [
    { label: "总收入", value: summary.totalIncome, icon: ArrowUpRight, className: "from-emerald-500 to-teal-500" },
    { label: "总支出", value: summary.totalExpense, icon: ArrowDownRight, className: "from-red-500 to-orange-500" },
    { label: "净流入", value: summary.netAmount, icon: WalletCards, className: "from-blue-600 to-violet-600" },
    { label: "异常交易", value: summary.anomalyCount, icon: AlertTriangle, className: "from-amber-500 to-yellow-500", plain: true },
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white shadow-xl shadow-blue-950/5" key={card.label}>
              <div className={`h-2 bg-gradient-to-r ${card.className}`} />
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${card.className} text-white`}>
                    <Icon size={20} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-950">{card.plain ? card.value : currency.format(card.value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-xl shadow-blue-950/5 lg:col-span-3">
          <h3 className="text-lg font-bold text-slate-950">月度收支趋势</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthlyTrend}>
                <XAxis dataKey="month" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip formatter={(value) => currency.format(Number(value))} />
                <Line type="monotone" dataKey="income" name="收入" stroke="#16A34A" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="expense" name="支出" stroke="#DC2626" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-xl shadow-blue-950/5 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-950">分类支出占比</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary.categoryStats} dataKey="amount" nameKey="category" innerRadius={70} outerRadius={115} paddingAngle={4}>
                  {summary.categoryStats.map((item, index) => <Cell key={item.category} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => currency.format(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {summary.categoryStats.slice(0, 6).map((item, index) => (
              <div className="flex items-center gap-2" key={item.category}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="truncate text-slate-600">{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-amber-100 bg-amber-50/80 p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-amber-800"><AlertTriangle size={20} /> 异常交易摘要</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summary.anomalies.length === 0 ? (
            <p className="text-sm text-amber-700">未发现超过历史平均水平的异常大额交易。</p>
          ) : summary.anomalies.slice(0, 3).map((item) => (
            <div className="rounded-2xl bg-white/80 p-4" key={item.id}>
              <p className="font-semibold text-slate-950">{currency.format(Math.abs(item.amount))}</p>
              <p className="mt-1 text-sm text-slate-500">{item.merchant || item.description || "未命名交易"}</p>
              <p className="mt-2 text-xs text-amber-700">{new Date(item.transactionTime).toLocaleDateString()} · {item.category}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
