export interface Env {
  DB: D1Database;
  NOTES_BUCKET: R2Bucket;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId");
  const fileName = url.searchParams.get("fileName");

  if (!vaultId || !fileName) return Response.json({ error: "Missing params" }, { status: 400 });

  try {
    const content = await request.text();
    const key = `${vaultId}/${fileName.endsWith('.md') ? fileName : fileName + '.md'}`;
    
    await env.NOTES_BUCKET.put(key, content, {
      httpMetadata: { contentType: "text/markdown" }
    });

    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const vaultId = url.searchParams.get("vaultId");
  const fileName = url.searchParams.get("fileName");

  if (!vaultId) return Response.json({ error: "Missing vaultId" }, { status: 400 });

  if (fileName) {
    try {
      const key = `${vaultId}/${fileName.endsWith('.md') ? fileName : fileName + '.md'}`;
      const object = await env.NOTES_BUCKET.get(key);
      if (!object) return new Response("Not Found", { status: 404 });
      
      const body = await object.text();
      return new Response(body, {
        headers: { "Content-Type": "text/markdown" }
      });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  try {
    const list = await env.NOTES_BUCKET.list({ prefix: `${vaultId}/` });
    return Response.json(list.objects);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
