export interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  // List all vaults I have access to
  const { results } = await env.DB.prepare(
    "SELECT v.*, vm.role FROM vaults v JOIN vault_members vm ON v.id = vm.vault_id WHERE vm.user_id = ?"
  ).bind(session.user_id).all();
  
  return Response.json(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  const { name, r2_endpoint, r2_access_key, r2_secret_key, r2_bucket } = await request.json() as any;
  const vaultId = crypto.randomUUID();

  try {
    await env.DB.prepare("INSERT INTO vaults (id, name, owner_id, r2_endpoint, r2_access_key, r2_secret_key, r2_bucket) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(vaultId, name || "New Vault", session.user_id, r2_endpoint, r2_access_key, r2_secret_key, r2_bucket).run();

    await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)")
      .bind(vaultId, session.user_id, "owner").run();

    return Response.json({ success: true, vaultId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
