import { Telegraph } from "telegraph.js";

/* global logger */

const telegraph = new Telegraph(
  "ad3df135a41859e0c394ea78c62d02fef4c3b25f373e7f076e697515d8ab"
);

export async function createHentaiPreview(hentai) {
  const content = [
    {
      tag: "figure",
      children: [
        {
          tag: "img",
          attrs: {
            src: hentai.coverImage,
          },
        },
        {
          tag: "figcaption",
          children: [""],
        },
      ],
    },
    {
      tag: "p",
      children: [hentai.title],
    },
    {
      tag: "p",
      children: [`厂商: ${hentai.author}`],
    },
    {
      tag: "p",
      children: [`发售日: ${hentai.releaseDate}`],
    },
    {
      tag: "p",
      children: [`标签: ${hentai.tags.join(" #")}`],
    },
    ...(hentai.video
      ? [
          {
            tag: "h3",
            attrs: {
              id: "预告视频",
            },
            children: ["预告视频"],
          },
          {
            tag: "figure",
            children: [
              {
                tag: "video",
                attrs: {
                  src: hentai.video,
                  preload: "auto",
                  controls: "controls",
                },
              },
              {
                tag: "figcaption",
                children: [""],
              },
            ],
          },
        ]
      : []),
    {
      tag: "h4",
      attrs: {
        id: "预告图",
      },
      children: [" 预告图"],
    },
    {
      tag: "p",
      children: ["\n "],
    },
    ...(Array.isArray(hentai.images)
      ? hentai.images.map((img) => ({
          tag: "figure",
          children: [
            {
              tag: "img",
              attrs: { src: img },
            },
            {
              tag: "figcaption",
              children: [""],
            },
          ],
        }))
      : []),
  ];

  const createPage = () =>
    telegraph.createPage({
      title: `[里番预告][${hentai.author}][${hentai.releaseDate}]${hentai.title}`,
      author_name: "@ppx114514 - 里番预告",
      author_url: "https://t.me/ppx114514",
      content: content,
      return_content: false,
    });

  try {
    const page = await createPage();
    return page.url;
  } catch (error) {
    logger.warn("Telegraph 创建页面失败，2秒后重试一次", error);
    // 等待 2 秒再重试
    await new Promise((res) => setTimeout(res, 2000));
    try {
      const page = await createPage();
      return page.url;
    } catch (secondError) {
      logger.error("Telegraph 第二次创建页面失败，抛出错误", secondError);
      throw secondError;
    }
  }
}
