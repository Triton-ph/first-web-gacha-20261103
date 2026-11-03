export async function onRequestGet({ env }) {
    try {
        const { results: winners } = await env.DB.prepare(
            "SELECT * FROM winners ORDER BY id DESC LIMIT 100"
        ).all();
        return Response.json({ success: true, winners });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}