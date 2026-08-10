const limits = new Map();
const allowedOrigins = new Set(['https://wigner-six.vercel.app','https://msgdo2007-code.github.io','http://localhost:3000','http://127.0.0.1:3000']);
const clean = (value, max = 1000) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const field = (name, value, inline = false) => ({ name, value: clean(value, 1000) || 'Não informado', inline });

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Origem não autorizada.' });
  res.setHeader('Vary', 'Origin');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const ip = clean(req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown', 80);
  const now = Date.now();
  const attempts = (limits.get(ip) || []).filter(time => now - time < 60000);
  if (attempts.length >= 5) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
  attempts.push(now); limits.set(ip, attempts);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (body.website) return res.status(200).json({ ok: true });
  const type = clean(body.type, 20);
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const envName = { ideas:'DISCORD_IDEAS_WEBHOOK', lucidez:'DISCORD_LUCIDEZ_WEBHOOK', team:'DISCORD_TEAM_WEBHOOK' }[type];
  if (!envName) return res.status(400).json({ error: 'Tipo de formulário inválido.' });
  const webhook = process.env[envName];
  if (!webhook) return res.status(503).json({ error: 'Canal temporariamente indisponível.' });

  let payload;
  if (type === 'team') {
    if (!clean(data.name,250) || !clean(data.discord,250) || !clean(data.message,1000)) return res.status(400).json({ error:'Preencha os campos obrigatórios.' });
    payload={username:'Wigner • Recrutamento',embeds:[{title:'Nova candidatura para a equipe',color:16436324,fields:[field('Candidato',data.name,true),field('Discord',data.discord,true),field('Área',data.area,true),field('Projeto',data.project,true),field('Apresentação',data.message)],timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]}};
  } else {
    if (!clean(data.idea,1000) || !clean(data.project,250)) return res.status(400).json({ error:'Descreva a ideia e escolha o projeto.' });
    payload={username:type==='lucidez'?'Lucidez • Sugestões':'Wigner • Central de Ideias',embeds:[{title:`Nova ideia para ${clean(data.project,250)}`,color:type==='lucidez'?13211180:8745215,fields:[field('Autor',data.name||'Anônimo',true),field('Projeto',data.project,true),field('Ideia',data.idea)],timestamp:new Date().toISOString()}],allowed_mentions:{parse:[]}};
  }
  const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)return res.status(502).json({error:'O canal não respondeu.'});
  return res.status(200).json({ok:true});
};
