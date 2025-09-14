import tdl from "tdl";
import { getTdjson } from "prebuilt-tdlib";
import os from "os";
import si from "systeminformation";
import logger from "../log/index.ts";

async function createClient() {
  logger.info("初始化TDLib客户端...");
  const system = await si.system();
  tdl.configure({ tdjson: getTdjson(), verbosityLevel: 1 });
  const client = tdl.createClient({
    apiId: Number(process.env.TG_API_ID),
    apiHash: process.env.TG_API_HASH as string,
    databaseDirectory: "./TDLib/_td_database",
    filesDirectory: "./TDLib/_td_files",
    useTestDc: false,
    tdlibParameters: {
      use_message_database: true,
      use_secret_chats: false,
      use_chat_info_database: true,
      use_file_database: false,
      system_language_code:
        Intl.DateTimeFormat().resolvedOptions().locale || "en",
      application_version: "0.1",
      device_model: system.model || os.type(),
      system_version: undefined,
    },
  });
  return client;
}

// 模块加载时只创建一次
export const clientPromise = createClient();

export async function getClient() {
  return await clientPromise;
}
