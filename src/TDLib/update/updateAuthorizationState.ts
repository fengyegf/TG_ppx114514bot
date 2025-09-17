import type { updateAuthorizationState as Td$updateAuthorizationState } from "tdlib-types";
import logger from "../../log/index.ts";
import { getMe } from "../function/get.ts";

export default async function updateAuthorizationState(
  update: Td$updateAuthorizationState
) {
  // console.log("收到授权状态更新", JSON.stringify(update, null, 2));
  // 检查消息时间戳，只处理10分钟内的消息
  switch (update.authorization_state._) {
    case "authorizationStateWaitTdlibParameters":
      break;
    case "authorizationStateWaitPhoneNumber":
      logger.info(
        `授权状态更新: 等待登录账户(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitPremiumPurchase":
      logger.info(
        `授权状态更新: 您必须购买Telegram Premium才能登录(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitEmailAddress":
      logger.info(
        `授权状态更新: 添加电子邮件地址(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitEmailCode":
      logger.info(
        `授权状态更新: 等待输入电子邮件验证码(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitCode":
      logger.info(
        `授权状态更新: 等待输入验证码，在您其他登录该账户的设备上查看(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitOtherDeviceConfirmation":
      logger.info(`授权状态更新: 扫码登录(${update.authorization_state._})`);
      break;
    case "authorizationStateWaitRegistration":
      logger.info(
        `授权状态更新: 用户未注册，需要接受服务条款并输入其名字和姓氏才能完成注册(${update.authorization_state._})`
      );
      break;
    case "authorizationStateWaitPassword":
      logger.info(
        `授权状态更新: 等待输入你的二步验证密码(${update.authorization_state._})`
      );
      break;
    case "authorizationStateReady":
      logger.info(`授权状态更新: 已登录(${update.authorization_state._})`);
      getMeInfo();
      break;
    case "authorizationStateLoggingOut":
      logger.info(
        `授权状态更新: 正在注销登录(${update.authorization_state._})`
      );
      break;
    case "authorizationStateClosing":
      logger.info(
        `授权状态更新: TDLib 即将关闭(${update.authorization_state._})`
      );
      break;
    case "authorizationStateClosed":
      logger.info(
        `授权状态更新: TDLib 已关闭，所有数据库都已关闭，所有资源都已释放，所有查询都将以错误代码 500 进行响应(${update.authorization_state._})`
      );
      break;
  }
}
async function getMeInfo() {
  const me = await getMe();

  if (me && me.usernames && me.type._ === "userTypeBot") {
    logger.info(
      `Bot 已登录: ${me.first_name}${me.last_name} (@${me.usernames.active_usernames[0]} - ID:${me.id})`
    );
  }
  if (me && me.usernames && me.type._ === "userTypeRegular") {
    logger.info(
      `用户 ${me.first_name}${me.last_name} 已登录: (@${
        me.usernames.active_usernames[0] || null
      } - ID:${me.id})`
    );
  }
}
