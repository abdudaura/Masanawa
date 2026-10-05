#!/bin/sh
set -eu
: "${TARGET_IP:?}"
: "${SSH_PRIVATE_KEY:?}"
: "${NOWPAYMENTS_RELAY_TOKEN:?}"
: "${RELAY_HOST:?}"

umask 077
printf '%s\n' "$SSH_PRIVATE_KEY" > /tmp/id_ed25519
chmod 600 /tmp/id_ed25519

cat > /tmp/relay.js <<'NODE'
const { createHash, timingSafeEqual } = require("node:crypto");
const { createServer } = require("node:http");
const PORT = Number(process.env.PORT || 10000);
const TOKEN = process.env.MASANAWA_NOWPAYMENTS_RELAY_TOKEN || "";
const MAX_BODY = 1024 * 1024;

const ALLOWED = [
  ["GET", /^\/v1\/status$/u],
  ["GET", /^\/v1\/currencies$/u],
  ["GET", /^\/v1\/min-amount$/u],
  ["GET", /^\/v1\/estimate$/u],
  ["POST", /^\/v1\/payment$/u],
  ["GET", /^\/v1\/payment\/[A-Za-z0-9_-]{1,128}$/u],
  ["POST", /^\/v1\/auth$/u],
  ["GET", /^\/v1\/balance$/u],
  ["POST", /^\/v1\/conversion$/u],
  ["GET", /^\/v1\/conversion\/[A-Za-z0-9_-]{1,128}$/u],
  ["POST", /^\/v1\/payout\/validate-address$/u],
  ["GET", /^\/v1\/payout\/fee$/u],
  ["GET", /^\/v1\/payout-withdrawal\/min-amount\/[A-Za-z0-9_-]{2,32}$/u],
  ["POST", /^\/v1\/payout$/u],
  ["GET", /^\/v1\/payout$/u],
  ["POST", /^\/v1\/payout\/[A-Za-z0-9_-]{1,128}\/verify$/u],
];

function digest(v) { return createHash("sha256").update(v).digest(); }
function equal(a,b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  return timingSafeEqual(digest(a), digest(b));
}
function json(res,status,body) {
  const data=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{"content-type":"application/json","content-length":data.length,"cache-control":"no-store"});
  res.end(data);
}
async function body(req) {
  const chunks=[]; let n=0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > MAX_BODY) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}
function allowed(method, pathname) {
  return ALLOWED.some(([m,re]) => m===method && re.test(pathname));
}

if (!TOKEN) throw new Error("missing relay token");

createServer(async (req,res) => {
  try {
    const url=new URL(req.url || "/", "http://relay.local");
    if (req.method==="GET" && url.pathname==="/healthz") return json(res,200,{ok:true,service:"masanawa-nowpayments-relay"});
    if (!equal(req.headers["x-masanawa-relay-token"], TOKEN)) return json(res,401,{ok:false,code:"unauthorized"});
    if (!allowed(req.method,url.pathname)) return json(res,404,{ok:false,code:"not_allowed"});
    const raw = req.method==="POST" ? await body(req) : undefined;
    const upstream=new URL("https://api.nowpayments.io"+url.pathname+url.search);
    const headers={accept:"application/json"};
    const apiKey=req.headers["x-api-key"];
    const auth=req.headers.authorization;
    if (typeof apiKey==="string") headers["x-api-key"]=apiKey;
    if (typeof auth==="string") headers.authorization=auth;
    if (raw) headers["content-type"]="application/json";
    let response;
    try {
      response=await fetch(upstream,{method:req.method,headers,body:raw,redirect:"error",signal:AbortSignal.timeout(20000)});
    } catch {
      return json(res,502,{ok:false,code:"provider_unreachable"});
    }
    const data=Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status,{
      "content-type":response.headers.get("content-type") || "application/json",
      "content-length":data.length,
      "cache-control":"no-store",
    });
    res.end(data);
  } catch (e) {
    json(res,e && e.message==="body_too_large" ? 413 : 500,{ok:false,code:e?.message || "internal_error"});
  }
}).listen(PORT,"127.0.0.1");
NODE

cat > /tmp/relay.service <<'UNIT'
[Unit]
Description=Masanawa NOWPayments fixed-IP relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Environment=PORT=10000
EnvironmentFile=/etc/masanawa-nowpayments-relay.env
ExecStart=/usr/bin/node /opt/masanawa/nowpayments-relay.js
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/masanawa-relay

[Install]
WantedBy=multi-user.target
UNIT

cat > /tmp/Caddyfile <<EOF
$RELAY_HOST {
  encode gzip
  reverse_proxy 127.0.0.1:10000
}
EOF

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -i /tmp/id_ed25519 root@"$TARGET_IP" 'bash -s' <<'REMOTE'
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nodejs caddy ca-certificates
install -d -m 0755 /opt/masanawa /var/lib/masanawa-relay
install -m 0644 /tmp/relay.js /opt/masanawa/nowpayments-relay.js 2>/dev/null || true
REMOTE

scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/id_ed25519 /tmp/relay.js root@"$TARGET_IP":/opt/masanawa/nowpayments-relay.js
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/id_ed25519 /tmp/relay.service root@"$TARGET_IP":/etc/systemd/system/masanawa-nowpayments-relay.service
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/id_ed25519 /tmp/Caddyfile root@"$TARGET_IP":/etc/caddy/Caddyfile

printf 'MASANAWA_NOWPAYMENTS_RELAY_TOKEN=%s\n' "$NOWPAYMENTS_RELAY_TOKEN" > /tmp/relay.env
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/id_ed25519 /tmp/relay.env root@"$TARGET_IP":/etc/masanawa-nowpayments-relay.env

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/id_ed25519 root@"$TARGET_IP" 'bash -s' <<'REMOTE'
set -eu
chown root:root /etc/masanawa-nowpayments-relay.env
chmod 600 /etc/masanawa-nowpayments-relay.env
chown root:root /opt/masanawa/nowpayments-relay.js
chmod 644 /opt/masanawa/nowpayments-relay.js
systemctl daemon-reload
systemctl enable --now masanawa-nowpayments-relay
systemctl restart caddy
sleep 2
systemctl is-active --quiet masanawa-nowpayments-relay
systemctl is-active --quiet caddy
curl -fsS https://${RELAY_HOST}/healthz
REMOTE
