import type {
  updateOption as Td$updateOption,
  optionValueString as Td$optionValueString,
} from "tdlib-types";
import logger from "../../log/index.ts";

/**
 * 处理选项更新
 * @param {object} update - TDLib更新对象
 */
export default async function updateOption(update: Td$updateOption) {
  // console.log("收到选项更新", JSON.stringify(update, null, 2));
  // 检查消息时间戳，只处理10分钟内的消息
  const name = update.name;
  const value = update.value as Td$optionValueString;

  switch (name) {
    case "version":
      logger.info(`TDLib版本: ${value.value}`);
      break;
    case "commit_hash":
      logger.info(`TDLib当前版本hash: ${value.value}`);
      break;
  }
}
