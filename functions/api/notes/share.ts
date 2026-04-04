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

  const { recipientEmail, noteTitle, content } = await request.json() as any;
  if (!recipientEmail || !noteTitle || !content) return Response.json({ error: "Missing data" }, { status: 400 });

  const shareId = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO shared_notes (id, sender_id, recipient_email, note_title, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(shareId, session.user_id, recipientEmail.trim().toLowerCase(), noteTitle, content).run();
    return Response.json({ success: true, shareId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const user = await env.DB.prepare(
    "SELECT u.email FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
  ).bind(token, Date.now()).first() as any;

  if (!user) return Response.json({ error: "Invalid session" }, { status: 401 });

  const { results: inbound } = await env.DB.prepare(
    "SELECT sn.*, u.email as sender_email FROM shared_notes sn JOIN users u ON sn.sender_id = u.id WHERE sn.recipient_email = ? AND sn.status = 'pending'"
  ).bind(user.email).all();

  return Response.json(inbound);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId, status } = await request.json() as any;
  if (!shareId || !status) return Response.json({ error: "Missing shareId or status" }, { status: 400 });

  if (status === 'accepted') {
    await env.DB.prepare("UPDATE shared_notes SET status = 'accepted' WHERE id = ?").bind(shareId).run();
  } else {
    await env.DB.prepare("DELETE FROM shared_notes WHERE id = ?").bind(shareId).run();
  }

  return Response.json({ success: true });
};
