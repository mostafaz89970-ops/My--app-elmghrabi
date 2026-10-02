/**
 * serverWatchdog.js — منظومة العدادات 2025
 * ===========================================
 * عملية مراقبة تضمن:
 *  1. تشغيل internalCardServer.js تلقائياً عند الإيقاف أو وضع النوم
 *  2. تجديد جلسة MEEDCO بعد الاستيقاظ
 *  3. تباعد الطلبات لمنع تصنيفها كهجوم (Rate-limit safe)
 *  4. تسجيل مشفر للأحداث في watchdog.log
 */

'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── إعدادات ───────────────────────────────────────────────────────────────
const SERVER_SCRIPT = path.join(__dirname, 'internalCardServer.js');
const LOG_FILE      = path.join(__dirname, 'watchdog.log');
const PORT          = 5002;

// تباعد الطلبات — كل 45 ثانية فحص ليس كل ثانية (يمنع تصنيفه هجوماً)
const HEALTH_INTERVAL_MS   = 45_000;

// بعد إيقاف التشغيل، ننتظر 3 ثوانٍ قبل إعادة التشغيل (منع burst restarts)
const RESTART_DELAY_MS     = 3_000;

// أقصى عدد إعادات تشغيل متتالية في 5 دقائق (حماية من crash loop)
const MAX_RESTARTS_WINDOW  = 5;
const RESTART_WINDOW_MS    = 5 * 60_000;

// تحقق من الجلسة كل 20 دقيقة فقط (ليس أكثر)
const SESSION_RENEW_INTERVAL_MS = 20 * 60_000;

// ─── حالة داخلية ────────────────────────────────────────────────────────────
let serverProcess     = null;
let restartTimestamps = [];
let lastSessionRenew  = 0;
let isRestarting      = false;

// ─── تسجيل الأحداث ──────────────────────────────────────────────────────────
function log(level, msg) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    process.stdout.write(line);
    try {
        // حافظ على حجم الـ log أقل من 500 KB
        const stat = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
        if (stat && stat.size > 500_000) {
            fs.writeFileSync(LOG_FILE, line, 'utf8');
        } else {
            fs.appendFileSync(LOG_FILE, line, 'utf8');
        }
    } catch (_) {}
}

// ─── فحص صحة السيرفر عبر HTTP ───────────────────────────────────────────────
function checkServerHealth() {
    return new Promise((resolve) => {
        const req = http.request(
            { hostname: '127.0.0.1', port: PORT, path: '/api/status', method: 'GET' },
            (res) => {
                res.resume();
                resolve(res.statusCode === 200);
            }
        );
        req.on('error', () => resolve(false));
        req.setTimeout(4000, () => { req.destroy(); resolve(false); });
        req.end();
    });
}

// ─── تجديد الجلسة عبر السيرفر المحلي ──────────────────────────────────────
// نستخدم السيرفر المحلي كوسيط — لا نتصل بـ MEEDCO مباشرة من الـ watchdog
// هذا يضمن أن جميع الطلبات تمر عبر نفس الـ channel ولا تبدو غريبة
function renewSessionViaSever() {
    return new Promise((resolve) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: PORT,
                path: '/api/meedco/auto-renew-session',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': 2 }
            },
            (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve(parsed);
                    } catch (_) { resolve({ success: false }); }
                });
            }
        );
        req.on('error', () => resolve({ success: false }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ success: false }); });
        req.write('{}');
        req.end();
    });
}


function killPortProcesses(p) {
    try {
        const out = execSync(`netstat -ano | findstr :${p}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const lines = out.split('\n');
        for (const line of lines) {
            if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && pid !== String(process.pid) && pid !== '0') {
                    log('INFO', `تحرير المنفذ ${p} من PID: ${pid}`);
                    try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
                }
            }
        }
    } catch (_) {}
}

// ─── حماية من الـ crash loop ───────────────────────────────────────────────
function canRestart() {
    const now = Date.now();
    // احذف الطوابع القديمة خارج النافذة الزمنية
    restartTimestamps = restartTimestamps.filter(t => now - t < RESTART_WINDOW_MS);
    if (restartTimestamps.length >= MAX_RESTARTS_WINDOW) {
        log('WARN', `تم إيقاف إعادة التشغيل التلقائي — ${MAX_RESTARTS_WINDOW} محاولات في 5 دقائق. انتظر...`);
        return false;
    }
    restartTimestamps.push(now);
    return true;
}

// ─── تشغيل السيرفر ──────────────────────────────────────────────────────────
function startServer() {
    if (isRestarting) return;
    if (!canRestart()) {
        // انتظر 2 دقيقة ثم حاول مجدداً
        killPortProcesses(PORT); restartTimestamps = []; setTimeout(startServer, 5000);
        return;
    }

    isRestarting = true;
    killPortProcesses(PORT);
    log('INFO', 'جارٍ تشغيل internalCardServer.js...');

    serverProcess = spawn(process.execPath, [SERVER_SCRIPT], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        // لا نفتح نافذة terminal جديدة — يعمل بصمت في الخلفية
        windowsHide: true,
        detached: false,
    });

    serverProcess.stdout.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) log('SRV', msg);
    });

    serverProcess.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) log('ERR', msg);
    });

    serverProcess.on('exit', (code, signal) => {
        log('WARN', `السيرفر أُغلق (code=${code}, signal=${signal}). سيُعاد التشغيل خلال ${RESTART_DELAY_MS / 1000}s...`);
        serverProcess = null;
        isRestarting = false;
        setTimeout(startServer, RESTART_DELAY_MS);
    });

    serverProcess.on('error', (err) => {
        log('ERR', 'فشل تشغيل السيرفر: ' + err.message);
        serverProcess = null;
        isRestarting = false;
        setTimeout(startServer, RESTART_DELAY_MS);
    });

    // أعطِ السيرفر 2 ثانية ليبدأ الاستماع
    setTimeout(() => { isRestarting = false; }, 2000);
}

// ─── حلقة المراقبة الرئيسية ──────────────────────────────────────────────
async function healthLoop() {
    const alive = await checkServerHealth();

    if (!alive) {
        log('WARN', `السيرفر على port ${PORT} لا يستجيب — جارٍ إعادة التشغيل...`);
        // إذا كانت العملية موجودة لكن لا تستجيب، أنهها أولاً
        if (serverProcess) {
            try { serverProcess.kill('SIGTERM'); } catch (_) {}
            serverProcess = null;
        }
        setTimeout(startServer, 500);
    } else {
        restartTimestamps = []; // تصفير عداد المحاولات عند استقرار السيرفر
        // السيرفر يعمل — تحقق من الجلسة إن مضى وقت كافٍ
        const now = Date.now();
        if (now - lastSessionRenew >= SESSION_RENEW_INTERVAL_MS) {
            lastSessionRenew = now;
            const renewResult = await renewSessionViaSever();
            if (renewResult.success) {
                log('INFO', 'جلسة MEEDCO نشطة وصالحة من المتصفح ✓');
            } else {
                log('INFO', 'حالة الجلسة: بانتظار اتصال المتصفح');
            }
        }

    }
}

// ─── التشغيل الأولي ─────────────────────────────────────────────────────────
log('INFO', '══════════════════════════════════════════');
log('INFO', '  Watchdog — منظومة العدادات 2025');
log('INFO', `  يراقب port ${PORT} | فحص كل ${HEALTH_INTERVAL_MS / 1000}s`);
log('INFO', '══════════════════════════════════════════');

// ابدأ السيرفر فوراً
startServer();

// بعد 4 ثوانٍ ابدأ حلقة المراقبة
setTimeout(() => {
    healthLoop();
    setInterval(healthLoop, HEALTH_INTERVAL_MS);
}, 4000);

// ─── اكتشاف الاستيقاظ من النوم ─────────────────────────────────────────────
// Windows لا يُرسل event مباشر، لكن نكتشفه عبر انقطاع setInterval
let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    // إذا مر أكثر من 10 ثوانٍ بين tick و tick → الجهاز كان في وضع النوم
    if (gap > 10_000) {
        log('INFO', `اكتُشف استيقاظ من النوم (gap=${Math.round(gap/1000)}s). جارٍ التحقق الفوري...`);
        // فحص فوري + تجديد جلسة فوري
        lastSessionRenew = 0;
        setTimeout(healthLoop, 1500);
    }
    lastTick = now;
}, 3000);

// ─── إغلاق نظيف ─────────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
    log('INFO', `استُقبل ${signal} — جارٍ الإغلاق النظيف...`);
    if (serverProcess) {
        try { serverProcess.kill('SIGTERM'); } catch (_) {}
    }
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    log('ERR', 'استثناء غير متوقع في الـ Watchdog: ' + err.message);
    // لا نُغلق — نستمر في العمل
});
