// به‌روزرسان اختصاصی یادنگار از GitHub Releases
// به جای شبکهٔ کرومیوم، با Node مستقیم وصل می‌شود (مثل برنامه‌های معمولی)
// و اگر ویندوز پروکسی (مثلاً فیلترشکن) تنظیم کرده باشد، از همان استفاده می‌کند.
const https = require("node:https");
const http = require("node:http");
const tls = require("node:tls");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const OWNER = "damoonartwork";
const REPO = "yadnegar";
const LATEST_YML = `https://github.com/${OWNER}/${REPO}/releases/latest/download/latest.yml`;
const UA = "Yadnegar-Updater";

/** "PROXY 127.0.0.1:10809; DIRECT" → { host, port } یا null */
function parseProxy(rule) {
  if (!rule) return null;
  const first = String(rule).split(";")[0].trim();
  const m = /^(?:PROXY|HTTPS)\s+([^:\s]+):(\d+)$/i.exec(first);
  return m ? { host: m[1], port: Number(m[2]) } : null;
}

/** ساخت تونل CONNECT از طریق پروکسی HTTP */
function tunnel(proxy, host, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: `${host}:443`,
      headers: { Host: `${host}:443`, "User-Agent": UA },
      timeout: timeoutMs,
    });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`proxy CONNECT ${res.statusCode}`));
        return;
      }
      resolve(socket);
    });
    req.on("timeout", () => req.destroy(new Error("proxy timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** یک درخواست GET با دنبال کردن ریدایرکت‌ها؛ پاسخ را به صورت stream برمی‌گرداند */
async function get(url, proxy, redirects = 0) {
  if (redirects > 8) throw new Error("too many redirects");
  const u = new URL(url);
  const options = {
    host: u.hostname,
    path: u.pathname + u.search,
    headers: { "User-Agent": UA, Accept: "*/*" },
    timeout: 30_000,
  };
  if (proxy) {
    const socket = await tunnel(proxy, u.hostname, 20_000);
    const agent = new https.Agent({ keepAlive: false });
    agent.createConnection = () => tls.connect({ socket, servername: u.hostname });
    options.agent = agent;
  }
  const res = await new Promise((resolve, reject) => {
    const req = https.get(options, resolve);
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
  });
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    return get(new URL(res.headers.location, url).toString(), proxy, redirects + 1);
  }
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`HTTP ${res.statusCode}`);
  }
  return res;
}

/** اول با پروکسی ویندوز (اگر هست)، بعد مستقیم؛ هر کدام جواب داد */
async function getWithFallback(url, proxy) {
  const routes = proxy ? [proxy, null] : [null];
  const errors = [];
  for (const r of routes) {
    try {
      return { res: await get(url, r), proxy: r };
    } catch (e) {
      errors.push(`${r ? "proxy" : "direct"}: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function readText(res) {
  const chunks = [];
  for await (const c of res) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

/** خواندن فایل latest.yml (فقط فیلدهای لازم) */
function parseLatestYml(text) {
  const pick = (k) => {
    const m = new RegExp(`^${k}:\\s*'?([^'\\n]+)'?\\s*$`, "m").exec(text);
    return m ? m[1].trim() : undefined;
  };
  const version = pick("version");
  const file = pick("path");
  const sha512 = pick("sha512");
  const sizeMatch = /^\s+size:\s*(\d+)/m.exec(text);
  if (!version || !file || !sha512) throw new Error("invalid latest.yml");
  return { version, file, sha512, size: sizeMatch ? Number(sizeMatch[1]) : 0 };
}

/** مقایسهٔ نسخه‌ها: 1.10.0 > 1.9.2 */
function isNewer(remote, local) {
  const a = remote.split(".").map((x) => parseInt(x, 10) || 0);
  const b = local.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function checkLatest({ proxyRule } = {}) {
  const proxy = parseProxy(proxyRule);
  const { res, proxy: used } = await getWithFallback(LATEST_YML, proxy);
  const info = parseLatestYml(await readText(res));
  return { ...info, proxy: used };
}

/** دانلود نصب‌کننده با گزارش پیشرفت و بررسی sha512 */
async function download(info, dir, { proxyRule, onProgress } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, info.file);
  const url = `https://github.com/${OWNER}/${REPO}/releases/download/v${info.version}/${encodeURIComponent(info.file)}`;
  const { res } = await getWithFallback(url, info.proxy !== undefined ? info.proxy : parseProxy(proxyRule));
  const total = Number(res.headers["content-length"]) || info.size || 0;
  const hash = crypto.createHash("sha512");
  const out = fs.createWriteStream(target + ".part");
  let received = 0;
  let lastPct = -1;
  for await (const chunk of res) {
    hash.update(chunk);
    received += chunk.length;
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    const pct = total ? Math.floor((received / total) * 100) : 0;
    if (pct !== lastPct) {
      lastPct = pct;
      onProgress && onProgress(pct);
    }
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
  if (hash.digest("base64") !== info.sha512) {
    fs.rmSync(target + ".part", { force: true });
    throw new Error("checksum mismatch");
  }
  fs.renameSync(target + ".part", target);
  return target;
}

module.exports = { checkLatest, download, isNewer, parseProxy, parseLatestYml };
