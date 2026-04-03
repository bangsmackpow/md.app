export interface Env {
  DB: D1Database;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now()).first() as any;

  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  const { currentPassword, newPassword } = await request.json() as any;
  if (!currentPassword || !newPassword) return Response.json({ error: "Passwords required" }, { status: 400 });

  const user = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(session.user_id).first() as any;

  const currentHashed = await hashPassword(currentPassword);
  if (user.password_hash !== currentHashed) {
    return Response.json({ error: "Incorrect current password" }, { status: 400 });
  }

  const newHashed = await hashPassword(newPassword);
  await env.DB.prepare("UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?")
    .bind(newHashed, session.user_id).run();

  return Response.json({ success: true });
};
