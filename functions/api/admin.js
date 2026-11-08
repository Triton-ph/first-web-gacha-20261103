export async function onRequestPost({ request, env }) {
    try {
        const { action, prize, prizes, resetWinners } = await request.json();
        const db = env.DB;

        // 動作 1：重置獎池庫存（將 remaining 復原為 initial_stock）
        if (action === 'reset_pool') {
            await db.prepare("UPDATE prizes SET remaining = initial_stock").run();

            // 若管理者勾選「一併清除中獎名單」以重啟新活動
            if (resetWinners) {
                await db.prepare("DELETE FROM winners").run();
            }

            return Response.json({ success: true, message: "獎池庫存已成功重置！" });
        }

        // 動作 2：即時編輯單一獎品資訊與庫存
        if (action === 'update_prize') {
            await db.prepare(
                "UPDATE prizes SET name = ?, rarity = ?, weight = ?, initial_stock = ?, remaining = ? WHERE id = ?"
            ).bind(prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.remaining, prize.id).run();

            return Response.json({ success: true, message: "獎品資料已即時更新至 D1！" });
        }

        // 動作 3：後台整批重新匯入覆蓋現存獎池
        if (action === 'replace_all_prizes' && Array.isArray(prizes)) {
            // 清空舊獎品
            await db.prepare("DELETE FROM prizes").run();

            // 逐筆寫入新獎品
            for (const p of prizes) {
                await db.prepare(
                    "INSERT INTO prizes (id, name, rarity, weight, initial_stock, remaining, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(p.id, p.name, p.rarity, p.weight, p.initial_stock, p.remaining, p.image_url || './LOGO.png').run();
            }

            return Response.json({ success: true, message: "全新獎池已成功建立並同步至 D1！" });
        }

        return Response.json({ error: "未知的操作指令" }, { status: 400 });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
