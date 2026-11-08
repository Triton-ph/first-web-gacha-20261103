export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { action, prize, prizes, resetWinners, newPin, newLimit } = body;
        const db = env.DB;

        // 確保 system_config 表存在
        await db.prepare("CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)").run();

        // 動作 1：儲存全域密碼至 D1 (所有裝置同步)
        if (action === 'save_pin') {
            await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('admin_pin', ?)").bind(String(newPin)).run();
            return Response.json({ success: true, message: "全域管理密碼已同步至雲端 D1！" });
        }

        // 動作 2：儲存全域次數限制至 D1 (所有裝置同步)
        if (action === 'save_limit') {
            await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('draw_limit', ?)").bind(String(newLimit)).run();
            return Response.json({ success: true, message: "全域抽獎次數限制已同步至雲端 D1！" });
        }

        // 動作 3：重置獎池庫存
        if (action === 'reset_pool') {
            await db.prepare("UPDATE prizes SET remaining = initial_stock").run();
            if (resetWinners) {
                await db.prepare("DELETE FROM winners").run();
            }
            return Response.json({ success: true, message: "獎池庫存已成功重置！" });
        }

        // 動作 4：即時更新單一獎品資訊
        if (action === 'update_prize') {
            await db.prepare(
                "UPDATE prizes SET name = ?, rarity = ?, weight = ?, initial_stock = ?, remaining = ? WHERE id = ?"
            ).bind(prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.remaining, prize.id).run();
            return Response.json({ success: true, message: "獎品資料已即時更新至 D1！" });
        }

        // 動作 5：新增獨立獎項至 D1
        if (action === 'add_prize') {
            await db.prepare(
                "INSERT INTO prizes (id, name, rarity, weight, initial_stock, remaining, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(prize.id, prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.remaining, prize.image_url || './LOGO.png').run();
            return Response.json({ success: true, message: "已成功新增獨立獎項至 D1！" });
        }

        // 動作 6：自 D1 刪除獎項
        if (action === 'delete_prize') {
            await db.prepare("DELETE FROM prizes WHERE id = ?").bind(prize.id).run();
            return Response.json({ success: true, message: "獎項已自 D1 刪除！" });
        }

        return Response.json({ error: "未知的操作指令" }, { status: 400 });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
