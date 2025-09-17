export interface dmmGalgameInfo {
  /** 游戏标题 */
  title: string;
  /** 封面图 */
  coverImage: string;
  /** 游戏预览图 */
  images: string[];
  /** 发售日期 */
  releaseDate: string;
  /** 插画师 */
  illustrators: string[];
  /** 剧本 */
  scenario: string[];
  /** 角色声优 */
  voiceActors: string[];
  /** 游戏类型 */
  gameGenre: string;
  /** 游戏品牌 */
  brand: string;
  /** 游戏链接 */
  url: string;
}

export interface searchDmm {
  /** DMM搜索结果 */
  link: searchGalgame[];
}

export interface searchGalgame {
  /** 标题 */
  title: string;
  /** 封面 */
  cover: string;
  /** 链接 */
  link: string;
  /** 评分 */
  rating: string;
}
// export interface Anime {
//   time?: string;
//   series?: string | string[];
//   publish?: string | string[];
//   name?: string;
//   subtitle?: string;
//   sub?: string;
//   size?: string;
//   tags?: string[];
// };

export interface galgameInfo {
  /** 游戏标题 */
  title?: string;
  /** 发售日期 */
  releaseDate?: string;
  /** 游戏类型 */
  gameGenre?: string;
  /** 发售平台链接 */
  buy?: {
    /** 发售平台名称 */
    name: string;
    /** 发售平台链接 */
    link: string;
  }[];
  /** 开发商 */
  developer?: string[];
  /** 发行商 */
  publisher?: string[];
  /** 文章链接 */
  telegraphUrl?: string;
  /** 游戏介绍 */
  description?: string;
  /** 插画师 */
  illustrators?: string[];
  /** 剧本 */
  scenario?: string[];
  /** 角色声优 */
  voiceActors?: string[];
  /** 下载链接 */
  downloadLinks?: string
}
