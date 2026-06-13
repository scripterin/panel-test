// Acest route NU mai accesează Firestore.
// Singurul motiv pentru care e server-side: client_secret-ul Discord
// nu poate fi expus în browser. Whitelist check + upsert membru se
// fac direct din client (app/auth/callback/page.js) cu Firestore SDK.

export async function POST(req) {
  const { code } = await req.json();
  if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return Response.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();
    if (!userRes.ok || !discordUser.id) {
      return Response.json({ error: 'Failed to fetch Discord user' }, { status: 400 });
    }

    return Response.json({
      discordId:     discordUser.id,
      discordTag:    discordUser.username,
      discordAvatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
    });
  } catch (e) {
    console.error('discord-auth error', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
