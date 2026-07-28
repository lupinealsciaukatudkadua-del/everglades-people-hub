// Pages Function backing the Bump Priority notes/checkmark overlay on the
// static People Hub site. Storage: Cloudflare KV (binding BUMP_NOTES),
// one JSON blob per person key: {note, checked, by, when}.
//
// Identity: this route sits behind the SAME Cloudflare Access application
// as the rest of the site (Access covers the whole hostname), so every
// request already carries the caller's verified email in the
// Cf-Access-Authenticated-User-Email header before it reaches this code.
// No separate login/auth needed here.
//
// personKey = the full name string Bump Priority already uses internally
// (people-hub.html's row.name / data-name attribute) — same identity the
// "why" popout and jump-links already key on, so notes survive a tier
// change on the next egg (the note is attached to the person, not the row
// position or the tier they were in when the note was written).

function keyFor(personKey) {
  return 'note:' + personKey;
}

export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.BUMP_NOTES.list({ prefix: 'note:' });
  const out = {};
  await Promise.all(list.keys.map(async (k) => {
    const raw = await env.BUMP_NOTES.get(k.name);
    if (raw) out[k.name.slice('note:'.length)] = JSON.parse(raw);
  }));
  return Response.json(out);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const email = request.headers.get('Cf-Access-Authenticated-User-Email') || 'unknown';
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response('bad json', { status: 400 });
  }
  const personKey = (body.personKey || '').trim();
  if (!personKey) return new Response('personKey required', { status: 400 });
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
  const checked = !!body.checked;
  const record = { note, checked, by: email, when: new Date().toISOString() };
  await env.BUMP_NOTES.put(keyFor(personKey), JSON.stringify(record));
  return Response.json(record);
}
