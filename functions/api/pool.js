export async function onRequestGet({ env }) {
    try {
        const db = env.DB;
        const { results: prizes } = await db.prepare(
            "SELECT * FROM prizes ORDER BY weight ASC"
        ).all();

        return Response.json({
            success: true,
            prizes: prizes || []
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
