export async function onRequestPost({ request, env }) {
    try {
        const { action, prize } = await request.json();
        const db = env.DB;

        // 重置獎池：將所有 remaining 復原為 initial_stock
        if (action === 'reset_pool') {
            await db.prepare("UPDATE prizes SET remaining = initial_stock").run();
            return Response.json({ success: true, message: "獎池庫存已全數放回重置！" });
        }

        // 新增品項
        if (action === 'add_prize') {
            await db.prepare(
                "INSERT INTO prizes (id, name, rarity, weight, initial_stock, remaining, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(prize.id, prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.initial_stock, prize.image_url || './LOGO.png').run();
            return Response.json({ success: true });
        }

        // 刪除品項
        if (action === 'delete_prize') {
            await db.prepare("DELETE FROM prizes WHERE id = ?").bind(prize.id).run();
            return Response.json({ success: true });
        }

        return Response.json({ error: "無效的操作動作" }, { status: 400 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
