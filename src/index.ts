import "dotenv/config";
import { getClient } from "./TDLib/index.ts";
import { handleUpdate } from "./TDLib/update/index.ts";
import { handleUpdate as handleUpdate2 } from "./update/index.ts";
(async () => {
  const client = await getClient();

  client.on("update", async (update) => {
    handleUpdate(update);
    handleUpdate2(update);
  });
  client.loginAsBot(process.env.TELEGRAM_BOT_TOKEN as string);
})();
