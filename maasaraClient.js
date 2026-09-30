/**
 * maasaraClient.js
 * عميل الاتصال الآلي المباشر بمنظومة المعصرة (http://200.1.1.240:5050)
 * يعمل تلقائياً بالكامل في الخلفية لجلب مبيعات وشحنات المحصلين حسب التاريخ
 * يماثل تماماً آلية عمل المنظومة الموحدة (MEEDCO)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG_FILE = path.join(__dirname, 'maasara_config.json');
const CACHE_DIR = path.join(__dirname, 'reports_cache');
const MAASARA_HOST = '200.1.1.240';
const MAASARA_PORT = 5050;

if (!fs.existsSync(CACHE_DIR)) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}
}

let _session = {
    cookieJar: {},
    validUntil: 0
};

function getMaasaraConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        sectorId: '8',
        departmentId: '526',
        userId: 'سناء عبدالستار عبدالعزيز',
        password: '13@1991'
    };
}

function saveMaasaraConfig(cfg) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function httpReq(options, postBody, retryCount = 1) {
    return new Promise((resolve, reject) => {
        const reqOpts = {
            hostname: MAASARA_HOST,
            port: MAASARA_PORT,
            method: options.method || 'GET',
            path: options.path,
            headers: {
                'Host': `${MAASARA_HOST}:${MAASARA_PORT}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': options.accept || '*/*',
                'Connection': 'close',
                ...(options.headers || {})
            },
            timeout: 20000
        };
        if (postBody) {
            reqOpts.headers['Content-Type'] = options.contentType || 'application/json';
            reqOpts.headers['Content-Length'] = Buffer.byteLength(postBody);
        }
        const req = http.request(reqOpts, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on('error', (err) => {
            if (retryCount > 0) {
                setTimeout(() => {
                    httpReq(options, postBody, retryCount - 1).then(resolve).catch(reject);
                }, 500);
            } else {
                reject(err);
            }
        });
        req.on('timeout', () => {
            req.destroy();
            if (retryCount > 0) {
                setTimeout(() => {
                    httpReq(options, postBody, retryCount - 1).then(resolve).catch(reject);
                }, 500);
            } else {
                reject(new Error('Maasara request timeout'));
            }
        });
        if (postBody) req.write(postBody);
        req.end();
    });
}

function extractToken(html) {
    const m = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) ||
              html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/);
    return m ? m[1] : null;
}

function updateCookieJar(setCookieHeaders) {
    if (!setCookieHeaders) return;
    setCookieHeaders.forEach(c => {
        if (c.includes('01-Jan-1970')) {
            const name = c.split('=')[0].trim();
            delete _session.cookieJar[name];
            return;
        }
        const part = c.split(';')[0].trim();
        const idx = part.indexOf('=');
        if (idx > -1) {
            _session.cookieJar[part.slice(0, idx)] = part.slice(idx + 1);
        }
    });
}

function getCookieString() {
    return Object.entries(_session.cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * تسجيل الدخول لمنظومة المعصرة والحصول على كوكي الجلسة
 */
async function ensureSession(forceFresh = false) {
    if (!forceFresh && _session.validUntil > Date.now() && _session.cookieJar['.AspNet.ApplicationCookie']) {
        return getCookieString();
    }

    const cfg = getMaasaraConfig();
    const loginPage = await httpReq({ path: '/Account/Login', method: 'GET', accept: 'text/html' });
    updateCookieJar(loginPage.headers['set-cookie']);

    const token = extractToken(loginPage.body);
    if (!token) {
        throw new Error('تعذر استخراج رمز الحماية من صفحة تسجيل الدخول للمعصرة');
    }

    const formParams = new URLSearchParams({
        __RequestVerificationToken: token,
        SectorId: String(cfg.sectorId || '8'),
        DepartmentId: String(cfg.departmentId || '526'),
        UserName: String(cfg.userId || 'سناء عبدالستار عبدالعزيز'),
        Password: String(cfg.password || '13@1991'),
        RememberMe: 'false'
    }).toString();

    const loginResp = await httpReq({
        path: '/Account/Login',
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        headers: {
            'Cookie': getCookieString(),
            'Referer': `http://${MAASARA_HOST}:${MAASARA_PORT}/Account/Login`
        }
    }, formParams);

    updateCookieJar(loginResp.headers['set-cookie']);

    if (!_session.cookieJar['.AspNet.ApplicationCookie']) {
        throw new Error('فشل تسجيل الدخول لمنظومة المعصرة - تحقق من صحة البيانات في maasara_config.json');
    }

    // الجلسة صالحة لمدة 60 دقيقة
    _session.validUntil = Date.now() + 60 * 60 * 1000;
    console.log('[Maasara] Login successful, session established.');
    return getCookieString();
}

/**
 * جلب تقرير مبيعات وشحنات المعصرة لليوم المحدد آلياً
 * @param {string} dateStr صيغة YYYY-MM-DD
 */
async function fetchDailyReport(dateStr) {
    if (!dateStr || dateStr.toLowerCase() === 'all') {
        dateStr = new Date().toISOString().slice(0, 10);
    }

    const cacheFile = path.join(CACHE_DIR, `maasara_${dateStr}.json`);

    try {
        let authCookie = await ensureSession();

        const fromDate = `${dateStr}T00:00:00.000Z`;
        const toDate = `${dateStr}T23:59:59.999Z`;

        const payload = JSON.stringify({
            Page: 1,
            Sort: '',
            ItemsPerPage: '1000',
            SearchType: '1',
            FromDate: fromDate,
            ToDate: toDate,
            IsPrepeared: '2'
        });

        let repResp = await httpReq({
            path: '/Contract/GetAllCustomersRechargeReportWithPointOfSaleTotally',
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'Cookie': authCookie,
                'Referer': `http://${MAASARA_HOST}:${MAASARA_PORT}/Reports/CustomersRechargesTotalPaymentByUser`
            }
        }, payload);

        // إذا كانت الجلسة منتهية (302 redirect أو خطأ)، أعد تسجيل الدخول مرة أخرى
        if (repResp.status === 302 || repResp.status === 401 || (repResp.body && repResp.body.includes('/Account/Login'))) {
            console.log('[Maasara] Session expired, re-authenticating...');
            authCookie = await ensureSession(true);
            repResp = await httpReq({
                path: '/Contract/GetAllCustomersRechargeReportWithPointOfSaleTotally',
                method: 'POST',
                contentType: 'application/json',
                headers: {
                    'Cookie': authCookie,
                    'Referer': `http://${MAASARA_HOST}:${MAASARA_PORT}/Reports/CustomersRechargesTotalPaymentByUser`
                }
            }, payload);
        }

        const data = JSON.parse(repResp.body);
        if (data && data.Success && data.Result && Array.isArray(data.Result.Items)) {
            const rawItems = data.Result.Items;
            const users = rawItems.map(it => {
                const totalAmt = Math.round((Number(it.TotalAmount) || 0) * 100) / 100;
                const netAmt = Math.round((Number(it.NetAmount) || 0) * 100) / 100;
                const count = Number(it.RechargesCount) || 0;
                return {
                    userName: (it.OrderCreator || '').trim(),
                    totalAmount: totalAmt,
                    netAmount: netAmt,
                    rechargesCount: count,
                    branch: it.PointOfSaleName || 'بنى مزار شرق',
                    items: [{
                        paymentDate: dateStr,
                        amount: totalAmt,
                        netAmount: netAmt,
                        rechargesCount: count,
                        branch: it.PointOfSaleName || 'بنى مزار شرق'
                    }]
                };
            }).filter(u => u.userName && u.totalAmount > 0);

            const totalAmount = Math.round(users.reduce((s, u) => s + u.totalAmount, 0) * 100) / 100;
            const totalRecharges = users.reduce((s, u) => s + u.rechargesCount, 0);

            const result = {
                success: true,
                connected: true,
                targetDate: dateStr,
                totalUsers: users.length,
                totalRecharges: totalRecharges,
                totalAmount: totalAmount,
                users: users,
                fetchedAt: new Date().toISOString()
            };

            // حفظ في الكاش
            try {
                fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf8');
            } catch (e) {}

            return result;
        } else {
            console.warn('[Maasara] API returned unhandled data format:', data);
        }
    } catch (err) {
        console.warn(`[Maasara] Live fetch failed for date ${dateStr}: ${err.message}`);
    }

    // fallback للكاش المحلي إذا تعذر الاتصال المباشر
    if (fs.existsSync(cacheFile)) {
        try {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            cached.isCached = true;
            return cached;
        } catch (e) {}
    }

    return {
        success: false,
        connected: false,
        targetDate: dateStr,
        totalUsers: 0,
        totalRecharges: 0,
        totalAmount: 0,
        users: []
    };
}

module.exports = {
    getMaasaraConfig,
    saveMaasaraConfig,
    ensureSession,
    fetchDailyReport
};
