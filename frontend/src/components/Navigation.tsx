import { BarChart3, Database, UploadCloud } from "lucide-react";

export function Navigation() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/50 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-teal-500 to-violet-600 text-white shadow-glow">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-950">账单智能分析平台</p>
            <p className="text-xs text-slate-500">大文件异步解析 · 财务洞察 · 历史追踪</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-slate-100 p-1 text-sm font-medium text-slate-600 md:flex">
          <a className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-blue-600 shadow-sm" href="#upload">
            <UploadCloud size={16} /> 上传分析
          </a>
          <a className="flex items-center gap-2 rounded-full px-4 py-2 hover:text-blue-600" href="#tasks">
            <Database size={16} /> 任务中心
          </a>
        </div>
      </nav>
    </header>
  );
}
