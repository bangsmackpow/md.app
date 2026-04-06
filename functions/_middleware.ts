export const onRequest: PagesFunction = async ({ request, next }) => {
  const origin = request.headers.get("Origin") || "*";
  
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const response = await next();
    
    // Create a new response to allow header modification
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set("Access-Control-Allow-Origin", origin);
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return newResponse;
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
      }
    });
  }
};
