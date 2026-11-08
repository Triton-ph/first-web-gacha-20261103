export async function onRequestGet({ env }) {
    try {
        const db = env.DB;
        // 依照抽獎時間由新到舊排序撈出中獎名單
        const { results: winners } = await db.prepare(
            "SELECT id, player_name, prize_name, rarity, drawn_at FROM winners ORDER BY id DESC"
        ).all();

        return Response.json({
            success: true,
            winners: winners || []
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
