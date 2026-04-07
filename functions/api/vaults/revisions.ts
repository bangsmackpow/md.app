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

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("id");
  const { noteId, content } = await request.json() as any;

  if (!vaultId || !noteId || !content) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Simple hash for revision tracking
  const hash = crypto.randomUUID().substring(0, 8);

  try {
    await env.DB.prepare(
      "INSERT INTO note_revisions (id, vault_id, note_id, user_id, content, hash) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), vaultId, noteId, session.user_id, content, hash).run();

    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const noteId = url.searchParams.get("noteId");
  const revisionId = url.searchParams.get("revisionId");

  if (revisionId) {
    const revision = await env.DB.prepare("SELECT content FROM note_revisions WHERE id = ?").bind(revisionId).first();
    if (!revision) return new Response("Revision not found", { status: 404 });
    return Response.json(revision);
  }

  if (!noteId) return Response.json({ error: "Note ID required" }, { status: 400 });

  const { results } = await env.DB.prepare(
    "SELECT r.id, r.hash, r.created_at, u.email as author FROM note_revisions r JOIN users u ON r.user_id = u.id WHERE r.note_id = ? ORDER BY r.created_at DESC LIMIT 20"
  ).bind(noteId).all();

  return Response.json(results);
};
