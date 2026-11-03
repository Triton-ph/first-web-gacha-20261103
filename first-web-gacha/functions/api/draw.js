export async function onRequestPost({ request, env }) {
    try {
        const { count = 1 } = await request.json();
        const db = env.DB;

        // 撈出目前所有剩餘庫存 > 0 的獎品
        const { results: availablePrizes } = await db.prepare(
            "SELECT * FROM prizes WHERE remaining > 0"
        ).all();

        if (!availablePrizes || availablePrizes.length === 0) {
            return Response.json({ error: "獎品已全數抽完！" }, { status: 400 });
        }

        const wonBatch = [];
        const batchId = `b_${Date.now()}`;

        for (let i = 0; i < count; i++) {
            const currentStock = availablePrizes.filter(p => p.remaining > 0);
            if (currentStock.length === 0) break;

            const totalWeight = currentStock.reduce((sum, p) => sum + p.weight, 0);
            let rand = Math.random() * totalWeight;
            let picked = currentStock[0];

            for (const p of currentStock) {
                rand -= p.weight;
                if (rand <= 0) {
                    picked = p;
                    break;
                }
            }

            // 原子扣庫存（樂觀鎖，防止兩人同時抽到最後一顆）
            const updateResult = await db.prepare(
                "UPDATE prizes SET remaining = remaining - 1 WHERE id = ? AND remaining > 0"
            ).bind(picked.id).run();

            if (updateResult.meta.changes > 0) {
                picked.remaining -= 1;
                wonBatch.push(picked);

                // 寫入雲端中獎名單紀錄
                await db.prepare(
                    "INSERT INTO winners (prize_id, prize_name, rarity, draw_batch_id) VALUES (?, ?, ?, ?)"
                ).bind(picked.id, picked.name, picked.rarity, batchId).run();
            }
        }

        return Response.json({ success: true, wonItems: wonBatch });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}