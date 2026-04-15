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

  try {
    // List all vaults I have access to
    const { results } = await env.DB.prepare(
      "SELECT v.*, vm.role FROM vaults v JOIN vault_members vm ON v.id = vm.vault_id WHERE vm.user_id = ?"
    ).bind(session.user_id).all();
    
    return Response.json(results);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  const { name, encryption_enabled, encryption_salt } = await request.json() as any;
  const vaultId = crypto.randomUUID();

  try {
    await env.DB.prepare("INSERT INTO vaults (id, name, owner_id, encryption_enabled, encryption_salt) VALUES (?, ?, ?, ?, ?)")
      .bind(vaultId, name || "New Vault", session.user_id, encryption_enabled ? 1 : 0, encryption_salt || null).run();

    await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)")
      .bind(vaultId, session.user_id, "owner").run();

    return Response.json({ success: true, vaultId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("id");
  if (!vaultId) return Response.json({ error: "Vault ID required" }, { status: 400 });

  // Verify ownership
  const vault = await env.DB.prepare("SELECT owner_id FROM vaults WHERE id = ?")
    .bind(vaultId).first() as any;

  if (!vault || vault.owner_id !== session.user_id) {
    return Response.json({ error: "Only owners can edit vault settings" }, { status: 403 });
  }

  const { name, encryption_enabled, encryption_salt } = await request.json() as any;

  try {
    await env.DB.prepare("UPDATE vaults SET name = ?, encryption_enabled = ?, encryption_salt = ? WHERE id = ?")
      .bind(name, encryption_enabled ? 1 : 0, encryption_salt || null, vaultId).run();

    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
