import type { formattedText$Input, textEntity$Input } from "tdlib-types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, Content } from "mdast";
import logger from "../../log/index.ts";

interface ParseContext {
  plainText: string;
  entities: textEntity$Input[];
}

/**
 * 将 Markdown 格式的文本解析为格式化文本
 * @param markdown - Markdown 格式的文本
 * @returns 包含格式化文本和实体信息的对象
 */
export function parseMarkdownToFormattedText(
  markdown: string
): formattedText$Input {
  try {
    // 解析 Markdown 为 AST
    const processor = unified().use(remarkParse);
    const ast = processor.parse(markdown) as Root;

    const context: ParseContext = {
      plainText: "",
      entities: [],
    };

    // 遍历 AST 节点并构建格式化文本
    processNodes(ast.children, context);

    return {
      _: "formattedText" as const,
      text: context.plainText,
      entities: context.entities,
    };
  } catch (error) {
    logger.error("解析 Markdown 失败:", error);
    return {
      _: "formattedText" as const,
      text: markdown,
      entities: [],
    };
  }
}

/**
 * 处理 AST 节点数组
 */
function processNodes(nodes: Content[], context: ParseContext): void {
  for (const node of nodes) {
    processNode(node, context);
  }
}

/**
 * 处理单个 AST 节点
 */
function processNode(node: Content, context: ParseContext): void {
  switch (node.type) {
    case "heading":
      processHeading(node, context);
      break;
    case "blockquote":
      processBlockquote(node, context);
      break;
    case "paragraph":
      processParagraph(node, context);
      break;
    case "text":
      processText(node, context);
      break;
    case "link":
      processLink(node, context);
      break;
    case "strong":
      processStrong(node, context);
      break;
    case "emphasis":
      processEmphasis(node, context);
      break;
    case "code":
      processCode(node, context);
      break;
    case "inlineCode":
      processInlineCode(node, context);
      break;
    case "list":
      processList(node, context);
      break;
    case "thematicBreak":
      processThematicBreak(node, context);
      break;
    default:
      // 对于未处理的节点类型，递归处理子节点
      if ("children" in node && Array.isArray(node.children)) {
        processNodes(node.children as Content[], context);
      }
      break;
  }
}

/**
 * 处理标题节点
 */
function processHeading(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  // 处理标题内容
  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  // 添加标题实体
  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeBold",
    },
  });

  context.plainText += "\n";
}

/**
 * 处理引用块节点
 */
function processBlockquote(node: any, context: ParseContext, depth = 1): void {
  const startOffset = context.plainText.length;

  // 收集引用内容
  const tempContext: ParseContext = {
    plainText: "",
    entities: [],
  };

  if (node.children) {
    for (const child of node.children) {
      if (child.type === "blockquote") {
        // 递归处理嵌套引用
        processBlockquote(child, tempContext, depth + 1);
      } else {
        processNode(child, tempContext);
      }
    }
  }

  context.plainText += tempContext.plainText;
  const endOffset = context.plainText.length;

  // 复制子实体，调整偏移量
  for (const entity of tempContext.entities) {
    context.entities.push({
      ...entity,
      offset: (entity.offset || 0) + startOffset,
    });
  }

  // 只有最外层的 blockquote 才添加实体
  if (depth === 1) {
    // 检查子节点中是否有嵌套的 blockquote 来判断是否可折叠
    const isExpandable = node.children.some(
      (child: any) => child.type === "blockquote"
    );
    context.entities.push({
      _: "textEntity",
      offset: startOffset,
      length: endOffset - startOffset,
      type: isExpandable
        ? { _: "textEntityTypeExpandableBlockQuote" }
        : { _: "textEntityTypeBlockQuote" },
    });
  }
}

/**
 * 处理段落节点
 */
function processParagraph(node: any, context: ParseContext): void {
  if (node.children) {
    processNodes(node.children, context);
  }
  context.plainText += "\n";
}

/**
 * 处理文本节点
 */
function processText(node: any, context: ParseContext): void {
  context.plainText += node.value;
}

/**
 * 处理链接节点
 */
function processLink(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  // 提取链接文本
  const linkText = extractTextFromNodes(node.children);
  context.plainText += linkText;

  const endOffset = context.plainText.length;

  // 添加链接实体
  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeTextUrl",
      url: node.url,
    },
  });
}

/**
 * 处理粗体节点
 */
function processStrong(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeBold",
    },
  });
}

/**
 * 处理斜体节点
 */
function processEmphasis(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeItalic",
    },
  });
}

/**
 * 处理代码块节点
 */
function processCode(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;
  const codeText = `\n\`\`\`\n${node.value}\n\`\`\`\n`;
  context.plainText += codeText;
  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeCode",
    },
  });
}

/**
 * 处理行内代码节点
 */
function processInlineCode(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;
  context.plainText += node.value;
  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeCode",
    },
  });
}

/**
 * 处理列表节点
 */
function processList(node: any, context: ParseContext): void {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i];
      if (item.type === "listItem") {
        processListItem(item, context, node.ordered ? `${i + 1}. ` : "* ");
      }
    }
  }
  context.plainText += "\n";
}

/**
 * 处理列表项节点
 */
function processListItem(
  node: any,
  context: ParseContext,
  prefix: string
): void {
  context.plainText += prefix;
  if (node.children) {
    processNodes(node.children, context);
  }
  context.plainText += "\n";
}

/**
 * 处理分割线节点
 */
function processThematicBreak(node: any, context: ParseContext): void {
  context.plainText += "---";
  context.plainText += "\n";
}

/**
 * 从节点数组中提取纯文本
 */
function extractTextFromNodes(nodes: Content[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.type === "text") {
      text += node.value;
    } else if ("children" in node && Array.isArray(node.children)) {
      text += extractTextFromNodes(node.children as Content[]);
    }
  }
  return text;
}
