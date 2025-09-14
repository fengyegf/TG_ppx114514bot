import type { Update as Td$Update } from "tdlib-types";
import updateOption from "./updateOption.ts";
import updateAuthorizationState from "./updateAuthorizationState.ts";

export async function handleUpdate(update: Td$Update) {
  switch (update._) {
    // 处理不同类型的更新
    case "updateOption":
      // 处理TDLib的选项更新
      await updateOption(update);
      break;
    case "updateAuthorizationState":
      // 处理授权状态更新
      await updateAuthorizationState(update);
      break;
    case "updateNewMessage":
      // 处理新消息更新
      break;
    default:
      break;
  }
}
