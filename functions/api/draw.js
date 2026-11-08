export async function onRequestPost({ request, env }) {
    try {
        const { playerName } = await request.json();
        const trimmedName = (playerName || "").trim();

        // 1. 驗證是否填寫名稱
        if (!trimmedName) {
            return Response.json({ error: "請先輸入您的抽獎姓名/暱稱！" }, { status: 400 });
        }

        const db = env.DB;

        // 2. 實名制檢查：驗證該名稱是否已經抽過獎
        const existingRecord = await db.prepare(
            "SELECT id FROM winners WHERE player_name = ?"
        ).bind(trimmedName).first();

        if (existingRecord) {
            return Response.json({ error: `「${trimmedName}」已經參加過抽獎囉！每人限抽一次。` }, { status: 400 });
        }

        // 3. 檢查獎池剩餘庫存
        const { results: availablePrizes } = await db.prepare(
            "SELECT * FROM prizes WHERE remaining > 0"
        ).all();

        if (!availablePrizes || availablePrizes.length === 0) {
            return Response.json({ error: "非常抱歉，所有獎品已全數抽完！" }, { status: 400 });
        }

        // 4. 依照權重進行伺服端隨機判定
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

        // 5. 樂觀鎖扣庫存（防多人同時搶最後一顆）
        const updateResult = await db.prepare(
            "UPDATE prizes SET remaining = remaining - 1 WHERE id = ? AND remaining > 0"
        ).bind(picked.id).run();

        if (updateResult.meta.changes === 0) {
            return Response.json({ error: "手速太慢！該獎項剛好被抽走，請再試一次。" }, { status: 409 });
        }

        // 6. 寫入實名獲獎紀錄（利用 UNIQUE 防止同名稱並行重複寫入）
        try {
            await db.prepare(
                "INSERT INTO winners (player_name, prize_id, prize_name, rarity) VALUES (?, ?, ?, ?)"
            ).bind(trimmedName, picked.id, picked.name, picked.rarity).run();
        } catch (dbErr) {
            // 若撞到 UNIQUE 限制，回滾剛才扣掉的庫存
            await db.prepare("UPDATE prizes SET remaining = remaining + 1 WHERE id = ?").bind(picked.id).run();
            return Response.json({ error: `「${trimmedName}」已經參加過抽獎，無法重複抽取！` }, { status: 400 });
        }

        // 7. 成功回傳獲獎項目
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
