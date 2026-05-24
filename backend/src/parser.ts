import { createReadStream } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import ExcelJS from "exceljs";
import { insertRecords } from "./repositories/records.js";
import type { BillDirection, BillRecordInput } from "./types.js";

type RawRow = Record<string, unknown>;

const timeKeys = ["transaction_time", "time", "date", "交易时间", "交易日期", "支付时间", "记账日期"];
const amountKeys = ["amount", "金额", "交易金额", "收支金额", "发生额"];
const incomeKeys = ["收入", "入账金额", "income"];
const expenseKeys = ["支出", "出账金额", "expense"];
const directionKeys = ["direction", "收支类型", "类型", "收/支", "交易类型"];
const categoryKeys = ["category", "分类", "交易分类", "账单分类"];
const merchantKeys = ["merchant", "商户", "交易对方", "对方户名", "商品", "店铺"];
const descriptionKeys = ["description", "备注", "摘要", "说明", "交易说明"];

const findValue = (row: RawRow, keys: string[]) => {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => keys.some((candidate) => key.trim().toLowerCase() === candidate.toLowerCase()));
  return match?.[1];
};

const cellText = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const objectValue = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (objectValue.text) return objectValue.text;
    if (objectValue.result !== undefined) return cellText(objectValue.result);
    if (objectValue.richText) return objectValue.richText.map((item) => item.text).join("");
  }
  return String(value ?? "");
};

const cleanText = (value: unknown) => cellText(value).trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 300);

const parseAmount = (value: unknown) => {
  const text = cleanText(value).replace(/[,￥¥\s]/g, "");
  const matched = text.match(/-?\d+(\.\d+)?/);
  return matched ? Number(matched[0]) : 0;
};

const parseDate = (value: unknown) => {
  if (value instanceof Date) return value;
  const text = cleanText(value).replace(/年|\//g, "-").replace(/月/g, "-").replace(/日/g, "");
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const detectDirection = (row: RawRow, amount: number): BillDirection => {
  const direction = cleanText(findValue(row, directionKeys)).toLowerCase();
  if (direction.includes("收") || direction.includes("入") || direction.includes("income") || direction.includes("credit")) return "income";
  if (direction.includes("支") || direction.includes("出") || direction.includes("expense") || direction.includes("debit")) return "expense";
  return amount >= 0 ? "income" : "expense";
};

const classify = (merchant: string, description: string, fallback: string) => {
  const text = `${merchant} ${description}`;
  if (fallback) return fallback;
  if (/工资|薪资|奖金|报销|转入/.test(text)) return "工资收入";
  if (/餐|咖啡|外卖|饭|食堂|超市/.test(text)) return "餐饮消费";
  if (/地铁|公交|滴滴|打车|加油|停车|铁路|机票/.test(text)) return "交通出行";
  if (/房租|物业|水电|燃气|宽带/.test(text)) return "居住生活";
  if (/医院|药|体检|医保/.test(text)) return "医疗健康";
  if (/淘宝|京东|拼多多|电商|商场/.test(text)) return "购物消费";
  return "其他交易";
};

const normalizeRow = (taskId: string, row: RawRow): BillRecordInput | undefined => {
  const income = parseAmount(findValue(row, incomeKeys));
  const expense = parseAmount(findValue(row, expenseKeys));
  let amount = parseAmount(findValue(row, amountKeys));
  if (!amount && income) amount = Math.abs(income);
  if (!amount && expense) amount = -Math.abs(expense);
  if (!Number.isFinite(amount) || amount === 0) return undefined;
  const direction = detectDirection(row, amount);
  const merchant = cleanText(findValue(row, merchantKeys));
  const description = cleanText(findValue(row, descriptionKeys));
  const category = classify(merchant, description, cleanText(findValue(row, categoryKeys)));
  return {
    taskId,
    transactionTime: parseDate(findValue(row, timeKeys)),
    amount: direction === "expense" ? -Math.abs(amount) : Math.abs(amount),
    direction,
    category,
    merchant,
    description,
  };
};

const worksheetToRows = async (filePath: string) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cleanText(cell.value);
  });
  const rows: RawRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: RawRow = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber] || `column_${colNumber}`;
      item[key] = cell.value;
    });
    rows.push(item);
  });
  return rows;
};

async function flush(buffer: BillRecordInput[]) {
  if (buffer.length === 0) return;
  await insertRecords(buffer.splice(0, buffer.length));
}

export async function parseBillFile(taskId: string, filePath: string, onProgress: (progress: number) => Promise<void>) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer: BillRecordInput[] = [];
  let count = 0;

  if (ext === ".csv") {
    const stream = createReadStream(filePath).pipe(parse({ bom: true, columns: true, skip_empty_lines: true, trim: true }));
    for await (const row of stream) {
      const record = normalizeRow(taskId, row as RawRow);
      if (record) {
        buffer.push(record);
        count += 1;
      }
      if (buffer.length >= 500) {
        await flush(buffer);
        await onProgress(Math.min(80, 20 + (count % 6000) / 100));
      }
    }
    await flush(buffer);
    return count;
  }

  const rows = await worksheetToRows(filePath);
  for (const [index, row] of rows.entries()) {
    const record = normalizeRow(taskId, row);
    if (record) {
      buffer.push(record);
      count += 1;
    }
    if (buffer.length >= 500) await flush(buffer);
    if (index % 500 === 0) await onProgress(Math.min(80, 20 + Math.round((index / Math.max(rows.length, 1)) * 60)));
  }
  await flush(buffer);
  return count;
}
