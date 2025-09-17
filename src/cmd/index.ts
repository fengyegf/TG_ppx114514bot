import type { message as Td$Message } from "tdlib-types";
import { getMe } from "../TDLib/function/get.ts";
import logger from "../log/index.ts";
import getGalgame from "./galgame/getgalgame.ts";
import downloadGalgames from "./galgame/dow.ts";
/**
 * 处理命令
 * @param message
 */
export async function BotCommand(message: Td$Message) {
  if (
    message.content._ !== "messageText" ||
    !message.content?.text?.entities?.some(
      (entity) => entity.type._ === "textEntityTypeBotCommand"
    )
  ) {
    return;
  }
  if (
    !message ||
    !message.content ||
    !message.content.text ||
    !message.content.text.text
  ) {
    return;
  }
  const commandParts = message.content.text.text.split(" ");
  const command = commandParts[0];

  const botme = await getMe();

  const botUsername = botme?.usernames?.active_usernames?.[0] || null;

  // 检查命令是否应该被处理
  const shouldProcessCommand = () => {
    // 如果命令中包含@
    if (command.includes("@")) {
      const username = command.split("@")[1];
      // 只有当@后面是机器人自己的用户名时才处理
      return username === botUsername;
    }
    // 如果命令中不包含@，则处理
    return true;
  };

  if (message.content.text.text.startsWith("/") && shouldProcessCommand()) {
    try {
      // 提取基本命令（移除可能的@username部分）
      const baseCommand = command.split("@")[0];

      switch (baseCommand) {
        case "/start":
          // await start(message);
          break;
        case "/gethentai":
          //   await getHentai(message);
          break;
        case "/getgalgame":
          await getGalgame(message);
          break;
        case "/gethentaipre":
          //   await getHentaiPreview(message);
          break;
        case "/download":
          await downloadGalgames(message);
          break;
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
