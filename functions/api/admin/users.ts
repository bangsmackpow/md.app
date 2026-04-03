export interface Env {
  DB: D1Database;
}

async function getAdminUser(request: Request, env: Env) {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;

  const token = auth.replace("Bearer ", "");
  const user = await env.DB.prepare(
    "SELECT u.id, u.is_admin FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
  ).bind(token, Date.now()).first() as any;

  return (user && user.is_admin === 1) ? (user.id as string) : null;
}

async function logAdminAction(env: Env, adminId: string, targetUserId: string | null, action: string, details: string) {
  try {
    const logId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO admin_audit_logs (id, admin_id, target_user_id, action, details) VALUES (?, ?, ?, ?, ?)"
    ).bind(logId, adminId, targetUserId, action, details).run();
  } catch (e) {
    console.error("Failed to log admin action", e);
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const adminId = await getAdminUser(request, env);
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { results: users } = await env.DB.prepare("SELECT id, email, is_admin, status, force_password_change, two_factor_enabled, storage_quota_mb, current_usage_bytes, created_at, last_login FROM users").all();
  return Response.json(users);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const adminId = await getAdminUser(request, env);
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await request.json() as any;
  const { id, email, password, is_admin, status, force_password_change, two_factor_enabled, storage_quota_mb } = data;

  if (!id) return Response.json({ error: "User ID required" }, { status: 400 });

  let query = "UPDATE users SET email = ?, is_admin = ?, status = ?, force_password_change = ?, two_factor_enabled = ?, storage_quota_mb = ? WHERE id = ?";
  let params = [
    email || "", 
    is_admin ? 1 : 0, 
    status || 'active', 
    force_password_change ? 1 : 0, 
    two_factor_enabled ? 1 : 0, 
    storage_quota_mb || 500, 
    id
  ];

  if (password) {
    const encoder = new TextEncoder();
    const pwData = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", pwData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    query = "UPDATE users SET email = ?, password_hash = ?, is_admin = ?, status = ?, force_password_change = ?, two_factor_enabled = ?, storage_quota_mb = ? WHERE id = ?";
    params = [
      email || "", 
      hashedPassword, 
      is_admin ? 1 : 0, 
      status || 'active', 
      force_password_change ? 1 : 0, 
      two_factor_enabled ? 1 : 0, 
      storage_quota_mb || 500, 
      id
    ];
  }

  try {
    await env.DB.prepare(query).bind(...params).run();
    await logAdminAction(env, adminId, id, 'UPDATE_USER', JSON.stringify({ email, is_admin, status, quota: storage_quota_mb }));
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const adminId = await getAdminUser(request, env);
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "User ID required" }, { status: 400 });

  try {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
    await logAdminAction(env, adminId, id, 'DELETE_USER', 'Permanently deleted user and sessions');
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
