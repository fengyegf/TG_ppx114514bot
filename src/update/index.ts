import type { Update as Td$Update } from "tdlib-types";
import updateNewMessage from "./updateNewMessage.ts";
export async function handleUpdate(update: Td$Update) {
    switch (update._) {
        // 处理不同类型的更新
    case "updateNewMessage":
        updateNewMessage(update);
    break;
    }
}