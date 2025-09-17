import { answerCallbackQuery } from "../../TDLib/function/index.ts";
import { editMessageText, sendMessage } from "../../TDLib/function/message.ts";
import { buildGalgameTelegraphPage } from "../../function/telegraph/galgame.ts";
import { buildHentaiTextWithLink } from "../../function/hentai/text.ts";
import axios from "axios";
import type{ message as Td$Message } from "tdlib-types";
import { parseMarkdownToFormattedText } from "../../TDLib/function/parseMarkdown.ts";
import { getClient } from "../../TDLib/index.ts";
import logger from "../../log/index.ts";
import type {
  dmmGalgameInfo,
  galgameInfo,
  searchDmm,
} from "../../types/galgame.ts";

import type { inlineKeyboardButton$Input } from "tdlib-types";
const client = await getClient();

export default async function getGalgame(message: Td$Message) {
  if (message.content._ !== "messageText") {
    return;
  }
  const text = message.content.text.text;
  const args = text.trim().split(/\s+/);
  // args[0] 是 /gethentai

  // 判断是否为详细信息用法
  const link = args[1];

  const isDetailLink =
    link &&
    /https?:\/\/(?:[\w-]+\.)*(dmm\.co\.jp|melonbooks\.co\.jp|dlsite\.com)/i.test(
      link
    );

  if (isDetailLink) {
    // 详细信息构建消息

    return;
  }

  // 关键词搜索用法（第一个参数不是指定站点链接）
  if (args.length >= 2 && link) {
    // 合并所有参数为关键词
    const keyword = args.slice(1).join(" ");
    // 提示消息
    const tipsMsg = await sendMessage(message.chat_id, {
      text: `正在搜索 DMM Galgame ${keyword}，请稍候...`,
    });
    if (!tipsMsg) {
      return;
    }
    const galgame = await parseDmmSearch(keyword, message, tipsMsg);
    if (!galgame) {
      return;
    }
    await editMessageText({
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      text: `已找到 DMM Galgame：\n[${galgame.title}](${galgame.url})\n发售日期：${galgame.releaseDate}\n\n请回复本条消息游戏的视频链接\n使用 /skip 命令跳过 \n使用 /cancel 命令取消`,
    });
    let videoLink = null;
    for await (const update of client.iterUpdates()) {
      if (
        update._ === "updateNewMessage" &&
        update.message.content._ === "messageText" &&
        update.message.reply_to?._ === "messageReplyToMessage" &&
        update.message.chat_id === message.chat_id &&
        update.message.reply_to?.message_id === tipsMsg.id
      ) {
        const text = update.message.content.text.text.trim();
        if (text === "/skip") {
          await client.invoke({
            _: "editMessageText",
            chat_id: tipsMsg.chat_id,
            message_id: tipsMsg.id,
            input_message_content: {
              _: "inputMessageText",
              text: parseMarkdownToFormattedText("已跳过视频链接输入"),
            },
          });
          break;
        }
        if (text === "/cancel") {
          await client.invoke({
            _: "editMessageText",
            chat_id: tipsMsg.chat_id,
            message_id: tipsMsg.id,
            input_message_content: {
              _: "inputMessageText",
              text: parseMarkdownToFormattedText("已取消"),
            },
          });
          return;
        }
        // 处理视频链接
        videoLink = text.trim();
        if (!videoLink) {
          await client.invoke({
            _: "editMessageText",
            chat_id: tipsMsg.chat_id,
            message_id: tipsMsg.id,
            input_message_content: {
              _: "inputMessageText",
              text: parseMarkdownToFormattedText("视频链接不能为空"),
            },
          });
          continue;
        }
        await client.invoke({
          _: "deleteMessages",
          chat_id: update.message.chat_id,
          message_ids: [update.message.id],
          revoke: true,
        });
        break;
      }
    }

    // 构建 Telegraph 页面
    const telegraphUrl = await buildGalgameTelegraphPage(galgame, videoLink);
    if (!telegraphUrl) {
      await client.invoke({
        _: "editMessageText",
        chat_id: tipsMsg.chat_id,
        message_id: tipsMsg.id,
        input_message_content: {
          _: "inputMessageText",
          text: parseMarkdownToFormattedText("Telegraph 页面创建失败,请重试"),
        },
      });
      return;
    }
    await client.invoke({
      _: "editMessageText",
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText(
          `已成功创建 Telegraph 页面：\n${telegraphUrl}`
        ),
      },
    });

    let galgameInfo: galgameInfo = {
      title: galgame.title,
      releaseDate: galgame.releaseDate,
      gameGenre: galgame.gameGenre || undefined,
      buy: undefined,
      developer: undefined,
      publisher: undefined,
      telegraphUrl: telegraphUrl,
      description: undefined,
      illustrators: galgame.illustrators,
      scenario: galgame.scenario,
      voiceActors: galgame.voiceActors,
      downloadLinks: undefined,
    };
    const galgameInfoMeg = await sendMessage(message.chat_id, {
      text: `即将开始创建详细信息消息`,
    });
    if (!galgameInfoMeg) {
      return;
    }
    await collectGalgameInfo(galgameInfo, galgameInfoMeg, message);

    await client.invoke({
      _: "editMessageText",
      chat_id: galgameInfoMeg.chat_id,
      message_id: galgameInfoMeg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText(`已完成创建详细信息参数`),
      },
    });

    const text = buildHentaiTextWithLink(galgameInfo);
    await sendMessage(message.chat_id, {
      text: text,
      media: {
        photo: {
          id: galgame.coverImage,
        },
      },
    });
    return;
  }
}

/*
 * 搜索DMM Galgame
 * @param  keyword - 搜索关键词
 * @returns 返回搜索结果
 */
async function searchDmmGalgame(keyword: string) {
  try {
    const data = await axios.post("http://156.246.91.221:24621/api/search", {
      type: "game",
      keyword: keyword,
    });
    return data.data as searchDmm;
  } catch (error) {
    logger.error("搜索DMM Galgame失败", error);
    return;
  }
}
/**
 * 从 DMM 获取单个游戏的详细信息
 * @param link - DMM 游戏链接
 * @returns 返回游戏信息对象或 null
 */
async function getDmmGalgame(link: string) {
  try {
    const anime = await axios.post("http://156.246.91.221:24621/api/parse", {
      url: link,
    });
    return anime.data as dmmGalgameInfo;
  } catch (error) {
    logger.error("DMM搜索失败:", error);
    return null;
  }
}

async function parseDmmSearch(
  keyword: string,
  message: Td$Message,
  tipsMsg: Td$Message
) {
  const data = await searchDmmGalgame(keyword);
  if (!data) {
    await client.invoke({
      _: "editMessageText",
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText("未找到相关游戏。"),
      },
    });
    return;
  }

  if (!Array.isArray(data.link) || data.link.length === 0) {
    await client.invoke({
      _: "editMessageText",
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText("未找到相关游戏链接。"),
      },
    });
    return;
  }
  let msg = "搜索结果：\n";
  const buttons: inlineKeyboardButton$Input[] = [];
  data.link.forEach((item, idx) => {
    msg += `${idx + 1}: [${item.title}](${item.link})\n`;
    buttons.push({
      _: "inlineKeyboardButton",
      text: `${idx + 1}`,
      type: {
        _: "inlineKeyboardButtonTypeCallback",
        data: Buffer.from(`dmm=${idx}`).toString("base64"),
      },
    });
  });

  // 每5个按钮一行分组
  const buttonRows: Array<Array<inlineKeyboardButton$Input>> = [];
  for (let i = 0; i < buttons.length; i += 5) {
    buttonRows.push(buttons.slice(i, i + 5));
  }

  const meg = await client.invoke({
    _: "editMessageText",
    chat_id: tipsMsg.chat_id,
    message_id: tipsMsg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(msg),
    },
    reply_markup: {
      _: "replyMarkupInlineKeyboard",
      rows: buttonRows,
    },
  });

  let selectedIndex = null;
  // 监听回调查询
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewCallbackQuery" &&
      update.chat_id === message.chat_id &&
      update.payload._ === "callbackQueryPayloadData" &&
      update.message_id === meg.id
    ) {
     
      const callbackData = Buffer.from(
        update.payload.data,
        "base64"
      ).toString();
      
      const match = callbackData.match(/^dmm=(\d+)$/);
      if (match) {
        selectedIndex = parseInt(match[1], 10);
      }
      if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= data.link.length) {
        await sendMessage(message.chat_id, {
          text: "选择无效，请重新选择",
        });
        continue;
      }
      answerCallbackQuery(update.id, {
        text: "已选择第 " + (selectedIndex + 1) + " 个",
        show_alert: false,
        cache_time: 10,
      });
      break;
    }
  }

  if (selectedIndex === null) {
    await client.invoke({
      _: "editMessageText",
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText("未能识别选择内容"),
      },
    });
    return;
  }
  const galgame = await getDmmGalgame(data.link[selectedIndex].link);
  if (!galgame) {
    await client.invoke({
      _: "editMessageText",
      chat_id: tipsMsg.chat_id,
      message_id: tipsMsg.id,
      input_message_content: {
        _: "inputMessageText",
        text: parseMarkdownToFormattedText("获取详细信息失败"),
      },
    });
    return;
  }
  await client.invoke({
    _: "editMessageText",
    chat_id: tipsMsg.chat_id,
    message_id: tipsMsg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `当前 dmm 已成功获取到游戏信息：\n[${galgame.title}](${galgame.url})\n发售日期：${galgame.releaseDate}`
      ),
    },
  });
  return galgame;
}

/**
 * 轮询收集 galgameInfo 信息
 */
async function collectGalgameInfo(
  galgameInfo: galgameInfo,
  galgameInfoMeg: Td$Message,
  message: Td$Message
) {
  // 1. title
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `当前游戏标题为：${galgameInfo.title}\n如需修改请直接回复新标题，回复OK表示无需修改。`
      ),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      let text = update.message.content.text.text.trim();
      if (text.toLowerCase() !== "ok") {
        galgameInfo.title = text;
      }
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 2. gameGenre
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `当前游戏类型为：${
          galgameInfo.gameGenre || "无"
        }\n如需修改请直接回复新类型，回复OK表示无需修改，回复/skip跳过。`
      ),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      let text = update.message.content.text.text.trim();
      if (text.toLowerCase() === "ok") break;
      if (text.toLowerCase() === "/skip") {
        await client.invoke({
          _: "deleteMessages",
          chat_id: update.message.chat_id,
          message_ids: [update.message.id],
          revoke: true,
        });
        break;
      }
      galgameInfo.gameGenre = text;
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 3. buy
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `请发送购买平台链接（可多条，空格分隔），如：\nhttps://store.steampowered.com/app/1144400/_/ https://dlsoft.dmm.co.jp/detail/russ_0206/?i3_ref=search&i3_ord=1`
      ),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      let text = update.message.content.text.text.trim();
      const links = text.split(/\s+/).filter(Boolean);
      galgameInfo.buy = links.map((link) => {
        let name = "other";
        if (/steam/.test(link)) name = "steam";
        else if (/dmm|fanza/.test(link)) name = "fanza";
        return { name, link };
      });
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 4. developer
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `请发送开发商信息，多个用英文逗号分隔，如：ゆずソフト, YUZUSOFT`
      ),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      galgameInfo.developer = update.message.content.text.text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 5. publisher
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(
        `请发送发行商信息，多个用英文逗号分隔，如：HIKARI FIELD, NekoNyan Ltd.`
      ),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      galgameInfo.publisher = update.message.content.text.text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 6. description
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(`请发送游戏介绍信息`),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      galgameInfo.description = update.message.content.text.text.trim();
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }

  // 7. downloadLinks
  await client.invoke({
    _: "editMessageText",
    chat_id: galgameInfoMeg.chat_id,
    message_id: galgameInfoMeg.id,
    input_message_content: {
      _: "inputMessageText",
      text: parseMarkdownToFormattedText(`请发送游戏下载信息或下载链接`),
    },
  });
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.content._ === "messageText" &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to?.message_id === galgameInfoMeg.id
    ) {
      galgameInfo.downloadLinks = update.message.content.text.text.trim();
      await client.invoke({
        _: "deleteMessages",
        chat_id: update.message.chat_id,
        message_ids: [update.message.id],
        revoke: true,
      });
      break;
    }
  }
}
