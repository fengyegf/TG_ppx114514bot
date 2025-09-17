import { BotCommand } from "../cmd/index.ts";
import { formattedDate } from "../TDLib/update/updateNewMessage.ts";
import { messageLog } from "../function/messageLog.ts";
import logger from "../log/index.ts";

import type { updateNewMessage as Td$updateNewMessage } from "tdlib-types";
export default async function updateNewMessage(update: Td$updateNewMessage) {
  // console.log("收到新消息", JSON.stringify(update, null, 2));
  // 检查消息时间戳，只处理10分钟内的消息
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const messageTimestamp = update.message.date;
  const tenMinutesInSeconds = 20 * 60;

  if (currentTimestamp - messageTimestamp > tenMinutesInSeconds) {
    logger.debug(`忽略过期消息，消息时间: ${formattedDate(messageTimestamp)}`);
    return;
  }

  // 打印消息日志
  messageLog(update.message).catch((err: unknown) => {
    logger.error("消息日志打印失败", err);
  });
  // 处理命令
  BotCommand(update.message).catch((err: unknown) => {
    logger.error("处理命令出现错误", err);
  });
}
