import "dotenv/config";
import { getClient } from "./TDLib/index.ts";
import { handleUpdate } from "./TDLib/update/index.ts";

(async () => {
  const client = await getClient();

  client.on("update", async (update) => {
    handleUpdate(update);
  });

})();
