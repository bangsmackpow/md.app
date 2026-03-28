export interface Env {
  DB: D1Database;
}

// Simple hash helper for Cloudflare Workers
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const { email, password, mode } = await request.json() as any;
    if (!email || !password) return Response.json({ error: "Email and password required" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();
    const hashedPassword = await hashPassword(password);

    // 1. Check if user exists
    let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(cleanEmail).first() as any;

    if (mode === "register") {
      if (user) return Response.json({ error: "User already exists" }, { status: 400 });
      
      const userId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
        .bind(userId, cleanEmail, hashedPassword).run();
      
      // Create Default Vault
      const vaultId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO vaults (id, name, owner_id, r2_bucket) VALUES (?, ?, ?, ?)")
        .bind(vaultId, "My Notes", userId, "md-app-notes").run();
      
      await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, ?)")
        .bind(vaultId, userId, "owner").run();
      
      user = { id: userId };
    } else {
      // Login Mode
      if (!user || user.password_hash !== hashedPassword) {
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
      }
    }

    // 2. Create Session
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, user.id, Date.now() + (30 * 24 * 60 * 60 * 1000)).run();

    // 3. Return vaults
    const { results: vaults } = await env.DB.prepare(
      "SELECT v.*, vm.role FROM vaults v JOIN vault_members vm ON v.id = vm.vault_id WHERE vm.user_id = ?"
    ).bind(user.id).all();

    return Response.json({ success: true, token, userId: user.id, vaults });
  } catch (e: any) {
    console.error("Auth Error:", e);
    return Response.json({ error: "Authentication server error" }, { status: 500 });
  }
};
