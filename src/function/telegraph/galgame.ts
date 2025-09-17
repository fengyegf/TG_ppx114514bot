import { Telegraph, Parser } from "telegraph.js";
import type { dmmGalgameInfo } from "../../types/galgame";
import type { NodeElement } from "telegraph.js/dist/types/node-element";

const telegraph = new Telegraph(
  "f040113c9131f5e1f6bd46c54d9ff8c346f6db45d41d08eafbf1a07a06d0"
);

export async function buildGalgameTelegraphPage(
  galgame: dmmGalgameInfo,
  videoLink: string | null
) {
  // 判断是否为 YouTube 链接
  const isYoutube =
    typeof videoLink === "string" &&
    (videoLink.includes("youtube.com") || videoLink.includes("youtu.be"));

  let videoSection = "";
  if (videoLink) {
    const videoTag = isYoutube
      ? `<iframe src="${videoLink}"></iframe>`
      : `<video src="${videoLink}" controls></video>`;
    videoSection = `# 视频\n${videoTag}`;
  }

  const text =
    `![${galgame.title}](${galgame.coverImage})\n` +
    (videoSection ? `${videoSection}\n` : "") +
    `# 图片\n` +
    galgame.images.map((img, idx) => `![图${idx + 1}](${img})`).join("");

  const content = Parser.parse(text, "markdown");

  // 包裹所有顶层 iframe
  const wrappedContent = wrapIframeWithFigure(
    content as Array<string | NodeElement>
  );
  try {
    // 将可能存在的字符串节点封装为段落节点，确保 content 类型为 NodeElement[]
    const normalizedContent: NodeElement[] = wrappedContent.map((n) =>
      typeof n === "string" ? ({ tag: "p", children: [n] } as NodeElement) : n
    );

    const page = await telegraph.createPage({
      title: galgame.title,
      author_name: "@ppx114514 - Galgame",
      author_url: "https://t.me/ppx114514",
      content: normalizedContent,
      return_content: false,
    });

    return page.url;
  } catch {
    return null;
  }
}

// 包裹所有顶层 iframe
function wrapIframeWithFigure(
  nodes: Array<string | NodeElement>
): Array<string | NodeElement> {
  return nodes.map((node: string | NodeElement) => {
    // 如果是字符串文本节点，直接返回
    if (typeof node === "string") return node;

    // 下面 node 已被缩小为 NodeElement，可以安全访问属性
    if (node.tag === "iframe") {
      return {
        tag: "figure",
        children: [node],
      } as NodeElement;
    }

    if (Array.isArray(node.children)) {
      return {
        // node 已是对象类型，展开并替换 children
        ...(node as NodeElement),
        children: wrapIframeWithFigure(
          node.children as Array<string | NodeElement>
        ),
      } as NodeElement;
    }

    return node;
  });
}
