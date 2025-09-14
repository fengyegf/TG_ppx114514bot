import { defineConfig } from "tsup";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { Plugin, OnResolveArgs, OnLoadArgs } from "esbuild";
import crypto from "crypto";

const mergedEnv: Record<string, string> = dotenv.config().parsed ?? {};

function toUnicodeEscape(str: string) {
  return str
    .split("")
    .map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .join("");
}

const defineEnv = Object.fromEntries(
  Object.entries(mergedEnv).map(([k, v]) => [
    `process.env.${k}`,
    JSON.stringify(toUnicodeEscape(v ?? "")),
  ])
);

async function modifyPackageJson() {
  // eslint-disable-next-line no-console
  console.log("🛠️  正在生成生产环境的 package.json...");

  const filePath = path.resolve("package.json");
  const newFilePath = path.resolve("dist/package.json");

  // 读取原始 package.json
  const raw = await fs.readFile(filePath, "utf-8");
  const pkg = JSON.parse(raw);

  // 覆盖 scripts
  pkg.scripts = {
    start: "node --enable-source-maps index.js",
    debug: "node --enable-source-maps index.js --debug",
    pm2: "pm2 start index.js --name \"xiaoqvan-anime-bot\" --node-args='--enable-source-maps'",
  };

  // 删除 devDependencies
  delete pkg.devDependencies;

  // 写入新的 package.json
  await fs.writeFile(newFilePath, JSON.stringify(pkg, null, 2), "utf-8");

  // eslint-disable-next-line no-console
  console.log(`✅ 已生成 ${newFilePath}`);
}

const ASSET_OUT_DIR = "assets"; // 打包输出的资源目录

function filePlugin(): Plugin {
  return {
    name: "file-plugin",
    setup(build) {
      build.onResolve({ filter: /\?file$/ }, (args: OnResolveArgs) => {
        return {
          path: path.resolve(args.resolveDir, args.path.replace(/\?file$/, "")),
          namespace: "file-ns",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "file-ns" },
        async (args: OnLoadArgs) => {
          const fileName = path.basename(args.path);
          const ext = path.extname(fileName);
          const name = path.basename(fileName, ext);

          // 读取文件内容计算 8 位十六进制 hash
          const data = await fs.readFile(args.path);
          const hash = crypto
            .createHash("md5")
            .update(data)
            .digest("hex")
            .slice(0, 8);

          const hashedFileName = `${name}.${hash}${ext}`;
          const outPath = path.resolve(
            build.initialOptions.outdir || "dist",
            ASSET_OUT_DIR,
            hashedFileName
          );

          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.copyFile(args.path, outPath);

          const publicPath = path.posix.join(ASSET_OUT_DIR, hashedFileName);
          return {
            contents: `export default ${JSON.stringify(publicPath)};`,
            loader: "js",
          };
        }
      );
    },
  };
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  target: "esnext",
  clean: false,
  publicDir: "resource",
  minify: true,
  esbuildPlugins: [filePlugin()],
  define: {
    ...defineEnv,
  },

  onSuccess: async () => {
    modifyPackageJson();
  },
});
