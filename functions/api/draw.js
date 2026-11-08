export async function onRequestPost({ request, env }) {
    try {
        const { playerName, maxLimit = 1 } = await request.json();
        const trimmedName = (playerName || "").trim();

        if (!trimmedName) {
            return Response.json({ error: "請先輸入您的抽獎姓名或暱稱！" }, { status: 400 });
        }

        const db = env.DB;

        // 檢查該玩家已抽次數
        const { results: history } = await db.prepare(
            "SELECT id FROM winners WHERE player_name = ?"
        ).bind(trimmedName).all();

        if (history && history.length >= maxLimit) {
            return Response.json({ error: `「${trimmedName}」已達到抽獎上限 (${maxLimit} 次)！` }, { status: 400 });
        }

        const { results: availablePrizes } = await db.prepare(
            "SELECT * FROM prizes WHERE remaining > 0"
        ).all();

        if (!availablePrizes || availablePrizes.length === 0) {
            return Response.json({ error: "非常抱歉，所有獎品已全數抽完！" }, { status: 400 });
        }

        const totalWeight = availablePrizes.reduce((sum, p) => sum + (parseFloat(p.weight) || 1), 0);
        let rand = Math.random() * totalWeight;
        let picked = availablePrizes[0];

        for (const p of availablePrizes) {
            rand -= (parseFloat(p.weight) || 1);
            if (rand <= 0) { picked = p; break; }
        }

        const updateResult = await db.prepare(
            "UPDATE prizes SET remaining = remaining - 1 WHERE id = ? AND remaining > 0"
        ).bind(picked.id).run();

        if (updateResult.meta.changes === 0) {
            return Response.json({ error: "手速太慢！該獎項剛好被抽走，請再試一次。" }, { status: 409 });
        }

        await db.prepare(
            "INSERT INTO winners (player_name, prize_id, prize_name, rarity) VALUES (?, ?, ?, ?)"
        ).bind(trimmedName, picked.id, picked.name, picked.rarity).run();

        return Response.json({
            success: true,
            wonItem: {
                id: picked.id,
                name: picked.name,
                rarity: picked.rarity,
                image_url: picked.image_url
            }
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
