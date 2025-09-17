import type { message as Td$Message } from "tdlib-types";
import {
  deleteMessage,
  editMessageText,
  sendMessage,
} from "../../TDLib/function/message.ts";
import { getClient } from "../../TDLib/index.ts";

import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";
import logger from "../../log/index.ts";
import { exec } from "child_process";

const client = await getClient();

export default async function downloadGalgames(message: Td$Message) {
  if (message.content._ !== "messageText") {
    return;
  }
  const tipsMessage = await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: "请回复此消息，并提供链接下载\n- 直接回复下载链接\n- 支持多个链接，逐条回复即可\n- 回复 'OK' 结束输入",
  });

  if (!tipsMessage) {
    throw new Error("发送提示消息失败");
  }

  let downloadPaths: string[] = [];
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to.message_id === tipsMessage.id &&
      update.message.content._ === "messageText"
    ) {
      deleteMessage(update.message.chat_id, update.message.id).catch(() => {});
      const replyText = update.message.content.text.text.trim();
      if (replyText === "OK") {
        break;
      }
      // 如果不是以 http:// 或 https:// 开头，则提示无效链接
      if (
        !replyText.startsWith("http://") &&
        !replyText.startsWith("https://")
      ) {
        editMessageText({
          chat_id: tipsMessage.chat_id,
          message_id: tipsMessage.id,
          text: "请提供有效的下载链接",
        }).catch(() => {});
        continue;
      }
      downloadFile(replyText, message)
        .catch((err) => {
          logger.error("下载文件时出错:", err);
        })
        .then((path) => {
          if (path) {
            downloadPaths.push(path);
          }
        });
      continue;
    }
  }

  if (downloadPaths.length === 0) {
    editMessageText({
      chat_id: tipsMessage.chat_id,
      message_id: tipsMessage.id,
      text: "未下载任何文件",
    });
  }

  // 选择第一个压缩包文件：
  // - 如果只有一个下载文件，则直接使用
  // - 否则在文件列表中查找常见压缩或分卷后缀（.zip .rar .7z .001 .part1.rar .r00 等）
  // - 找不到则通知用户并抛出错误
  const archivePath = (() => {
    if (downloadPaths.length === 1) return downloadPaths[0];

    const patterns = [
      /\.(zip|rar|7z|7zip|tar|gz|bz2)$/i, // 常见压缩格式
      /\.part\d+\.rar$/i, // .part1.rar / .part01.rar
      /\.r\d{2,}$/i, // .r00 .r01 .r02 ...
      /\.0*1$/i, // .001 .0001 等首部分卷（简单匹配）
    ];

    for (const p of downloadPaths) {
      const base = path.basename(p).toLowerCase();
      if (patterns.some((re) => re.test(base))) return p;
    }
    return null;
  })();

  if (!archivePath) {
    await editMessageText({
      chat_id: tipsMessage.chat_id,
      message_id: tipsMessage.id,
      text: "未在已下载文件中找到压缩包（例如 .zip/.rar/.7z/.001/.part1.rar 等）。请只下载一个压缩包或确保文件名包含分卷/压缩后缀后重试。",
    }).catch(() => {});
    throw new Error("未找到压缩包文件");
  }
  editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `即将解压文件${archivePath}，请稍等`,
  });

  const zipPath = await unzipFile(archivePath, tipsMessage);

  logger.info("解压完成，路径：", zipPath);
  const tree = getFolderTree(zipPath, 3);

  // 构建编号映射（例如 1 / 1.1 / 1.1.1 -> 对应文件系统路径）
  const indexToPath = new Map<string, string>();
  // buildNumberedLines 已移除，使用下面的 walkAndMap 构建 index->path 映射

  // 实际构建 index -> path 映射（使用递归并跟踪路径）
  indexToPath.clear();
  function walkAndMap(
    nodes: FileNode[],
    parentFsPath: string,
    prefix = ""
  ): string[] {
    const lines: string[] = [];
    nodes.forEach((n, i) => {
      const idx = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      const fsPath = path.join(parentFsPath, n.name);
      indexToPath.set(idx, fsPath);
      const label = n.type === "directory" ? `${n.name}/` : n.name;
      lines.push(`${idx}  ${label}`);
      if (n.type === "directory" && n.children) {
        const childLines = walkAndMap(n.children, fsPath, idx);
        childLines.forEach((l) => lines.push("  " + l));
      }
    });
    return lines;
  }

  let numberedLines = walkAndMap(tree, zipPath);
  const selected = new Set<string>();

  const formatMessage = (lines: string[], sel: Set<string>) => {
    const display = lines
      .map((ln) => {
        const m = ln.trim().match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
        if (!m) return ln;
        const idx = m[1];
        const label = m[2];
        const mark = sel.has(idx) ? " x" : "";
        return `${idx} ${mark}  ${label}`;
      })
      .join("\n");

    return (
      `解压完成，文件结构（仅显示前3层）：\n\n` +
      "编号说明：使用层级编号选择要删除的项（例如：1 1.2 2.3），回复 OK 确认删除，回复 CANCEL 取消。\n\n" +
      "```\n" +
      display +
      "\n```"
    );
  };

  // 发送初始结构（编辑原提示消息）
  await editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: formatMessage(numberedLines, selected),
  }).catch(() => {});

  // 交互式接收用户选择并更新消息，直到收到 OK 或 CANCEL
  try {
    for await (const update of client.iterUpdates()) {
      if (
        update._ === "updateNewMessage" &&
        update.message.chat_id === tipsMessage.chat_id &&
        update.message.reply_to?._ === "messageReplyToMessage" &&
        update.message.reply_to.message_id === tipsMessage.id &&
        update.message.content._ === "messageText"
      ) {
        const txt = update.message.content.text.text.trim();
        // 删除用户原始输入保持整洁
        deleteMessage(update.message.chat_id, update.message.id).catch(
          () => {}
        );

        if (txt.toUpperCase() === "CANCEL") {
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text: "已取消删除操作。",
          }).catch(() => {});
          break;
        }

        if (txt.toUpperCase() === "OK") {
          // 收集要删除的路径
          const toDelete = Array.from(selected)
            .map((idx) => indexToPath.get(idx))
            .filter(Boolean) as string[];

          // 如果没有选择任何项目，直接跳过删除并进入输入压缩包名称的下一步
          if (toDelete.length === 0) {
            await editMessageText({
              chat_id: tipsMessage.chat_id,
              message_id: tipsMessage.id,
              text:
                `未选择任何文件，已跳过删除步骤。\n\n` +
                `即将开始打包文件，请回复该消息提供压缩包名称（不含扩展名）`,
            }).catch(() => {});
            break;
          }

          // 执行删除
          for (const p of toDelete) {
            try {
              const stat = fs.existsSync(p) && fs.statSync(p);
              if (stat && stat.isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
              } else {
                fs.unlinkSync(p);
              }
            } catch (err) {
              logger.warn("删除文件/目录失败:", p, err);
            }
          }

          // 更新结构并通知完成
          const newTree = getFolderTree(zipPath, 3);
          indexToPath.clear();
          numberedLines = walkAndMap(newTree, zipPath);
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text:
              `已删除 ${toDelete.length} 项，最新结构：\n\n` +
              "\n" +
              numberedLines.join("\n") +
              "\n\n 即将开始打包文件，请回复该消息提供压缩包名称（不含扩展名）",
          }).catch(() => {});
          break;
        }

        // 解析选择编号（可多个，用空格或逗号分隔），切换选中状态
        const parts = txt
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        let changed = false;
        for (const p of parts) {
          if (!/^\d+(?:\.\d+){0,2}$/.test(p)) continue;
          if (!indexToPath.has(p)) continue;
          if (selected.has(p)) {
            selected.delete(p);
            changed = true;
          } else {
            selected.add(p);
            changed = true;
          }
        }

        if (changed) {
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text: formatMessage(numberedLines, selected),
          }).catch(() => {});
        } else {
          // 无效输入时提示一次（不频繁）
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text:
              formatMessage(numberedLines, selected) +
              "\n\n提示：请回复要切换选择的编号（如 1.1 2），或回复 OK 确认删除，回复 CANCEL 取消。",
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.warn("交互删除过程中出错：", err);
  }

  editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `请回复此消息：\n- 直接回复新的压缩包名称（不含后缀）`,
  });
  let zipName = "galgame";
  for await (const update of client.iterUpdates()) {
    if (
      update._ === "updateNewMessage" &&
      update.message.chat_id === message.chat_id &&
      update.message.reply_to?._ === "messageReplyToMessage" &&
      update.message.reply_to.message_id === tipsMessage.id &&
      update.message.content._ === "messageText"
    ) {
      deleteMessage(update.message.chat_id, update.message.id).catch(() => {});
      const replyText = update.message.content.text.text.trim();
      if (replyText) {
        zipName = replyText;
      }
      break;
    }
  }
  editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `正在打包文件，请稍等...`,
  });
  // 开始打包文件
  const result = await zipFolder(zipPath, zipName, 1900);

  editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `打包完成，正在上传${result.zipPaths.length}个文件...`,
  });

  if (result.zipPaths.length === 0) {
    await editMessageText({
      chat_id: tipsMessage.chat_id,
      message_id: tipsMessage.id,
      text: "打包失败，请重试。",
    }).catch(() => {});
  }
  for (const p of result.zipPaths) {
    await sendMessage(message.chat_id, {
      media: {
        file: {
          path: p,
        },
      },
    });
    fs.unlinkSync(p);
  }
  sendMessage(message.chat_id, {
    text: `打包完成，共 ${result.zipPaths.length} 个文件，SHA256: ${result.sha256}`,
  });
  // 删除解压目录
  fs.rmSync(zipPath, { recursive: true, force: true });
  // 下载的压缩包也删除
  for (const p of downloadPaths) {
    fs.unlinkSync(p);
  }
  return;
}

/**
 * 下载文件，下载后返回文件路径
 * @param url - 下载链接
 * @param message - 原始消息
 * @returns
 */
async function downloadFile(url: string, message: Td$Message) {
  const tipsMessage = await sendMessage(message.chat_id, {
    reply_to_message_id: message.id,
    text: `开始下载文件: ${url}`,
  });

  if (!tipsMessage) {
    throw new Error("发送提示消息失败");
  }
  try {
    // 运行目录下 cache
    const cacheDir = path.join(process.cwd(), "cache");
    fs.mkdirSync(cacheDir, { recursive: true });

    // 从响应头或 URL 推断文件名（避免使用未定义的 fileName）
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status} ${res.statusText}`);

    // 尝试从 Content-Disposition 中获取文件名
    let inferredName: string | null = null;
    const cd = res.headers.get("content-disposition");
    if (cd) {
      const m = cd.match(/filename\*?=['"]?(?:UTF-8'')?([^;'"\n]+)/i);
      if (m && m[1]) {
        try {
          inferredName = decodeURIComponent(m[1]);
        } catch {
          inferredName = m[1];
        }
      }
    }
    if (!inferredName) {
      // 使用 URL 的 pathname，避免 query 部分被当作文件名
      try {
        const urlObj = new URL(url);
        inferredName = urlObj.pathname.split("/").pop() || "downloaded.file";
      } catch {
        const urlParts = url.split("/");
        inferredName = urlParts.pop() || "downloaded.file";
      }
    }

    // 使用 sanitizeFilename 清理最终文件名
    const actualFileName = sanitizeFilename(inferredName);
    const filePath = path.join(cacheDir, actualFileName);

    // 总大小
    const total = Number(res.headers.get("content-length") || 0);
    let downloaded = 0;

    // 创建写入流并在 finish/error 时可 await
    const fileStream = fs.createWriteStream(filePath);
    const streamFinished = new Promise<void>((resolve, reject) => {
      fileStream.on("finish", () => resolve());
      fileStream.on("error", (err) => reject(err));
    });

    // 读取流数据
    const reader = res.body?.getReader();
    if (!reader) {
      // 关闭文件流并等待完成/错误
      fileStream.end();
      await streamFinished.catch(() => {});
      throw new Error("响应体不可读");
    }

    // 上一次发送给用户的文本，避免重复编辑相同内容
    let lastText: string | null = null;
    // 上次 editMessageText 的时间戳（毫秒）
    let lastEditAt = 0;
    // 最多每隔多少毫秒发送一次（5秒）
    const EDIT_INTERVAL = 5_000;
    // 挂起的文本（在节流期间更新，但不立即发送）
    let pendingText: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(value);
        downloaded += value.length;

        if (total) {
          const percent = ((downloaded / total) * 100).toFixed(2);
          pendingText = `文件：${actualFileName} 下载进度: ${percent}%`;
        } else {
          pendingText = `已下载 ${downloaded} bytes`;
        }

        // 如果文本与上次相同，跳过
        if (pendingText === lastText) {
          continue;
        }

        const now = Date.now();
        // 如果距离上次编辑已超过间隔，则立即发送
        if (now - lastEditAt >= EDIT_INTERVAL) {
          try {
            await editMessageText({
              chat_id: tipsMessage.chat_id,
              message_id: tipsMessage.id,
              text: pendingText,
            });
            lastText = pendingText;
            lastEditAt = Date.now();
            pendingText = null;
          } catch (err) {
            logger.warn("更新进度消息失败：", err);
          }
        }
        // 否则在下一次循环或者完成时会再次检查并发送
      }
    }

    // 循环结束后，如果还有挂起的文本且与已发送文本不同，尝试发送一次以刷新最终状态
    if (pendingText && pendingText !== lastText) {
      try {
        await editMessageText({
          chat_id: tipsMessage.chat_id,
          message_id: tipsMessage.id,
          text: pendingText,
        });
      } catch (err) {
        logger.warn("发送最终进度消息失败：", err);
      }
    }

    // 关闭文件流并等待写入完成或错误
    fileStream.end();
    await streamFinished;

    await editMessageText({
      chat_id: tipsMessage.chat_id,
      message_id: tipsMessage.id,
      text: `✅文件：${actualFileName}, 下载完成: ${filePath}`,
    });
    return filePath;
  } catch (error) {
    // 在错误时尝试通知并记录日志
    logger.error("下载文件时出错:", error);
    try {
      await editMessageText({
        chat_id: tipsMessage.chat_id,
        message_id: tipsMessage.id,
        text: `❌下载失败: ${(error as Error).message || error}`,
      });
    } catch {}
    // 尝试取消 reader（若存在）
    try {
      // @ts-ignore
      if (typeof (error as any).reader?.cancel === "function") {
        // @ts-ignore
        await (error as any).reader.cancel();
      }
    } catch {}
  }
}

/**
 * 清理文件名
 * @param name - 原始文件名
 * @returns - 清理后的文件名
 */
function sanitizeFilename(name: string) {
  try {
    name = decodeURIComponent(name);
  } catch {}
  // 去掉查询串
  name = name.split("?")[0];
  // 取 basename
  name = path.basename(name);
  // 去掉可能的引号
  name = name.replace(/^"(.*)"$/, "$1");
  // 替换 Windows/文件系统非法字符
  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  if (!name) name = "file";
  return name;
}

/**
 * 解压压缩包到运行目录下的 cache/Output 文件夹
 * @param archivePath 压缩包路径
 * @returns 返回解压后的目录路径
 */
async function unzipFile(
  archivePath: string,
  tipsMessage: Td$Message
): Promise<string> {
  await editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `开始解压文件: ${archivePath}`,
  });
  // 构建目标目录
  const outputDir = path.join(process.cwd(), "cache", "Output");
  fs.mkdirSync(outputDir, { recursive: true });

  // helper: 执行 7z 解压（可选密码）并返回 stdout/stderr
  function run7z(password?: string) {
    const pwdArg = password ? `-p"${password}"` : "";
    const cmd = `7z x "${archivePath}" -o"${outputDir}" -y ${pwdArg}`.trim();
    return new Promise<{ error: any; stdout: string; stderr: string }>(
      (res) => {
        exec(cmd, (error, stdout, stderr) => {
          res({ error, stdout: stdout || "", stderr: stderr || "" });
        });
      }
    );
  }

  // 首次尝试（不带密码）
  const first = await run7z();
  // 如果成功，直接返回
  if (!first.error) {
    logger.info(`✅ 解压完成: ${outputDir}`);
    return outputDir;
  }

  // 检查 stderr/stdout 是否包含密码提示相关信息
  const combined = `${first.stdout}\n${first.stderr}`.toLowerCase();
  const needsPassword =
    /encrypted|password|wrong password|need password|incorrect password/.test(
      combined
    );

  if (!needsPassword) {
    logger.error("解压出错：", first.stderr || first.stdout);
    throw first.error || new Error("解压失败");
  }

  // 需要密码：提示用户输入密码
  await editMessageText({
    chat_id: tipsMessage.chat_id,
    message_id: tipsMessage.id,
    text: `该压缩包需要密码才能解压。请回复此消息并发送密码，回复 'CANCEL' 取消。`,
  });

  try {
    for await (const update of client.iterUpdates()) {
      if (
        update._ === "updateNewMessage" &&
        update.message.chat_id === tipsMessage.chat_id &&
        update.message.reply_to?._ === "messageReplyToMessage" &&
        update.message.reply_to.message_id === tipsMessage.id &&
        update.message.content._ === "messageText"
      ) {
        const pwd = update.message.content.text.text.trim();
        // 删除用户原始输入以保持整洁
        deleteMessage(update.message.chat_id, update.message.id).catch(
          () => {}
        );

        if (pwd.toUpperCase() === "CANCEL") {
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text: `已取消解压操作`,
          }).catch(() => {});
          throw new Error("用户取消输入密码");
        }

        // 使用用户提供的密码重试一次
        await editMessageText({
          chat_id: tipsMessage.chat_id,
          message_id: tipsMessage.id,
          text: `正在尝试使用提供的密码解压...`,
        });

        const attempt = await run7z(pwd);
        if (!attempt.error) {
          await editMessageText({
            chat_id: tipsMessage.chat_id,
            message_id: tipsMessage.id,
            text: `✅ 解压完成: ${outputDir}`,
          });
          logger.info(`✅ 解压完成（带密码）: ${outputDir}`);
          return outputDir;
        }

        // 如果依然失败，提示用户并继续等待下一次回复
        await editMessageText({
          chat_id: tipsMessage.chat_id,
          message_id: tipsMessage.id,
          text: `解压失败：密码可能错误。请重新输入密码或回复 'CANCEL' 取消。`,
        });
        continue;
      }
    }
  } finally {
    // nothing
  }

  throw new Error("解压失败：未获取有效密码");
}

/**
 * 获取指定路径下 3 层的文件夹/文件结构
 * @param rootPath 起始路径（string 或 URL）
 * @param depth 最大深度（默认 3 层）
 * @param currentDepth 当前递归深度（内部使用）
 */
export function getFolderTree(
  rootPath: string | URL,
  depth: number = 3,
  currentDepth: number = 1
): FileNode[] {
  // 兼容 URL 类型路径
  const actualPath: string =
    typeof rootPath === "string" ? rootPath : fileURLToPath(rootPath);

  const entries = fs.readdirSync(actualPath, { withFileTypes: true });

  return entries.map((entry) => {
    const fullPath = path.join(actualPath, entry.name);

    if (entry.isDirectory()) {
      const node: FileNode = {
        name: entry.name,
        type: "directory",
      };
      if (currentDepth < depth) {
        node.children = getFolderTree(fullPath, depth, currentDepth + 1);
      }
      return node;
    } else {
      return {
        name: entry.name,
        type: "file",
      };
    }
  });
}

/**
 * 获取文件夹大小（字节）
 */
function getFolderSize(folderPath: string): number {
  if (!fs.existsSync(folderPath)) return 0;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    try {
      if (entry.isDirectory()) {
        total += getFolderSize(fullPath);
      } else {
        const st = fs.statSync(fullPath);
        total += st.size;
      }
    } catch (err) {
      logger.warn("计算文件/目录大小时出错，已跳过：", fullPath, err);
    }
  }
  return total;
}

/**
 * 将文件夹打包成 zip，支持分卷压缩，返回压缩文件路径和 SHA256
 * @param folderPath 要压缩的文件夹
 * @param zipName 压缩包名称（不含扩展名）
 * @param maxSize 分卷阈值，单位字节（超过该大小就分卷）
 */
export async function zipFolder(
  folderPath: string,
  zipName: string,
  maxSizeMB: number
): Promise<ZipResult> {
  const cacheDir = path.join(process.cwd(), "cache");
  const outputDir = path.join(cacheDir, "ZipOutput");
  fs.mkdirSync(outputDir, { recursive: true });

  const zipBasePath = path.join(outputDir, zipName);

  const folderSize = getFolderSize(folderPath); // 字节
  const folderSizeMB = folderSize / 1024 / 1024; // 转为 MB

  // 压缩级别设置为存储（无压缩）：-mx=0
  // 构建 7z 命令
  let command: string;
  if (folderSizeMB > maxSizeMB) {
    command = `7z a "${zipBasePath}.zip" "${folderPath}" -v${maxSizeMB}m -mx=0 -y`;
  } else {
    command = `7z a "${zipBasePath}.zip" "${folderPath}" -mx=0 -y`;
  }

  await new Promise<void>((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        logger.error(stderr);
        reject(err);
        return;
      }
      logger.info(stdout);
      resolve();
    });
  });

  // 获取 SHA256
  const sha256 = await new Promise<string>((resolve, reject) => {
    exec(`7z h -scrcSHA256 "${zipBasePath}.zip"`, (err, stdout, stderr) => {
      if (err) {
        logger.error(stderr);
        reject(err);
        return;
      }
      // 输出格式一般是：Hash = XXXXX
      const match = stdout.match(/([A-Fa-f0-9]{64})/);
      if (match) resolve(match[1]);
      else reject(new Error("SHA256 解析失败"));
    });
  });

  // 获取所有分卷路径（如果有）
  const zipPaths: string[] = [];
  const files = fs.readdirSync(outputDir);
  const base = path.basename(zipBasePath);
  for (const f of files) {
    // 接受以 zipName 为前缀的所有文件（包含 .zip 以及常见分卷后缀）
    if (!f.startsWith(base)) continue;
    zipPaths.push(path.join(outputDir, f));
  }
  // 按文件名排序，保证分卷顺序
  zipPaths.sort();

  return { zipPaths, sha256 };
}

interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[]; // 仅当 type=directory 时有
}
interface ZipResult {
  zipPaths: string[]; // 压缩后的文件路径（分卷可能有多个）
  sha256: string; // 压缩包 SHA256（仅第一个分卷）
}
