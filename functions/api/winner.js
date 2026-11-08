export async function onRequestGet({ env }) {
    try {
        const db = env.DB;
        // 撈出雲端全體獲獎名冊
        const { results: winners } = await db.prepare(
            "SELECT id, player_name, prize_name, rarity, drawn_at FROM winners ORDER BY id DESC"
        ).all();

        // 順便撈出雲端全域管理密碼與次數限制
        const { results: configs } = await db.prepare("SELECT key, value FROM system_config").all();
        const configMap = {};
        if (configs) configs.forEach(c => configMap[c.key] = c.value);

        return Response.json({
            success: true,
            winners: winners || [],
            adminPin: configMap['admin_pin'] || 'adminscope',
            drawLimit: parseInt(configMap['draw_limit'] || '1', 10)
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
