import type { Anime, galgameInfo } from "../../types/galgame";

/**
 * 番剧文本格式
 * @param {Object} data - 里番数据对象
 * @returns {string} - 格式化的文本
 */
export function buildHentaiText(data: Anime) {
  const number = generateNumber(data.time );
  const formattedDate = formatDate(data.time );
  const cleanedSeries = cleanTagText(data.series);
  const cleanedPublish = cleanTagText(data.publish);
  return `#${number}里番 [${formattedDate}][${data.publish}]${data.name}
> [番剧名称]：${data.name}
> [番剧别名]：${data.subtitle}
> [字幕翻译]：#${data.sub || "無名"}
> [系列番剧]：#${cleanedSeries}
> [发行品牌]：#${cleanedPublish}
> [发售时间]：${data.time}
> [档案大小]：${data.size || "1080P"}
资源整理 @ppx114514
>>> tags: 
${data.tags.map((tag:string) => `#${tag}`).join(" ")}\n<<<`;
}

export function buildHentaiTextWithLink(data:galgameInfo) {
  // 平台名称映射
  const platformMap = {
    steam: "STEAM(官方国际中文版)",
    fanza: "FANZA(日文原版)",
  };

  // 生成入正地址字符串
  const buyLinks = Array.isArray(data.buy)
    ? data.buy
        .map(
          (item: { name: string; link: string }) =>
            `[${platformMap[(item.name as string).toLowerCase() as keyof typeof platformMap] || item.name}](${item.link})`
        )
        .join(" | ")
    : "";

  // 格式化开发商和发行商，加#并cleanTagText
  const formatTags = (arr:string) =>
    Array.isArray(arr)
      ? arr.map((v) => `#${cleanTagText(v)}`).join(" ")
      : `#${cleanTagText(arr)}`;

  return `#游戏分享 #Galgame ${data.title}\n\n中文名: ${
    data.title
  }\n发售时间: ${data.releaseDate}\n\n类型: #${
    data.gameGenre
  }\n入正地址: ${buyLinks}\n\n开发商: ${formatTags(
    data.developer
  )}\n发行商: ${formatTags(data.publisher)}\n[预览图](${
    data.telegraphUrl
  })\n介绍:\n>> ${data.description}\n\n其他信息:\n>>原画: ${
    data.illustrators.join(" / ") || "未知"
  }\n剧本: ${data.scenario.join(" / ") || "未知"}\n声优: ${
    data.voiceActors.join(" / ") || "未知"
  }\n\n[下载点我](${data.downloadLinks})`;
}
/**
 * 根据发售时间生成编号
 * @param time - 发售时间
 * @returns - 编号
 */
function generateNumber(time:string) {
  const date = new Date(time);
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/**
 * 转换日期格式 2025-01-31 => 250131
 * @param time - 原始日期格式
 * @returns - 转换后的日期格式
 */
function formatDate(time:string) {
  const date = new Date(time);
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 清理标签文本
 * @param text - 原始文本
 * @returns - 清理后的文本
 */
function cleanTagText(text:string) {
  if (!text) return "";
  return text
    .replace(/OVA/gi, "")
    .replace(/THE ANIMATION/gi, "")
    .replace(
      /[^\w\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]|・/g,
      ""
    );
}
