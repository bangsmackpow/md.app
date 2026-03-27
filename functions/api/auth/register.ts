export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const { email } = await request.json() as any;
    if (!email) return Response.json({ error: "Email required" }, { status: 400 });

    const userId = crypto.randomUUID();
    const token = crypto.randomUUID();
    
    // 1. Create User
    await env.DB.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
      .bind(userId, email).run();

    // 2. Create Default Vault
    const vaultId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO vaults (id, name, owner_id, r2_bucket) VALUES (?, ?, ?, ?)")
      .bind(vaultId, "My Notes", userId, "md-app-notes").run();

    // 3. Create Session
    await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, userId, Date.now() + (30 * 24 * 60 * 60 * 1000)).run();

    return Response.json({ success: true, token, userId, vaultId });
  } catch (e: any) {
    return Response.json({ error: "User likely exists or DB error" }, { status: 500 });
  }
};
