export interface Env {
  DB: D1Database;
  NOTES_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Helper: CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/health") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // AUTH: Register / Login (Simplified for Phase 1)
    // In a real app, this would send an email. For now, it just creates a user.
    if (path === "/api/auth/register" && request.method === "POST") {
      const { email } = await request.json() as any;
      if (!email) return Response.json({ error: "Email required" }, { status: 400, headers: corsHeaders });

      const userId = crypto.randomUUID();
      const token = crypto.randomUUID();
      
      try {
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

        return Response.json({ success: true, token, userId, vaultId }, { headers: corsHeaders });
      } catch (e: any) {
        return Response.json({ error: "User likely exists or DB error" }, { status: 500, headers: corsHeaders });
      }
    }

    // VAULTS: List my vaults (Requires Authorization header)
    if (path === "/api/vaults" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

      const token = auth.replace("Bearer ", "");
      const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
        .bind(token, Date.now()).first() as any;

      if (!session) return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders });

      const { results } = await env.DB.prepare(
        "SELECT * FROM vaults WHERE owner_id = ?"
      ).bind(session.user_id).all();
      
      return Response.json(results, { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
