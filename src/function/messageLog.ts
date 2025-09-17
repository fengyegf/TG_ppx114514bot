import { getUser, getChat } from "../TDLib/function/get.ts";
import { formattedDate } from "../TDLib/update/updateNewMessage.ts";
import winston from "winston";
import path from "path";
import type { Message as Td$Message } from "tdlib-types";
import { fileURLToPath } from "url";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建专用的消息日志记录器
const messageLogger = winston.createLogger({
  level: "info",
  transports: [
    // 消息日志文件 - 纯文本格式
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/messages.log"),
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(({ timestamp, message }) => {
          return `[${timestamp}] ${message}`;
        })
      ),
    }),
  ],
});

// 创建控制台输出函数（保持原有的彩色格式）
function logToConsole(message: string) {
  // eslint-disable-next-line no-console
  console.log(message);
}

export async function messageLog(message: Td$Message) {
  const chatinfo = await getChat(message.chat_id);
  // 使用局部 any 以避免对 tdlib union 类型的过度缩窄导致的 "never" 错误
  const content: any = (message as any).content;
  const replyTo: any = (message as any).reply_to;
  const forwardInfo: any = (message as any).forward_info;
  const senderId: any = (message as any).sender_id;
  // 获取基本文本内容
  let text = "";
  if (content && content._ === "messageText") {
    text = content.text?.text || "";
  } else if (
    content &&
    (content._ === "messagePhoto" ||
      content._ === "messageVideo" ||
      content._ === "messageDocument" ||
      content._ === "messageAudio")
  ) {
    text = content.caption?.text || "";
  }

  // 将文本中的换行符替换为 \n 字符串
  text = text.replace(/\n/g, "\\n");
  // 准备额外的消息信息
  let extraInfo = "";
  let contentTypeInfo: string = (content && content._) || "";

  // 如果消息包含线程 ID，则在额外信息中显示 thread_id
  const threadId: any = (message as any).message_thread_id;
  if (threadId !== undefined && threadId !== null) {
    extraInfo += `[thread_id:${threadId}]`;
  }

  // 处理回复/引用消息
  if (replyTo) {
    if (replyTo._ === "messageReplyToMessage" && replyTo.quote) {
      // 这是带引用内容的回复

      // 如果有origin表示引用来自特定来源
      if (replyTo.origin) {
        switch (replyTo.origin._) {
          case "messageOriginUser":
            extraInfo += `[quote_from_user:${
              replyTo.origin.sender_user_id || "unknown"
            }]`;
            break;
          case "messageOriginChannel":
            extraInfo += `[quote_from_channel:${
              replyTo.origin.chat_id || "unknown"
            }]`;
            break;
          case "messageOriginChat":
            extraInfo += `[quote_from_chat:${
              (replyTo.origin.sender_chat_id || "unknown") +
              "(" +
              (replyTo.origin.author_signature || "") +
              ")"
            }]`;
            break;
          case "messageOriginHiddenUser":
            extraInfo += `[quote_from_hidden_user:${
              replyTo.origin.sender_name || "unknown"
            }]`;
            break;
        }
      } else {
        extraInfo += `[quote]`;
      }
    } else {
      // 这是普通回复，没有引用内容
      // 如果有origin表示回复来自特定来源
      if (replyTo._ === "messageReplyToMessage" && replyTo.origin) {
        switch (replyTo.origin._) {
          case "messageOriginUser":
            extraInfo += `[reply_to_user:${
              replyTo.origin.sender_user_id || "unknown"
            }]`;
            break;
          case "messageOriginChannel":
            extraInfo += `[reply_to_channel:${
              replyTo.origin.chat_id || "unknown"
            }]`;
            break;
          case "messageOriginChat":
            extraInfo += `[reply_to_chat:${
              replyTo.origin.sender_chat_id || "unknown"
            }]`;
            break;
          case "messageOriginHiddenUser":
            extraInfo += `[reply_to_hidden_user:${
              replyTo.origin.sender_name || "unknown"
            }]`;
            break;
          default:
            extraInfo += `[reply_to:${replyTo.origin._ || "unknown"}]`;
        }
      } else {
        // 没有具体来源信息，只是简单地表示这是一个回复
        extraInfo += `[reply]`;
      }
    }
  }

  // 处理转发消息
  if (forwardInfo && forwardInfo.origin) {
    switch (forwardInfo.origin._) {
      case "messageOriginUser":
        extraInfo += `[forward_from_user:${
          forwardInfo.origin.sender_user_id || "unknown"
        }]`;
        break;
      case "messageOriginChannel":
        extraInfo += `[forward_from_channel:${
          forwardInfo.origin.chat_id || "unknown"
        }]`;
        extraInfo += `[forward_msg_id:${
          forwardInfo.origin.message_id || "unknown"
        }]`;
        break;
      case "messageOriginChat":
        extraInfo += `[forward_from_chat:${
          forwardInfo.origin.sender_chat_id || "unknown"
        }]`;
        break;
      case "messageOriginHiddenUser":
        extraInfo += `[forward_from_hidden_user:${
          forwardInfo.origin.sender_name || "unknown"
        }]`;
        break;
      default:
        extraInfo += `[forward_from:${forwardInfo.origin._ || "unknown"}]`;
    }
  }

  // 处理贴纸消息
  if (content && content._ === "messageSticker") {
    const stickerId = content.sticker?.id || 0;
    const stickersetID = content.sticker?.set_id || 0;
    const stickeRremoteFileID =
      content.sticker?.sticker?.remote?.unique_id || 0;
    extraInfo += `[Id:${stickerId}, set_id:${stickersetID}, file_id:${stickeRremoteFileID}]`;
  }

  // 处理视频和图片消息
  else if (content && content._ === "messagePhoto") {
    const fileId =
      content.photo?.sizes?.[0]?.photo?.remote?.unique_id || "unknown";
    const caption = content.caption?.text || "";
    contentTypeInfo = `[FileID: ${fileId}]${caption}`;
  } else if (content && content._ === "messageVideo") {
    const fileId = content.video?.video?.remote?.unique_id || "unknown";
    const caption = content.caption?.text || "";
    contentTypeInfo = `[FileID: ${fileId}]${caption}`;
  }
  // 输出日志
  if (senderId && senderId._ === "messageSenderUser") {
    const userinfo = await getUser(senderId.user_id);

    // 构建彩色的控制台消息
    const coloredMessage = `\x1b[36m[${formattedDate(
      message.date,
      "Asia/Shanghai"
    )}]\x1b[0m\x1b[33m[${chatinfo.title}(id:${chatinfo.id})]\x1b[0m\x1b[35m[${
      userinfo.first_name + (userinfo.last_name || "")
    }(id:${senderId.user_id})]\x1b[0m\x1b[32m${extraInfo}\x1b[0m\x1b[37m${
      content && content._ === "messageText" ? text : contentTypeInfo
    }\x1b[0m`;

    // 构建纯文本的文件消息
    const plainMessage = `[${chatinfo.title}(id:${chatinfo.id})][${
      userinfo.first_name + (userinfo.last_name || "")
    }(id:${senderId.user_id})]${extraInfo}${
      content && content._ === "messageText" ? text : contentTypeInfo
    }`;

    // 输出到控制台（彩色）和文件（纯文本）
    logToConsole(coloredMessage);
    messageLogger.info(plainMessage);
  } else if (senderId && senderId._ === "messageSenderChat") {
    const userinfo = await getChat(senderId.chat_id);

    // 构建彩色的控制台消息
    const coloredMessage = `\x1b[36m[${formattedDate(
      message.date,
      "Asia/Shanghai"
    )}]\x1b[0m\x1b[33m[${chatinfo.title}(id:${chatinfo.id})]\x1b[0m\x1b[35m[${
      userinfo.title || "未知频道"
    }(id:${senderId.chat_id})]\x1b[0m\x1b[32m${extraInfo}\x1b[0m\x1b[37m${
      content && content._ === "messageText" ? text : contentTypeInfo
    }\x1b[0m`;

    // 构建纯文本的文件消息
    const plainMessage = `[${chatinfo.title}(id:${chatinfo.id})][${
      userinfo.title || "未知频道"
    }(id:${senderId.chat_id})]${extraInfo}${
      content && content._ === "messageText" ? text : contentTypeInfo
    }`;

    // 输出到控制台（彩色）和文件（纯文本）
    logToConsole(coloredMessage);
    messageLogger.info(plainMessage);
  }
}
