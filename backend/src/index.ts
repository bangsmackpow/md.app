export interface Env {
  DB: D1Database;
  NOTES_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Simple Health Check
    if (path === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Phase 1: Auth (Magic Link Mock for now)
    if (path === "/api/auth/session" && request.method === "POST") {
      // Logic: Validate email, send link, or verify token
      return Response.json({ success: true, message: "Auth system initializing" });
    }

    // Phase 2: Vault Management
    if (path === "/api/vaults" && request.method === "GET") {
      // Logic: Query D1 for vaults belonging to the user
      const { results } = await env.DB.prepare(
        "SELECT * FROM vaults"
      ).all();
      return Response.json(results);
    }

    // Default 404
    return new Response("Not Found", { status: 404 });
  },
};
