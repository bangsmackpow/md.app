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

  const { email, vaultId, role } = await request.json() as any;
  if (!email || !vaultId) return Response.json({ error: "Missing email or vaultId" }, { status: 400 });

  // 1. Verify session user is owner of the vault
  const vault = await env.DB.prepare("SELECT owner_id FROM vaults WHERE id = ?")
    .bind(vaultId).first() as any;

  if (!vault || vault.owner_id !== session.user_id) {
    return Response.json({ error: "Only owners can share vaults" }, { status: 403 });
  }

  // 2. Lookup target user by email
  const targetUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.trim().toLowerCase()).first() as any;

  if (!targetUser) {
    return Response.json({ error: "User not found. They must sign in to md.app first." }, { status: 404 });
  }

  // 3. Add to vault_members
  try {
    await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)")
      .bind(vaultId, targetUser.id, role || "editor").run();
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: "User already has access to this vault" }, { status: 400 });
  }
};
