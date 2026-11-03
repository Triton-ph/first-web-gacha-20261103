export async function onRequestGet({ env }) {
    try {
        const { results: prizes } = await env.DB.prepare(
            "SELECT * FROM prizes ORDER BY weight ASC"
        ).all();
        return Response.json({ success: true, prizes });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}