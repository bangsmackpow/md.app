import { D1Database } from "@cloudflare/workers-types";
import { nanoid } from 'nanoid';
import { sign } from '@tsndr/cloudflare-worker-jwt';

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: url.origin + '/api/auth/google',
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error || !tokenData.access_token) {
      return new Response(`Failed to retrieve access token: ${tokenData.error_description}`, { status: 400 });
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json() as { id: string; email: string; name: string; picture: string; };

    if (!userData.email) {
      return new Response("Email not provided by Google", { status: 400 });
    }
    
    // Check if user exists
    let user = await env.DB.prepare("SELECT id, email, is_admin FROM users WHERE email = ?").bind(userData.email).first<{ id: string; email: string; is_admin: number; }>();

    if (!user) {
      // Create new user
      const newUserId = nanoid();
      await env.DB.prepare("INSERT INTO users (id, email, name, avatar_url, provider, provider_id) VALUES (?, ?, ?, ?, 'google', ?)")
        .bind(newUserId, userData.email, userData.name, userData.picture, userData.id)
        .run();
      
      user = { id: newUserId, email: userData.email, is_admin: 0 };

      // Create a default vault for the new user
      const newVaultId = nanoid();
      await env.DB.prepare("INSERT INTO vaults (id, name, owner_id) VALUES (?, ?, ?)")
        .bind(newVaultId, `${userData.name}'s Vault`, newUserId)
        .run();
      await env.DB.prepare("INSERT INTO vault_members (vault_id, user_id, role) VALUES (?, ?, 'owner')")
        .bind(newVaultId, newUserId)
        .run();
    } else {
      // If user exists, ensure provider info is updated
      await env.DB.prepare("UPDATE users SET provider = 'google', provider_id = ?, name = ?, avatar_url = ? WHERE id = ?")
        .bind(userData.id, userData.name, userData.picture, user.id)
        .run();
    }

    const jwt = await sign({ id: user.id, email: user.email, isAdmin: user.is_admin === 1 }, env.JWT_SECRET);
    
    const appUrl = url.origin;
    const redirectUrl = `${appUrl}/?auth_token=${jwt}`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl
      }
    });

  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
};
