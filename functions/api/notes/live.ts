export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  try {
    const { notePath, content } = await request.json() as any;
    const shareId = crypto.randomUUID();
    
    await env.DB.prepare(
      "INSERT INTO live_shares (id, host_id, note_path, content) VALUES (?, ?, ?, ?)"
    ).bind(shareId, session.user_id, notePath, content).run();

    return Response.json({ success: true, shareId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const shareId = url.searchParams.get("id");

  if (!shareId) return Response.json({ error: "Missing shareId" }, { status: 400 });

  try {
    const share = await env.DB.prepare("SELECT * FROM live_shares WHERE id = ?").bind(shareId).first() as any;
    if (!share) return Response.json({ error: "Share not found" }, { status: 404 });
    return Response.json(share);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { shareId, content } = await request.json() as any;
    await env.DB.prepare("UPDATE live_shares SET content = ?, last_updated = ? WHERE id = ?")
      .bind(content, Math.floor(Date.now() / 1000), shareId).run();
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
