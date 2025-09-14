// file-loader.mjs
import { pathToFileURL, fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  // 如果模块以 ?file 结尾，就处理成 file URL（相对路径基于 parentURL）
  if (specifier.endsWith("?file")) {
    const raw = specifier.replace(/\?file$/, "");
    const parent = context.parentURL || import.meta.url;

    // 如果是 Windows 绝对路径（如 C:\...）或以 / 开头的绝对路径，直接用 pathToFileURL
    let resolvedHref;
    if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("/")) {
      resolvedHref = pathToFileURL(raw).href;
    } else {
      // 基于导入者模块解析相对路径
      resolvedHref = new URL(raw, parent).href;
    }

    // 保留 ?file 查询部分，便于 load 阶段识别
    return {
      url: resolvedHref + "?file",
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith("?file")) {
    // 去掉 ?file，再把 file:// URL 转为文件系统路径
    const urlWithoutQuery = url.replace(/\?file$/, "");
    const filePath = fileURLToPath(urlWithoutQuery);
    // 这里不需要读取内容，如果需要可以读取 buffer：
    // const content = fs.readFileSync(filePath);
    // 导出文件系统路径字符串
    return {
      format: "module",
      source: `export default ${JSON.stringify(filePath)};`,
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
