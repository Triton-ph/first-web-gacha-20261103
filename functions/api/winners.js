export async function onRequestGet({ env }) {
    try {
        const db = env.DB;

        // 1. 撈出雲端全體獲獎名冊
        const { results: winners } = await db.prepare(
            "SELECT id, player_name, prize_name, rarity, drawn_at FROM winners ORDER BY id DESC"
        ).all();

        // 2. 順便撈出雲端全域管理密碼與次數限制
        let adminPin = "adminscope";
        let drawLimit = 1;

        try {
            const { results: configs } = await db.prepare("SELECT key, value FROM system_config").all();
            if (configs) {
                configs.forEach(c => {
                    if (c.key === 'admin_pin') adminPin = c.value;
                    if (c.key === 'draw_limit') drawLimit = parseInt(c.value, 10) || 1;
                });
            }
        } catch (cfgErr) {
            console.warn("system_config 讀取提示:", cfgErr);
        }

        return Response.json({
            success: true,
            winners: winners || [],
            adminPin: adminPin,
            drawLimit: drawLimit
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
