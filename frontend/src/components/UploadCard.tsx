import { ChangeEvent, DragEvent, useState } from "react";
import { FileSpreadsheet, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { uploadBillFile } from "../services/api";
import type { AnalysisTask } from "../types";

const maxFileSize = 80 * 1024 * 1024;
const allowedExt = ["csv", "xlsx"];

interface UploadCardProps {
  onCreated: (task: AnalysisTask) => void;
}

export function UploadCard({ onCreated }: UploadCardProps) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const validate = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExt.includes(ext)) return "仅支持 CSV、XLSX 账单文件";
    if (file.size > maxFileSize) return "文件超过 80MB 限制，请拆分后再上传";
    return "";
  };

  const startUpload = (file: File) => {
    const message = validate(file);
    if (message) {
      setError(message);
      return;
    }
    setUploading(true);
    setError("");
    setProgress(0);
    uploadBillFile(file, setProgress)
      .then((task) => {
        setProgress(100);
        onCreated(task);
      })
      .catch((err: Error) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setUploading(false));
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) startUpload(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) startUpload(file);
  };

  return (
    <section id="upload" className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur-xl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Upload Center</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">上传账单，后台异步分析</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">支持银行流水、支付平台账单和企业费用明细。文件上传后立即创建任务，解析过程由后端队列处理，页面会持续同步最新进度。</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <ShieldCheck size={18} /> 文件仅在本服务内解析与持久化
        </div>
      </div>

      <label
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[1.7rem] border-2 border-dashed p-8 text-center transition ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/70 hover:border-blue-400 hover:bg-blue-50"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input className="hidden" type="file" accept=".csv,.xlsx" onChange={onInputChange} disabled={uploading} />
        <div className="mb-5 flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-glow">
          <UploadCloud size={34} />
        </div>
        <p className="text-xl font-bold text-slate-950">拖拽文件到此处，或点击选择账单</p>
        <p className="mt-3 text-sm text-slate-500">CSV / XLSX，单文件最大 80MB。建议包含交易时间、金额、商户、备注等字段。</p>
        {uploading && (
          <div className="mt-8 w-full max-w-lg">
            <div className="mb-2 flex justify-between text-sm font-medium text-slate-600">
              <span>上传进度</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-teal-500 to-violet-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </label>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="mt-0.5 shrink-0" size={18} /> {error}
        </div>
      )}
      <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        {[
          "自动识别收入、支出与退款记录",
          "按月度趋势和消费分类预计算统计",
          "异常大额交易进入风险摘要",
        ].map((text) => (
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3" key={text}>
            <FileSpreadsheet size={16} className="text-blue-600" /> {text}
          </div>
        ))}
      </div>
    </section>
  );
}
