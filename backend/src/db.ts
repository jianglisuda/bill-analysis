import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { config } from "./config.js";

export type SqlValue = string | number | boolean | Date | Buffer | null;

const databaseUrl = new URL(config.databaseUrl);
if (!["mysql:", "mysql2:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL 必须使用 mysql:// 连接串");
}

const databaseName = databaseUrl.pathname.replace(/^\//, "") || process.env.MYSQL_DATABASE;
const databaseUser = databaseUrl.username ? decodeURIComponent(databaseUrl.username) : process.env.MYSQL_USER;
const databasePassword = databaseUrl.password ? decodeURIComponent(databaseUrl.password) : process.env.MYSQL_PASSWORD;

if (!databaseName) throw new Error("缺少数据库名称，请在 DATABASE_URL 或 MYSQL_DATABASE 中配置");
if (!databaseUser) throw new Error("缺少数据库用户名，请在 DATABASE_URL 或 MYSQL_USER 中配置");
if (!databasePassword) throw new Error("缺少数据库密码，请在 DATABASE_URL 或 MYSQL_PASSWORD 中配置");

export const pool = mysql.createPool({
  host: databaseUrl.hostname,
  port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
  user: databaseUser,
  password: databasePassword,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  charset: "utf8mb4",
});

export async function queryRows<T extends RowDataPacket>(sql: string, params: SqlValue[] = []) {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows;
}

export async function execute(sql: string, params: SqlValue[] = []) {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

async function ensureIndex(tableName: string, indexName: string, sql: string) {
  const rows = await queryRows<RowDataPacket>(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1",
    [tableName, indexName],
  );
  if (rows.length === 0) await execute(sql);
}

export async function initDb() {
  await execute(`
    CREATE TABLE IF NOT EXISTS analysis_tasks (
      id CHAR(36) PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(1024) NOT NULL,
      status ENUM('pending', 'processing', 'success', 'failed') NOT NULL,
      progress INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      error_message TEXT,
      total_records INT NOT NULL DEFAULT 0,
      CHECK (progress >= 0 AND progress <= 100)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS bill_records (
      id CHAR(36) PRIMARY KEY,
      task_id CHAR(36) NOT NULL,
      transaction_time DATETIME(3) NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      direction ENUM('income', 'expense') NOT NULL,
      category VARCHAR(120) NOT NULL,
      merchant VARCHAR(300),
      description VARCHAR(300),
      CONSTRAINT fk_bill_records_task FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await execute(`
    CREATE TABLE IF NOT EXISTS analysis_summaries (
      task_id CHAR(36) PRIMARY KEY,
      total_income DECIMAL(14, 2) NOT NULL,
      total_expense DECIMAL(14, 2) NOT NULL,
      net_amount DECIMAL(14, 2) NOT NULL,
      record_count INT NOT NULL,
      anomaly_count INT NOT NULL,
      category_stats JSON NOT NULL,
      monthly_trend JSON NOT NULL,
      anomalies JSON NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_analysis_summaries_task FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await ensureIndex("bill_records", "idx_bill_records_task_time", "ALTER TABLE bill_records ADD INDEX idx_bill_records_task_time (task_id, transaction_time DESC)");
  await ensureIndex("bill_records", "idx_bill_records_task_category", "ALTER TABLE bill_records ADD INDEX idx_bill_records_task_category (task_id, category)");
}
