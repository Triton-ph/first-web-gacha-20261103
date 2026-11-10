import { verifyTOTP, generateRandomSecret } from "./totp.js";

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { action, prize, prizes, resetWinners, newLimit, totpCode } = body;
        const db = env.DB;

        // 確保 system_config 表存在
        await db.prepare("CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)").run();

        // 1. 核心驗證：Google Authenticator 6 位數動態碼
        if (action === 'verify_totp') {
            const secretRow = await db.prepare("SELECT value FROM system_config WHERE key = 'totp_secret'").first();
            let secret = secretRow ? secretRow.value : "JBSWY3DPEHPK3PXP";

            const isValid = await verifyTOTP(secret, String(totpCode || ""));
            if (isValid) {
                return Response.json({ success: true, message: "Google Authenticator 驗證通過！" });
            } else {
                return Response.json({ success: false, error: "動態驗證碼不正確或已過期，請確認手機當前 6 位數！" }, { status: 401 });
            }
        }

        // 2. 取得 TOTP 綁定資訊 (QR Code 網址與 Secret)
        if (action === 'get_totp_setup') {
            const secretRow = await db.prepare("SELECT value FROM system_config WHERE key = 'totp_secret'").first();
            let secret = secretRow ? secretRow.value : "JBSWY3DPEHPK3PXP";

            const issuer = encodeURIComponent("澄鯨扭蛋機");
            const account = encodeURIComponent("admin");
            const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

            return Response.json({
                success: true,
                secret: secret,
                otpauthUrl: otpauthUrl,
                qrCodeUrl: qrCodeUrl
            });
        }

        // 3. 重新生成全新 TOTP 密鑰
        if (action === 'regenerate_totp_secret') {
            const newSecret = generateRandomSecret(16);
            await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('totp_secret', ?)").bind(newSecret).run();
            
            const issuer = encodeURIComponent("澄鯨扭蛋機");
            const account = encodeURIComponent("admin");
            const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${newSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

            return Response.json({
                success: true,
                message: "已生成全新 TOTP 密鑰！",
                secret: newSecret,
                qrCodeUrl: qrCodeUrl
            });
        }

        // 4. 儲存全域次數限制至 D1
        if (action === 'save_limit') {
            await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES ('draw_limit', ?)").bind(String(newLimit)).run();
            return Response.json({ success: true, message: "全域抽獎次數限制已同步至雲端 D1！" });
        }

        // 5. 重置獎池庫存
        if (action === 'reset_pool') {
            await db.prepare("UPDATE prizes SET remaining = initial_stock").run();
            if (resetWinners) await db.prepare("DELETE FROM winners").run();
            return Response.json({ success: true, message: "獎池庫存已成功重置！" });
        }

        // 6. 即時更新單一獎品
        if (action === 'update_prize') {
            await db.prepare(
                "UPDATE prizes SET name = ?, rarity = ?, weight = ?, initial_stock = ?, remaining = ? WHERE id = ?"
            ).bind(prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.remaining, prize.id).run();
            return Response.json({ success: true, message: "獎品資料已即時更新至 D1！" });
        }

        // 7. 新增獨立獎項
        if (action === 'add_prize') {
            await db.prepare(
                "INSERT INTO prizes (id, name, rarity, weight, initial_stock, remaining, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(prize.id, prize.name, prize.rarity, prize.weight, prize.initial_stock, prize.remaining, prize.image_url || './LOGO.png').run();
            return Response.json({ success: true, message: "已成功新增獨立獎項至 D1！" });
        }

        // 8. 刪除獎項
        if (action === 'delete_prize') {
            await db.prepare("DELETE FROM prizes WHERE id = ?").bind(prize.id).run();
            return Response.json({ success: true, message: "獎項已自 D1 刪除！" });
        }

        return Response.json({ error: "未知的操作指令" }, { status: 400 });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}