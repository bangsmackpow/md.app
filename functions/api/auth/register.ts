export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const { email } = await request.json() as any;
    if (!email) return Response.json({ error: "Email required" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if user exists
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(cleanEmail).first() as any;

    let userId = user?.id;
    let isNewUser = false;

    if (!user) {
      userId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
        .bind(userId, cleanEmail).run();
      isNewUser = true;
    }

    // 2. Create or Get Session
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, userId, Date.now() + (30 * 24 * 60 * 60 * 1000)).run();

    // 3. Create Default Vault if new
    if (isNewUser) {
      const vaultId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO vaults (id, name, owner_id, r2_bucket) VALUES (?, ?, ?, ?)")
        .bind(vaultId, "My Notes", userId, "md-app-notes").run();
      
      await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)")
        .bind(vaultId, userId, "owner").run();
    }

    // 4. Return user info and vaults
    const { results: vaults } = await env.DB.prepare(
      "SELECT v.* FROM vaults v JOIN vault_members vm ON v.id = vm.vault_id WHERE vm.user_id = ?"
    ).bind(userId).all();

    return Response.json({ success: true, token, userId, vaults });
  } catch (e: any) {
    console.error("Register Error:", e);
    return Response.json({ error: "Authentication error" }, { status: 500 });
  }
};
