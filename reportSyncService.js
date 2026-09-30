const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');

const CACHE_DIR = path.join(__dirname, 'reports_cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * جلب تقرير مبيعات وشحنات المنظومة الموحدة (MEEDCO) لليوم المحدد
 */
async function fetchMeedcoDailySales(dateStr) {
    if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
    }

    const cacheFile = path.join(CACHE_DIR, `meedco_${dateStr}.json`);
    const unifiedClient = require('./unifiedCardClient');

    try {
        const token = await unifiedClient.ensureValidSession();
        const cfg = unifiedClient.getMeedcoConfig();

        const fromDate = `${dateStr}T00:00:00.000Z`;
        const toDate = `${dateStr}T23:59:59.999Z`;

        const payload = JSON.stringify({
            fromDate: fromDate,
            toDate: toDate,
            CustomerTypeIds: null,
            ProvinceIds: null,
            sectorIds: cfg.sectorId ? [cfg.sectorId] : [],
            publicAdminIds: cfg.publicAdminId ? [cfg.publicAdminId] : [],
            subAdminIds: cfg.subAdminId ? [cfg.subAdminId] : [],
            commercialSectorIds: null,
            purposesOfUseIds: null,
            regionIds: null,
            engineerCode: "",
            accountRefrence: "",
            SubscriptionTypesIds: null,
            activityIds: null,
            placeDescriptionIds: null,
            meterCompanyIds: null,
            meterIds: null,
            customerNumber: "",
            meterNumber: "",
            customerName: "",
            reChargeCenters: null,
            reportType: 1, // Total
            paymentType: null,
            userId: null,
            sectorIdsOnCharge: null,
            publicAdminIdsOnCharge: null
        });

        const options = {
            hostname: 'report-api-prod.meedco.cyuni.net',
            port: 443,
            path: '/ChargingReports/TotalSalesUserExcel',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Origin': 'https://report-prod.meedco.cyuni.net',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            rejectUnauthorized: false
        };

        const excelBuffer = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                if (res.statusCode !== 200) {
                    let errBody = '';
                    res.on('data', d => errBody += d);
                    res.on('end', () => reject(new Error(`MEEDCO HTTP ${res.statusCode}: ${errBody}`)));
                    return;
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });

        const tempExcelPath = path.join(CACHE_DIR, `temp_meedco_${dateStr}_${Date.now()}.xlsx`);
        fs.writeFileSync(tempExcelPath, excelBuffer);

        // تشغيل بارسر البايثون المعتمد
        const scriptPath = path.join(__dirname, 'parse_meedco_excel.py');
        const parsedResult = await new Promise((resolve, reject) => {
            execFile('python', [scriptPath, tempExcelPath], { maxBuffer: 1024 * 1024 * 50, encoding: 'utf8' }, (err, stdout, stderr) => {
                try { fs.unlinkSync(tempExcelPath); } catch (e) {}
                if (err) {
                    return reject(new Error('Python parse error: ' + (stderr || err.message)));
                }
                try {
                    const parsed = JSON.parse(stdout);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Failed to parse python JSON output: ' + e.message));
                }
            });
        });

        if (parsedResult && parsedResult.success) {
            parsedResult.fetchedAt = new Date().toISOString();
            fs.writeFileSync(cacheFile, JSON.stringify(parsedResult, null, 2), 'utf8');
            return parsedResult;
        } else {
            throw new Error((parsedResult && parsedResult.error) || 'Failed to extract MEEDCO report data');
        }

    } catch (err) {
        console.warn(`[ReportSync] MEEDCO live fetch failed for ${dateStr}:`, err.message);
        // Fallback to cache if exists
        if (fs.existsSync(cacheFile)) {
            try {
                const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                cached.isCached = true;
                return cached;
            } catch (e) {}
        }
        return { success: false, error: err.message, users: [] };
    }
}

function normalizeArabic(str) {
    if (!str) return '';
    return str
        .replace(/^(محاسب|المهندس|مهندس|أستاذ|استاذ|ا|م)\s*\/\s*/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
}

function isArabicMatch(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = normalizeArabic(name1);
    const n2 = normalizeArabic(name2);
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    const words1 = n1.split(' ').filter(w => w.length > 2);
    const words2 = n2.split(' ').filter(w => w.length > 2);
    const matchCount = words1.filter(w1 => words2.some(w2 => w1 === w2 || (w1.length > 3 && (w1.includes(w2) || w2.includes(w1))))).length;
    return matchCount >= 2;
}

/**
 * جلب تقرير معصرة (Maasara) لليوم المحدد
 */
async function fetchMaasaraDailySales(dateStr) {
    if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
    }
    const cacheFile = path.join(CACHE_DIR, `maasara_${dateStr}.json`);

    try {
        // 1. البحث عن كافة شيتات معصرة في مجلد التنزيلات أو الكاش
        const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\AL-Motahida', 'Downloads');
        const candidateFiles = [];

        if (fs.existsSync(downloadsDir)) {
            const files = fs.readdirSync(downloadsDir);
            for (const f of files) {
                if (f.toLowerCase().endsWith('.xlsx')) {
                    if (f.includes('مبيعات المستخدم') || f.includes('معصرة') || f.includes('maasara')) {
                        const full = path.join(downloadsDir, f);
                        try {
                            candidateFiles.push({ path: full, mtime: fs.statSync(full).mtimeMs, name: f });
                        } catch (e) {}
                    }
                }
            }
        }

        const directCacheExcel = path.join(CACHE_DIR, `maasara_${dateStr}.xlsx`);
        if (fs.existsSync(directCacheExcel)) {
            candidateFiles.unshift({ path: directCacheExcel, mtime: Date.now(), name: `maasara_${dateStr}.xlsx` });
        }

        if (candidateFiles.length > 0) {
            candidateFiles.sort((a, b) => b.mtime - a.mtime);
            const scriptPath = path.join(__dirname, 'parse_maasara_excel.py');
            const usersMap = new Map();
            let totalAmount = 0;
            let totalRecharges = 0;

            for (const cFile of candidateFiles) {
                const parsed = await new Promise((resolve) => {
                    execFile('python', [scriptPath, cFile.path], { maxBuffer: 1024 * 1024 * 20, encoding: 'utf8' }, (err, stdout) => {
                        if (err) return resolve(null);
                        try { resolve(JSON.parse(stdout)); } catch (e) { resolve(null); }
                    });
                });

                if (parsed && parsed.success && Array.isArray(parsed.users)) {
                    for (const u of parsed.users) {
                        const normKey = normalizeArabic(u.userName);
                        if (!usersMap.has(normKey)) {
                            usersMap.set(normKey, u);
                        } else {
                            // If existing has 0 count and this one has count > 0, update it
                            const exist = usersMap.get(normKey);
                            if ((!exist.rechargesCount || exist.rechargesCount === 0) && u.rechargesCount > 0) {
                                usersMap.set(normKey, u);
                            }
                        }
                    }
                }
            }

            const usersList = Array.from(usersMap.values());
            if (usersList.length > 0) {
                totalAmount = usersList.reduce((sum, u) => sum + (u.totalAmount || 0), 0);
                totalRecharges = usersList.reduce((sum, u) => sum + (u.rechargesCount || 0), 0);
                const finalResult = {
                    success: true,
                    connected: true,
                    totalUsers: usersList.length,
                    totalRecharges: totalRecharges,
                    totalAmount: Math.round(totalAmount * 100) / 100,
                    users: usersList,
                    fetchedAt: new Date().toISOString()
                };
                fs.writeFileSync(cacheFile, JSON.stringify(finalResult, null, 2), 'utf8');
                return finalResult;
            }
        }
    } catch (e) {
        console.warn(`[ReportSync] Maasara parse warning:`, e.message);
    }

    if (fs.existsSync(cacheFile)) {
        try {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } catch (e) {}
    }
    return { success: true, connected: false, users: [] };
}

/**
 * جلب تقرير إسكرا (Iskra) لليوم المحدد - اتصال حي وقراءة رسمية
 */
async function fetchIskraDailySales(dateStr) {
    if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
    }
    const cacheFile = path.join(CACHE_DIR, `iskra_${dateStr}.json`);

    try {
        // 1. تسجيل الدخول إلى منظومة إسكرا
        const loginPayload = JSON.stringify({
            userName: 'اشرف فتحى عبدالوهاب',
            password: '123456',
            stationId: 32,
            ignoreIP: 'true'
        });

        const loginRes = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '200.1.1.201',
                port: 8013,
                path: '/SPMeters/user/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Content-Length': Buffer.byteLength(loginPayload)
                },
                timeout: 4000
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const cookieHeader = res.headers['set-cookie'];
                        let sessionId = '';
                        if (cookieHeader) {
                            const match = cookieHeader.find(c => c.includes('JSESSIONID='));
                            if (match) {
                                sessionId = match.split(';')[0].trim();
                            }
                        }
                        try {
                            const userArr = JSON.parse(body);
                            const userId = userArr[0]?.userId || 3841;
                            resolve({ sessionId, userId });
                        } catch (e) {
                            resolve({ sessionId, userId: 3841 });
                        }
                    } else {
                        reject(new Error(`Iskra login failed HTTP ${res.statusCode}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Iskra connection timeout')); });
            req.write(loginPayload);
            req.end();
        });

        const { sessionId, userId } = loginRes;

        // 2. تشغيل تقرير مبيعات المستخدمين (Report 14)
        const reportPayload = JSON.stringify({
            reportId: 14,
            extention: 'XLSX',
            filters: [
                { name: 'FROM_DATE', jasperKey: 'FROM_DATE', value: dateStr },
                { name: 'TO_DATE', jasperKey: 'TO_DATE', value: dateStr },
                { name: 'STATION_IDS', jasperKey: 'STATION_IDS', value: '32' },
                { name: 'SECTOR_IDS', jasperKey: 'SECTOR_IDS', value: '5' }
            ]
        });

        const xlsxBuffer = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '200.1.1.201',
                port: 8013,
                path: '/SPMeters/api/report/execute',
                method: 'POST',
                headers: {
                    'Cookie': sessionId,
                    'userId': String(userId),
                    'stationIds': '32',
                    'stationIdsReports': '32',
                    'Content-Type': 'application/json;charset=UTF-8',
                    'Content-Length': Buffer.byteLength(reportPayload)
                },
                timeout: 8000
            }, (res) => {
                if (res.statusCode !== 200) {
                    let errBody = '';
                    res.on('data', d => errBody += d);
                    res.on('end', () => reject(new Error(`Iskra report HTTP ${res.statusCode}: ${errBody}`)));
                    return;
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Iskra execute report timeout')); });
            req.write(reportPayload);
            req.end();
        });

        // 3. حفظ ومعالجة ملف الإكسل عبر البارسر المعتمد
        const tempXlsxPath = path.join(CACHE_DIR, `temp_iskra_${dateStr}_${Date.now()}.xlsx`);
        fs.writeFileSync(tempXlsxPath, xlsxBuffer);

        const scriptPath = path.join(__dirname, 'parse_iskra_excel.py');
        const parsedResult = await new Promise((resolve, reject) => {
            execFile('python', [scriptPath, tempXlsxPath], { maxBuffer: 1024 * 1024 * 50, encoding: 'utf8' }, (err, stdout, stderr) => {
                try { fs.unlinkSync(tempXlsxPath); } catch (e) {}
                if (err) return reject(new Error('Python parse error: ' + (stderr || err.message)));
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error('Failed to parse Iskra JSON: ' + e.message));
                }
            });
        });

        if (parsedResult && parsedResult.success) {
            parsedResult.fetchedAt = new Date().toISOString();
            fs.writeFileSync(cacheFile, JSON.stringify(parsedResult, null, 2), 'utf8');
            return parsedResult;
        } else {
            throw new Error((parsedResult && parsedResult.error) || 'Failed to extract Iskra data');
        }

    } catch (err) {
        console.warn(`[ReportSync] Iskra fetch failed for ${dateStr}:`, err.message);
        if (fs.existsSync(cacheFile)) {
            try {
                const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                cached.isCached = true;
                return cached;
            } catch (e) {}
        }
        return { success: false, error: err.message, users: [] };
    }
}

/**
 * جلب الأرقام المحددة لمستخدم معين في يوم محدد لجميع البرامج
 */
async function getUserDailyPrograms(dateStr, targetUserName) {
    if (!targetUserName) return null;
    const cleanTarget = targetUserName.replace(/\s+/g, ' ').trim();

    // 1. MEEDCO
    let meedcoAmount = 0;
    let meedcoCount = 0;
    let meedcoItems = [];

    const meedcoData = await fetchMeedcoDailySales(dateStr);
    if (meedcoData && meedcoData.success && Array.isArray(meedcoData.users)) {
        const found = meedcoData.users.find(u => isArabicMatch(u.userName, cleanTarget));
        if (found) {
            meedcoAmount = found.totalAmount || 0;
            meedcoCount = found.rechargesCount || (found.items ? found.items.length : 0);
            meedcoItems = found.items || [];
        }
    }

    // 2. معصرة
    let maasaraAmount = 0;
    let maasaraCount = 0;
    const maasaraData = await fetchMaasaraDailySales(dateStr);
    if (maasaraData && Array.isArray(maasaraData.users)) {
        const found = maasaraData.users.find(u => isArabicMatch(u.userName, cleanTarget));
        if (found) {
            maasaraAmount = found.totalAmount || 0;
            maasaraCount = found.rechargesCount || 0;
        }
    }

    // 3. إسكرا
    let iskraAmount = 0;
    let iskraCount = 0;
    const iskraData = await fetchIskraDailySales(dateStr);
    if (iskraData && Array.isArray(iskraData.users)) {
        const found = iskraData.users.find(u => isArabicMatch(u.userName, cleanTarget));
        if (found) {
            iskraAmount = found.totalAmount || 0;
            iskraCount = found.rechargesCount || 0;
        }
    }

    return {
        date: dateStr,
        userName: targetUserName,
        unified: { amount: meedcoAmount, count: meedcoCount, itemsCount: meedcoItems.length },
        maasara: { amount: maasaraAmount, count: maasaraCount },
        iskra: { amount: iskraAmount, count: iskraCount },
        totalAmount: Math.round((meedcoAmount + maasaraAmount + iskraAmount) * 100) / 100,
        totalCount: meedcoCount + maasaraCount + iskraCount,
        meedcoItems: meedcoItems
    };
}

/**
 * التقرير الشامل والمفصل لجميع المستخدمين والمحصلين لليوم المحدد
 */
async function getComprehensiveDailyReport(dateStr) {
    if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
    }

    const [meedcoRes, maasaraRes, iskraRes] = await Promise.all([
        fetchMeedcoDailySales(dateStr),
        fetchMaasaraDailySales(dateStr),
        fetchIskraDailySales(dateStr)
    ]);

    // قراءة حافظات التوريد المسجلة في نفس اليوم
    let portfolios = [];
    const storePath = path.join(__dirname, 'supply_portfolios_store.json');
    try {
        if (fs.existsSync(storePath)) {
            portfolios = JSON.parse(fs.readFileSync(storePath, 'utf8')) || [];
        }
    } catch (e) {}

    const dayPortfolios = portfolios.filter(p => p.date === dateStr);

    // تجميع كافة المستخدمين الذين لديهم نشاط مع مطابقة ذكية
    const usersMap = new Map();

    const getOrCreateUser = (name) => {
        const cleanName = (name || '').replace(/\s+/g, ' ').trim();
        if (!cleanName) return null;
        
        for (const [key, val] of usersMap.entries()) {
            if (isArabicMatch(key, cleanName)) {
                return val;
            }
        }
        
        const newUser = {
            userName: cleanName,
            meedco: { amount: 0, count: 0, items: [] },
            maasara: { amount: 0, count: 0 },
            iskra: { amount: 0, count: 0 },
            other: { amount: 0, count: 0 },
            totalSystemsAmount: 0,
            totalRechargesCount: 0,
            cashSupplied: 0,
            portfoliosCount: 0,
            difference: 0,
            status: 'لم يتم التوريد'
        };
        usersMap.set(cleanName, newUser);
        return newUser;
    };

    // 1. إضافة بيانات MEEDCO
    if (meedcoRes && meedcoRes.success && Array.isArray(meedcoRes.users)) {
        meedcoRes.users.forEach(u => {
            const entry = getOrCreateUser(u.userName);
            if (entry) {
                entry.meedco.amount = u.totalAmount || 0;
                entry.meedco.count = u.rechargesCount || 0;
                entry.meedco.items = u.items || [];
            }
        });
    }

    // 2. إضافة بيانات معصرة
    if (maasaraRes && Array.isArray(maasaraRes.users)) {
        maasaraRes.users.forEach(u => {
            const entry = getOrCreateUser(u.userName);
            if (entry) {
                entry.maasara.amount = u.totalAmount || 0;
                entry.maasara.count = u.rechargesCount || 0;
            }
        });
    }

    // 3. إضافة بيانات إسكرا
    if (iskraRes && Array.isArray(iskraRes.users)) {
        iskraRes.users.forEach(u => {
            const entry = getOrCreateUser(u.userName);
            if (entry) {
                entry.iskra.amount = u.totalAmount || 0;
                entry.iskra.count = u.rechargesCount || 0;
            }
        });
    }

    // 4. مطابقة وتجميع مع حافظات التوريد الفعلية
    dayPortfolios.forEach(p => {
        const entry = getOrCreateUser(p.userName);
        if (entry) {
            entry.cashSupplied += Number(p.totalCash || 0);
            entry.portfoliosCount += 1;
            if (p.systems) {
                if (entry.maasara.amount === 0 && p.systems.maasara) {
                    entry.maasara.amount = Number(p.systems.maasara);
                }
                if (entry.iskra.amount === 0 && p.systems.iskra) {
                    entry.iskra.amount = Number(p.systems.iskra);
                }
                if (p.systems.other) {
                    entry.other.amount += Number(p.systems.other);
                }
            }
        }
    });

    // 5. حساب الإجماليات والفروقات والحالة
    let grandMeedcoAmount = 0;
    let grandMeedcoCount = 0;
    let grandMaasaraAmount = 0;
    let grandMaasaraCount = 0;
    let grandIskraAmount = 0;
    let grandIskraCount = 0;
    let grandSystemsAmount = 0;
    let grandTotalRecharges = 0;
    let grandCashSupplied = 0;
    let grandDifference = 0;

    const userList = Array.from(usersMap.values()).map(u => {
        u.totalSystemsAmount = Math.round((u.meedco.amount + u.maasara.amount + u.iskra.amount + u.other.amount) * 100) / 100;
        u.totalRechargesCount = u.meedco.count + u.maasara.count + u.iskra.count;
        u.difference = Math.round((u.cashSupplied - u.totalSystemsAmount) * 100) / 100;

        if (u.portfoliosCount === 0) {
            u.status = 'لم يتم التوريد';
        } else if (Math.abs(u.difference) < 0.01) {
            u.status = 'مطابق 100%';
        } else if (u.difference > 0) {
            u.status = 'زيادة توريد';
        } else {
            u.status = 'عجز توريد';
        }

        grandMeedcoAmount += u.meedco.amount;
        grandMeedcoCount += u.meedco.count;
        grandMaasaraAmount += u.maasara.amount;
        grandMaasaraCount += u.maasara.count;
        grandIskraAmount += u.iskra.amount;
        grandIskraCount += u.iskra.count;
        grandSystemsAmount += u.totalSystemsAmount;
        grandTotalRecharges += u.totalRechargesCount;
        grandCashSupplied += u.cashSupplied;
        grandDifference += u.difference;

        return u;
    });

    return {
        success: true,
        date: dateStr,
        summary: {
            totalUsersCount: userList.length,
            grandMeedcoAmount: Math.round(grandMeedcoAmount * 100) / 100,
            grandMeedcoCount: grandMeedcoCount,
            grandMaasaraAmount: Math.round(grandMaasaraAmount * 100) / 100,
            grandMaasaraCount: grandMaasaraCount,
            grandIskraAmount: Math.round(grandIskraAmount * 100) / 100,
            grandIskraCount: grandIskraCount,
            grandSystemsAmount: Math.round(grandSystemsAmount * 100) / 100,
            grandTotalRecharges: grandTotalRecharges,
            grandCashSupplied: Math.round(grandCashSupplied * 100) / 100,
            grandDifference: Math.round(grandDifference * 100) / 100
        },
        users: userList
    };
}

module.exports = {
    fetchMeedcoDailySales,
    fetchMaasaraDailySales,
    fetchIskraDailySales,
    getUserDailyPrograms,
    getComprehensiveDailyReport
};
