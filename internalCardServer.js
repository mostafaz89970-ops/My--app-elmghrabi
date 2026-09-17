/**
 * Internal Card Server - منظومة العدادات 2025
 * خادم محلي مدمج يعمل تلقائياً داخل التطبيق على المنفذ 5002
 * مستقل 100% بدون أي حاجة لأي تطبيق خارجي أو خدمة وسيطة
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const nativeEngine = require('./nativeCardEngine');

const debtsStorePath = path.join(__dirname, 'debts_store.json');

function getDebtsStore() {
    try {
        if (fs.existsSync(debtsStorePath)) {
            return JSON.parse(fs.readFileSync(debtsStorePath, 'utf8'));
        }
    } catch (e) {}
    return { debts: [], debtTypes: [], fees: [], cleaningExceptions: [], peakDebtSettings: {} };
}

function saveDebtsStore(data) {
    try {
        fs.writeFileSync(debtsStorePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

function startInternalServer(port = 5002) {
    const server = http.createServer(async (req, res) => {
        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const pathname = url.pathname;

        const getBody = () => new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body || '{}'));
                } catch (e) {
                    resolve({});
                }
            });
        });

        try {
            // 1. Status
            if (pathname === '/api/status' || pathname === '/') {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: 'Internal Standalone Card Engine is active', port }));
                return;
            }

            // 2. Read Customer Smart Card (Charging Page)
            if (pathname === '/api/customer-card/read' || pathname === '/api/read-customer-card') {
                const result = await nativeEngine.readCustomerCard();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 3. Write Charge to Customer Smart Card
            if (pathname === '/api/customer-card/write' || pathname === '/api/write-customer-card') {
                const body = await getBody();
                const result = await nativeEngine.writeCustomerCard(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 4. Clear Smart Card (حذف بيانات الكارت)
            if (pathname === '/api/customer-card/clear' || pathname === '/api/clear-smart-card') {
                const body = await getBody();
                const result = await nativeEngine.clearSmartCard(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 5. Replacement without charge (كارت بديل بدون شحن)
            if (pathname === '/api/customer-card/replacement-no-charge' || pathname === '/api/issue-replacement-without-charge') {
                const body = await getBody();
                const result = await nativeEngine.issueReplacementWithoutCharge(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 6. Replacement with charge (كارت بديل بشحن)
            if (pathname === '/api/customer-card/replacement-with-charge' || pathname === '/api/issue-replacement-with-charge') {
                const body = await getBody();
                const result = await nativeEngine.issueReplacementWithCharge(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 7. Customer Charging Details
            if (pathname.startsWith('/api/customer-charging/details/') || pathname.startsWith('/api/customer-charging-details')) {
                const custId = decodeURIComponent(pathname.split('/').pop().split('?')[0]);
                const result = await nativeEngine.getCustomerChargingDetails(custId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 8. General Read Smart Card
            if (pathname === '/api/read-smart-card' || pathname === '/api/read-card') {
                const result = await nativeEngine.readSmartCard();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 9. Control Card APIs
            if (pathname === '/api/read-control-card') {
                const result = await nativeEngine.readControlCard();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/renew-control-card') {
                const body = await getBody();
                const cardId = body.cardId || url.searchParams.get('cardId');
                const generationType = body.generationType || url.searchParams.get('generationType');
                const vendorCode = body.vendorCode || url.searchParams.get('vendorCode');
                const result = await nativeEngine.renewControlCard(cardId, generationType, vendorCode);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/control-card-metadata') {
                const result = await nativeEngine.getControlCardMetadata();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/meter-types') {
                const companyId = url.searchParams.get('companyId');
                const result = await nativeEngine.getMeterTypesForCompany(companyId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/issue-control-card') {
                const body = await getBody();
                const result = await nativeEngine.issueControlCard(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 10. Debts & Fees APIs
            if (pathname === '/api/debts') {
                const store = getDebtsStore();
                if (req.method === 'POST') {
                    const newDebt = await getBody();
                    if (!newDebt.id) newDebt.id = 'DEBT-' + Date.now().toString().slice(-6);
                    store.debts.unshift(newDebt);
                    saveDebtsStore(store);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'تم حفظ الدين بنجاح', data: newDebt }));
                    return;
                }
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: store.debts, count: store.debts.length }));
                return;
            }

            if (pathname.startsWith('/api/debts/customer/')) {
                const custId = decodeURIComponent(pathname.split('/').pop());
                const store = getDebtsStore();
                const debts = store.debts.filter(d => 
                    String(d.customerId) === custId || 
                    String(d.subscriptionCode) === custId || 
                    String(d.meterNumber) === custId
                );
                const totalRemaining = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
                const totalMonthlyInstallment = debts
                    .filter(d => d.status === 'PaymentInProgress' || d.status === 'مستحق فوري')
                    .reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0);
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    debts,
                    totalRemaining: Number(totalRemaining.toFixed(2)),
                    totalMonthlyInstallment: Number(totalMonthlyInstallment.toFixed(2))
                }));
                return;
            }

            if (pathname === '/api/debts/pay-installment' && req.method === 'POST') {
                const { debtId, amount, seq, receiptNumber } = await getBody();
                const store = getDebtsStore();
                const debt = store.debts.find(d => String(d.id) === String(debtId));
                if (debt) {
                    const payAmt = Number(amount) || Number(debt.installmentAmount);
                    debt.paidAmount = Number(((debt.paidAmount || 0) + payAmt).toFixed(2));
                    debt.remainingAmount = Number(Math.max(0, (debt.remainingAmount || 0) - payAmt).toFixed(2));
                    debt.paidInstallmentsCount = (debt.paidInstallmentsCount || 0) + 1;
                    if (debt.remainingAmount <= 0) {
                        debt.status = 'Completed';
                        debt.statusName = 'منتهي ومسدد بالكامل';
                    }
                    if (debt.installments && debt.installments.length > 0) {
                        const inst = debt.installments.find(i => (seq ? i.seq === seq : i.status !== 'مسدد'));
                        if (inst) {
                            inst.status = 'مسدد';
                            inst.paidAmount = payAmt;
                            inst.payDate = new Date().toLocaleDateString('ar-EG');
                            if (receiptNumber) inst.receiptNumber = receiptNumber;
                        }
                    }
                    saveDebtsStore(store);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'تم سداد القسط بنجاح', debt }));
                    return;
                }
                res.writeHead(404);
                res.end(JSON.stringify({ success: false, message: 'الدين غير موجود' }));
                return;
            }

            if (pathname === '/api/debts/delay' && req.method === 'POST') {
                const { debtId, newDueDate } = await getBody();
                const store = getDebtsStore();
                const debt = store.debts.find(d => String(d.id) === String(debtId));
                if (debt) {
                    debt.status = 'Delayed';
                    debt.statusName = 'مؤجل';
                    debt.nextDueDate = newDueDate || new Date(Date.now() + 30 * 86400000).toLocaleDateString('ar-EG');
                    saveDebtsStore(store);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'تم تأجيل الدين بنجاح', debt }));
                    return;
                }
                res.writeHead(404);
                res.end(JSON.stringify({ success: false, message: 'الدين غير موجود' }));
                return;
            }

            if (pathname === '/api/debt-types') {
                const store = getDebtsStore();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: store.debtTypes }));
                return;
            }

            if (pathname === '/api/fees') {
                const store = getDebtsStore();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: store.fees }));
                return;
            }

            if (pathname === '/api/cleaning-exceptions') {
                const store = getDebtsStore();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: store.cleaningExceptions }));
                return;
            }

            if (pathname === '/api/peak-debt-settings') {
                const store = getDebtsStore();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: store.peakDebtSettings }));
                return;
            }

            // 11. Dropdowns
            if (pathname === '/api/customers-dropdown/sectors') {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: [{ id: 1, name: "قطاع المنيا شمال" }] }));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/public-admins/')) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: [{ id: 1, name: "إدارة بني مزار" }] }));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/sub-admins/')) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: [{ id: 1, name: "فرع بني مزار شرق" }] }));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/regions/')) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: [{ id: 1, name: "المنطقة الأولى" }] }));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/dailys/')) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: [{ id: 1, name: "يومية 1" }] }));
                return;
            }

            if (pathname === '/api/customers') {
                const body = await getBody();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: "تم تسجيل المشترك بنجاح في المنظومة", data: body }));
                return;
            }

            // 404
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: 'Not found: ' + pathname }));

        } catch (err) {
            console.error('[InternalServer] Error processing request:', err);
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, message: 'Internal server error: ' + err.message }));
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[InternalServer] Port ${port} is already active, reusing running instance.`);
        } else {
            console.error('[InternalServer] Server error:', err);
        }
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`[InternalServer] Standalone Native Card Server running on http://127.0.0.1:${port}`);
    });

    return server;
}

module.exports = { startInternalServer };

if (require.main === module) {
    startInternalServer(5002);
}
