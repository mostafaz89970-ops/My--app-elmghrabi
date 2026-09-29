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

            
            // 7.2 Customer Meter Movements (حركات عداد - MEEDCO)
            if (pathname === '/api/customer/movements' || pathname === '/api/customer-meter-movements') {
                const term = url.searchParams.get('term') || url.searchParams.get('code') || url.searchParams.get('customerId') || url.searchParams.get('q');
                const body = await getBody();
                const searchTerm = term || body.term || body.code || body.customerId || body.q;
                const result = await nativeEngine.getCustomerMeterMovements(searchTerm);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 7.3 Customer Receipt Payment PDF (إيصال السداد الرسمي MEEDCO)
            if (pathname === '/api/customer/receipt-pdf' || pathname === '/api/meedco/receipt-pdf') {
                const body = await getBody();
                const chargeId = url.searchParams.get('chargeId') || body.chargeId || url.searchParams.get('id') || body.id;
                const isThermal = (url.searchParams.get('isThermal') === 'true' || url.searchParams.get('thermal') === 'true' || body.isThermal === true || body.isThermalReciept === true);
                const result = await nativeEngine.getReceiptPDF(chargeId, isThermal);
                if (result && result.success && result.buffer) {
                    res.writeHead(200, {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'inline; filename="receipt-' + (chargeId || 'meedco') + '.pdf"',
                        'Content-Length': result.buffer.length,
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(result.buffer);
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify(result || { success: false, message: 'فشل استخراج ملف الإيصال' }));
                return;
            }

            // 7.4 Customer Meter Movements Statement PDF (تقرير حركات العداد الرسمي MEEDCO)
            if (pathname === '/api/customer/movements-pdf' || pathname === '/api/meedco/movements-pdf') {
                const body = await getBody();
                const customerId = url.searchParams.get('customerId') || body.customerId || url.searchParams.get('id') || body.id;
                const result = await nativeEngine.getCustomerMeterMovementsPDF(customerId);
                if (result && result.success && result.buffer) {
                    res.writeHead(200, {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'inline; filename="meter-movements-' + (customerId || 'meedco') + '.pdf"',
                        'Content-Length': result.buffer.length,
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(result.buffer);
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify(result || { success: false, message: 'فشل استخراج تقرير حركات العداد' }));
                return;
            }

            // 7.1 Search Customer by Chassis / Code
            if (pathname === '/api/customer/search' || pathname === '/api/customer-search') {
                const term = url.searchParams.get('term') || url.searchParams.get('q');
                const body = await getBody();
                const searchTerm = term || body.term || body.q;
                const result = await nativeEngine.searchCustomer(searchTerm);
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

            if (pathname === '/api/clear-control-card') {
                const result = await nativeEngine.clearControlCard();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/control-card/details/')) {
                const detailId = pathname.replace('/api/control-card/details/', '');
                const unifiedClient = require('./unifiedCardClient');
                const result = await unifiedClient.getControlCardDetailsLive(detailId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/tech-collect-card/read') {
                const unifiedClient = require('./unifiedCardClient');
                const result = await unifiedClient.readTechCollectCardLive();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/tech-collect-card/renew') {
                const unifiedClient = require('./unifiedCardClient');
                const body = await getBody();
                const result = await unifiedClient.renewTechCollectCardLive(body.cardId, body.generationType, body.vendorCode);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/tech-collect-card/details/')) {
                const detailId = pathname.replace('/api/tech-collect-card/details/', '');
                const unifiedClient = require('./unifiedCardClient');
                const result = await unifiedClient.getTechCollectCardDetailsLive(detailId);
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
                const resData = await nativeEngine.getCustomerDebts(custId);
                res.writeHead(200);
                res.end(JSON.stringify(resData));
                return;
            }

            if (pathname === '/api/debts/types' || pathname === '/api/debt-types') {
                const resData = await nativeEngine.getLiveDebtTypes();
                res.writeHead(200);
                res.end(JSON.stringify(resData));
                return;
            }

            if (pathname === '/api/debts/create' && req.method === 'POST') {
                const body = await getBody();
                const resData = await nativeEngine.createCustomerDebt(body);
                res.writeHead(200);
                res.end(JSON.stringify(resData));
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
                            const _d = new Date(); inst.payDate = `${_d.getDate()}/${String(_d.getMonth() + 1).padStart(2, '0')}/${_d.getFullYear()}`;
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

            if (pathname.startsWith('/api/debts/') && req.method === 'DELETE') {
                const debtId = decodeURIComponent(pathname.split('/').pop());
                const store = getDebtsStore();
                store.debts = store.debts.filter(d => String(d.id) !== String(debtId));
                saveDebtsStore(store);
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: 'تم حذف الدين بنجاح' }));
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
                if (req.method === 'POST') {
                    const body = await getBody();
                    store.cleaningExceptions = store.cleaningExceptions || [];
                    store.cleaningExceptions.push(body);
                    saveDebtsStore(store);
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'Saved exception', data: body }));
                    return;
                }
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
                const result = await nativeEngine.getSectorsDropdown();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/public-admins/')) {
                const sectorId = pathname.replace('/api/customers-dropdown/public-admins/', '');
                const result = await nativeEngine.getPublicAdminsDropdown(sectorId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/sub-admins/')) {
                const pubId = pathname.replace('/api/customers-dropdown/sub-admins/', '');
                const result = await nativeEngine.getSubAdminsDropdown(pubId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/regions/')) {
                const subId = pathname.replace('/api/customers-dropdown/regions/', '');
                const result = await nativeEngine.getRegionsDropdown(subId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/dailys/')) {
                const regId = pathname.replace('/api/customers-dropdown/dailys/', '');
                const result = await nativeEngine.getDailysDropdown(regId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/customers-dropdown/types') {
                const result = await nativeEngine.getCustomerTypesDropdown();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname.startsWith('/api/customers-dropdown/places/')) {
                const actId = pathname.replace('/api/customers-dropdown/places/', '');
                const result = await nativeEngine.getPlaceDescsDropdown(actId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // Customer Details Route
            if (pathname === '/api/customer/details' || pathname === '/api/customer-details') {
                const id = url.searchParams.get('id') || url.searchParams.get('code') || url.searchParams.get('meterNumber');
                const result = await nativeEngine.getCustomerDetails(id);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }
            
            // --- Direct MEEDCO Gateway Routes ---
            if (pathname === '/api/meedco/status') {
                const status = await nativeEngine.getMeedcoStatus();
                res.writeHead(200);
                res.end(JSON.stringify(status));
                return;
            }

            if (pathname === '/api/meedco/login' && req.method === 'POST') {
                const body = await getBody();
                const result = await nativeEngine.loginMeedco(body);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            if (pathname === '/api/meedco/hierarchy') {
                const sectorId = url.searchParams.get('sectorId');
                const publicAdminId = url.searchParams.get('publicAdminId');
                const result = await nativeEngine.getMeedcoHierarchy(sectorId, publicAdminId);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 11.9 Update Customer Sequence API (تسلسل العداد والنظام)
            if (pathname === '/api/customer/update-sequence' || pathname === '/api/customer-sequence/update') {
                const body = await getBody();
                const targetId = body.customerId || body.id || body.meterNumber || body.code || url.searchParams.get('id') || url.searchParams.get('meterNumber');
                const seqSys = body.chargeSequence || body.sequence || body.seqSys;
                const seqMeter = body.meterChargeSequence || body.sequenceOnMeter || body.seqMeter;
                const result = await nativeEngine.updateCustomerSequence(targetId, seqSys, seqMeter);
                res.writeHead(200);
                res.end(JSON.stringify(result));
                return;
            }

            // 12. Customers List & Filter API
            if (pathname === '/api/customers') {
                const body = await getBody();

                // If adding or updating customer
                if (body && (body.name || body.customerName) && !body.paginator && !body.filter) {
                    let customers = [];
                    try {
                        const custFile = path.join(__dirname, 'customers_store.json');
                        if (fs.existsSync(custFile)) {
                            customers = JSON.parse(fs.readFileSync(custFile, 'utf8'));
                        }
                    } catch (e) {
                        console.error('Error reading customers_store.json:', e);
                    }

                    let existingCust = customers.find(c => 
                        (body.id && String(c.id) === String(body.id)) ||
                        (body.code && String(c.code) === String(body.code)) ||
                        (body.meterNumber && String(c.meterNumber) === String(body.meterNumber))
                    );

                    if (existingCust) {
                        Object.assign(existingCust, body);
                        if (body.chargeSequence != null) existingCust.chargeSequence = Number(body.chargeSequence);
                        if (body.meterChargeSequence != null) {
                            existingCust.meterChargeSequence = Number(body.meterChargeSequence);
                            existingCust.sequenceOnMeter = Number(body.meterChargeSequence);
                            existingCust.chargeSequenceOnMeter = Number(body.meterChargeSequence);
                        }
                        existingCust.updatedAt = new Date().toISOString();
                        try {
                            fs.writeFileSync(path.join(__dirname, 'customers_store.json'), JSON.stringify(customers, null, 2), 'utf8');
                        } catch (e) {}

                        // Also sync with card store and MEEDCO if needed
                        if (body.meterChargeSequence != null || body.chargeSequence != null) {
                            await nativeEngine.updateCustomerSequence(
                                existingCust.meterNumber || existingCust.code,
                                existingCust.chargeSequence,
                                existingCust.meterChargeSequence
                            );
                        }

                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, message: 'تم تحديث بيانات المشترك ومسلسل العداد بنجاح', data: existingCust }));
                        return;
                    }

                    const newCust = {
                        id: 'CUST-' + (body.code || Date.now()),
                        code: body.code || ('050' + Math.floor(1000000 + Math.random() * 9000000)),
                        name: body.name || body.customerName,
                        identityNumber: body.identityNumber || body.nationalId || '',
                        nationalId: body.nationalId || body.identityNumber || '',
                        meterNumber: body.meterNumber || '',
                        meterChassisNumber: body.meterNumber || '',
                        address: body.address || '',
                        accountNumberReferenceCustomer: body.accountRefrence || body.accountRef || '',
                        accountRefrence: body.accountRefrence || body.accountRef || '',
                        sectorName: body.sectorName || 'المنيا شمال',
                        publicAdministrationName: body.publicAdministrationName || 'بنى مزار شرق',
                        subAdministrationName: body.subAdministrationName || 'بنى مزار شرق',
                        regionName: body.regionName || 'بنى مزار شرق10',
                        status: body.status || 'مركب',
                        customerType: body.customerType || 'صغار مشتركين',
                        activityName: body.activityName || 'استخدامات منزلية',
                        chargeSequence: Number(body.chargeSequence) || 1,
                        meterChargeSequence: Number(body.meterChargeSequence || body.chargeSequence) || 1,
                        sequenceOnMeter: Number(body.meterChargeSequence || body.chargeSequence) || 1,
                        contractYear: body.contractYear || '2026',
                        contractNumber: body.contractNumber || '100',
                        installationDate: new Date().toISOString().split('T')[0]
                    };
                    customers.unshift(newCust);
                    try {
                        fs.writeFileSync(path.join(__dirname, 'customers_store.json'), JSON.stringify(customers, null, 2), 'utf8');
                    } catch (e) {}

                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, message: 'تم تسجيل المشترك بنجاح في المنظومة', data: newCust }));
                    return;
                }

                // Call nativeEngine.getAllCustomers (MEEDCO Live + Authentic Local Store)
                const filter = body?.filter || {
                    meterNumber: url.searchParams.get('meterNumber') || '',
                    customerName: url.searchParams.get('customerName') || '',
                    customerCode: url.searchParams.get('code') || url.searchParams.get('customerCode') || '',
                    identityNumber: url.searchParams.get('identityNumber') || '',
                    contractNumber: url.searchParams.get('contractNumber') || '',
                    contractYear: url.searchParams.get('contractYear') || '',
                    accountRefrence: url.searchParams.get('accountRefrence') || '',
                    status: url.searchParams.get('status') || ''
                };
                const searchTerm = String(body?.searchTerm || url.searchParams.get('q') || url.searchParams.get('searchTerm') || '').trim();
                const page = Number(body?.paginator?.page || url.searchParams.get('page') || 1);
                const pageSize = Number(body?.paginator?.pageSize || url.searchParams.get('pageSize') || 10);
                const sorting = body?.sorting || { column: 'id', direction: 'desc' };

                const result = await nativeEngine.getAllCustomers({
                    filter,
                    paginator: { page, pageSize },
                    sorting,
                    searchTerm
                });

                res.writeHead(200);
                res.end(JSON.stringify(result));
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
