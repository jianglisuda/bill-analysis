import type { AnalysisSummary, AnalysisTask, RecordPage, RecordQuery } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4100/api";

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "服务暂时不可用" }));
    throw new Error(payload.message ?? "请求失败");
  }
  return response.json() as Promise<T>;
};

export const uploadBillFile = (file: File, onProgress: (progress: number) => void) => {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise<AnalysisTask>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/files/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as AnalysisTask);
        return;
      }
      const payload = JSON.parse(xhr.responseText || "{}") as { message?: string };
      reject(new Error(payload.message ?? "上传失败"));
    };
    xhr.onerror = () => reject(new Error("网络连接异常，账单文件未上传成功"));
    xhr.send(formData);
  });
};

export const fetchTasks = () => request<AnalysisTask[]>("/tasks");

export const fetchTask = (taskId: string) => request<AnalysisTask>(`/tasks/${taskId}`);

export const fetchSummary = (taskId: string) => request<AnalysisSummary>(`/tasks/${taskId}/summary`);

export const fetchRecords = (taskId: string, query: RecordQuery) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return request<RecordPage>(`/tasks/${taskId}/records?${params.toString()}`);
};

export const deleteTask = (taskId: string) => request<{ ok: true }>(`/tasks/${taskId}`, { method: "DELETE" });
