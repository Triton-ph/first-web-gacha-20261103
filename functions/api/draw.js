export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const playerName = (body.playerName || "").trim();
        const maxLimit = parseInt(body.maxLimit, 10) || 1;

        if (!playerName) {
            return Response.json({ error: "請先輸入您的抽獎姓名或暱稱！" }, { status: 400 });
        }

        const db = env.DB;

        // 1. 檢查該玩家在 D1 的已抽獎歷史次數
        const { results: history } = await db.prepare(
            "SELECT id FROM winners WHERE player_name = ?"
        ).bind(playerName).all();

        const drawnCount = history ? history.length : 0;
        if (drawnCount >= maxLimit) {
            return Response.json({ 
                error: `「${playerName}」已達抽獎上限 (已抽 ${drawnCount} 次 / 上限 ${maxLimit} 次)！` 
            }, { status: 400 });
        }

        // 2. 撈出目前所有有庫存 (remaining > 0) 的獎品
        const { results: availablePrizes } = await db.prepare(
            "SELECT * FROM prizes WHERE remaining > 0"
        ).all();

        if (!availablePrizes || availablePrizes.length === 0) {
            return Response.json({ error: "非常抱歉，所有獎品已全數抽完！" }, { status: 400 });
        }

        // 3. 伺服端權威隨機權重抽獎
        const totalWeight = availablePrizes.reduce((sum, p) => sum + (parseFloat(p.weight) || 1), 0);
        let rand = Math.random() * totalWeight;
        let picked = availablePrizes[0];

        for (const p of availablePrizes) {
            rand -= (parseFloat(p.weight) || 1);
            if (rand <= 0) {
                picked = p;
                break;
            }
        }

        // 4. 原子扣庫存 (樂觀鎖)
        const updateResult = await db.prepare(
            "UPDATE prizes SET remaining = remaining - 1 WHERE id = ? AND remaining > 0"
        ).bind(picked.id).run();

        if (updateResult.meta.changes === 0) {
            return Response.json({ error: "手速太慢！該獎項剛好被抽走，請再試一次。" }, { status: 409 });
        }

        // 5. 寫入實名中獎紀錄至 D1
        await db.prepare(
            "INSERT INTO winners (player_name, prize_id, prize_name, rarity) VALUES (?, ?, ?, ?)"
        ).bind(playerName, picked.id, picked.name, picked.rarity).run();

        return Response.json({
            success: true,
            wonItem: {
                id: picked.id,
                name: picked.name,
                rarity: picked.rarity,
                image_url: picked.image_url
            }
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Content-Type": "application/json"
            }
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
