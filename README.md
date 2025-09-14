# TDLib 预包装模板（打包后可单独运行）

> 这是一个预先封装了 TDLib 的 Node.js 模板，打包后可以复制到其他服务器并单独运行。
> 基于 `tdl` 与 预构建 TDLib `prebuilt-tdlib`

## 简介

该项目将 TDLib 的常用操作进行了预包装，方便在 Node.js 环境中快速构建自己的 Telegram 人形机器人或TG机器人应用。你可以直接使用`src/TDLib/function`中导出的功能，也可以作为基础将其集成到更大的应用中。

`src/TDLib`包含：
- 预包装的 TDLib 方法让其更加方便的调用（如消息发送）。
- 辅助的工具函数（例如解析 Markdown 转换为TDLib的entities）。

## 快速开始（打包后在其他服务器上运行）

1. 将打包好的目录复制到目标服务器。
2. 在目标服务器上进入项目目录并安装运行时依赖：

```powershell
pnpm i
```

3. 可用的运行命令：

```powershell
pnpm start   # 启动（生产）
pnpm debug   # 以调试模式启动
pnpm pm2     # 使用 PM2 启动（需要先全局安装 pm2：pnpm add pm2 -g）
```

`pm2` 命令示例（若通过 `pnpm run pm2`）：

```powershell
# 全局安装 pm2（仅首次需要）
pnpm add pm2 -g
# 使用 pm2 启动
pnpm pm2
```

> 注意事项：
- 请确保目标服务器上的 Node.js 版本与打包时的运行时兼容（建议使用与开发环境相近的 Node 版本）。
- 如果你在运行时遇到权限或网络相关问题，请检查系统日志和 `logs/` 目录内的日志文件。

## 导入资源示例

在源码中可以像下面这样导入静态资源（构建工具根据 `?file` 规范将资源复制到构建目录）：

```ts
import logo from './resources/logo.png?file';
import textPath from './resources/txt.txt?file';
```

在打包后的运行时中，这些导入会被替换为部署目录下对应文件的路径，因此你可以直接在程序里使用。

## 使用提示

在应用中你可以从 `src/index.ts` 的 update 中开始 你可以查看 `handleUpdate` 方法是如何获取新消息
对于日志你应该使用 `src/log/index.js` 中的方法打印日志
你可以从 `getClient` 方法获取客户端来执行原生参数 与 `tdl` 包的使用方法一样
如果你想自定义`TDLib`可以前往 `src\TDLib\index.ts` 修改客户端设置，此选项的使用方法与 `tdl` 包的使用方法一样

## 预包装方法

库中包含一些常用的 TDLib 封装方法（文档或具体方法名可能会随版本变化，详细可以前往文件查看）：

- `src\TDLib\function\message.ts` 消息发送与接收（发送文本、媒体、编辑消息等快捷方法）
- `src\TDLib\function\get.ts` 获取各种参数方法
- `src\TDLib\function\index.ts` 获得各种TDLib中没有直接实现的方法 (检查自己是否在指定群组中拥有管理员权限,检查给定的聊天是否为频道)
- `src\TDLib\function\parseMarkdown.ts` Markdown 解析（如 `parseMarkdown` 帮助将 Markdown 转换为 Telegram 支持的格式）
- `src\TDLib\function\proxy.ts` TDLib实例的代理设置

请查看 `src/TDLib/function`、`src/function` 和 `src/update` 等目录中具体实现以了解全部可用方法。

## 在目标服务器上的调试建议

- 使用 `pnpm debug` 在开发环境或目标机器上运行以开启更多日志信息。
- 日志文件保存在 `logs/` 目录下：`app.log`、`debug.log`、`error.log`、`messages.log`。

