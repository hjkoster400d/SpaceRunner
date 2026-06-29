export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT name, score, created_at FROM scores ORDER BY score DESC LIMIT 10"
  ).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const { name, score } = await request.json();

  if (!name || typeof name !== "string" || name.length > 20) {
    return Response.json({ error: "Invalid name" }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0) {
    return Response.json({ error: "Invalid score" }, { status: 400 });
  }

  await env.DB.prepare(
    "INSERT INTO scores (name, score) VALUES (?, ?)"
  ).bind(name.trim(), score).run();

  return Response.json({ ok: true });
}
