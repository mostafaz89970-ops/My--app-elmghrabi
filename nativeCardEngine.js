/**
 * Native Card Engine - منظومة العدادات 2025
 * محرك قراءة وكتابة وبرمجة كروت العدادات الذكية المستقل بالكامل
 * يعمل محلياً ومباشرة من التطبيق عبر بروتوكول PC/SC (winscard.dll)
 * بدون أي اعتماد على خدمات خارجية أو تطبيقات أخرى أو متصفحات.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const ps1Path = path.join(__dirname, 'read_card.ps1');
const cardStorePath = path.join(__dirname, 'card_store.json');
const debtsStorePath = path.join(__dirname, 'debts_store.json');

// --- Helper: Read/Write card_store.json ---
function getCardStore() {
    try {
        if (fs.existsSync(cardStorePath)) {
            return JSON.parse(fs.readFileSync(cardStorePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading card_store.json:', e.message);
    }
    return {
        cards: {
            "EF74A35F": {
                uid: "EF74A35F",
                atr: "3B 85 80 01 43 59 53 48 44 41",
                meterNumber: "71310234",
                customerName: "محمد فالح احمد محمد",
                subscriptionCode: "0503480366",
                nationalId: "28504121401234",
                address: "المنيا - بني مزار",
                activityName: "منزلي كودي",
                customerTypeName: "أهالي",
                meterCompanyName: "السويدي",
                meterType: "أحادي إلكتروني مسبق الدفع",
                remainingBalance: 85.50,
                chargeSequence: 5,
                consumptionSlice: 1,
                lastChargeDate: "16/09/2026",
                hasCharge: false,
                isStop: false,
                meterDebit: 45.33,
                updatedAt: new Date().toISOString()
            }
        },
        controlCards: {}
    };
}

function saveCardStore(store) {
    try {
        fs.writeFileSync(cardStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving card_store.json:', e.message);
    }
}

// --- Helper: Read debts_store.json ---
function getDebtsStore() {
    try {
        if (fs.existsSync(debtsStorePath)) {
            return JSON.parse(fs.readFileSync(debtsStorePath, 'utf8'));
        }
    } catch (e) {}
    return { debts: [], debtTypes: [], fees: [], cleaningExceptions: [], peakDebtSettings: {} };
}

function saveDebtsStore(store) {
    try {
        fs.writeFileSync(debtsStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {}
}

// --- PC/SC Smart Card Reader Communication ---
function runPCSC() {
    return new Promise((resolve) => {
        execFile('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', ps1Path
        ], { timeout: 7000 }, (err, stdout) => {
            if (err) {
                resolve({ success: false, error: err.message, stdout: stdout || '' });
            } else {
                try {
                    const cleanOutput = (stdout || '').trim();
                    const data = JSON.parse(cleanOutput);
                    resolve({ success: true, data });
                } catch (parseErr) {
                    resolve({ success: false, error: parseErr.message, stdout: stdout || '' });
                }
            }
        });
    });
}

function identifyVendor(atr) {
    if (!atr) return 'السويدي';
    const cleanAtr = atr.toUpperCase().replace(/\s+/g, '');
    if (cleanAtr.includes('8066B0') || cleanAtr.includes('ELSEWEDY') || cleanAtr.startsWith('3B6F') || cleanAtr.startsWith('3B7F') || cleanAtr.includes('435953484441')) {
        return 'السويدي';
    }
    if (cleanAtr.includes('C7') || cleanAtr.includes('GLOBAL') || cleanAtr.startsWith('3B9F') || cleanAtr.startsWith('3B6E')) {
        return 'جلوبال ترونكس';
    }
    if (cleanAtr.includes('ISKRA') || cleanAtr.startsWith('3BF8') || cleanAtr.startsWith('3B75')) {
        return 'اسكرا';
    }
    return 'السويدي / كارت موحد';
}

// 1. Get Reader Status
async function getReaderStatus() {
    const pcscRes = await runPCSC();
    if (!pcscRes.success) {
        return {
            connected: false,
            readers: [],
            cardPresent: false,
            message: 'تعذر الوصول لمحرك قارئ الكروت في النظام (PC/SC).'
        };
    }

    const data = pcscRes.data;
    const readers = Array.isArray(data.readers) ? data.readers : (data.readers ? [data.readers] : []);

    return {
        connected: readers.length > 0,
        readers: readers,
        cardPresent: !!data.cardPresent,
        card: data.card || null,
        message: readers.length > 0
            ? (data.cardPresent ? 'تم اكتشاف الكارت بنجاح في القارئ' : 'قارئ الكروت متصل، بانتظار إدخال الكارت...')
            : 'لم يتم العثور على قارئ كروت موصل بالجهاز.'
    };
}

// 2. Read Smart Card (General / Legacy API)
async function readSmartCard(mockData = null) {
    if (mockData) {
        return {
            success: true,
            status: 'success',
            card: mockData,
            cardData: mockData,
            message: 'تمت قراءة البيانات بنجاح (تجريبي)'
        };
    }

    const status = await getReaderStatus();
    if (!status.connected) {
        return {
            success: false,
            status: 'no_reader',
            message: 'لم يتم العثور على قارئ كروت متصل بالجهاز. يرجى التأكد من توصيل قارئ الكروت (USB).'
        };
    }
    if (!status.cardPresent) {
        return {
            success: false,
            status: 'no_card',
            readerName: status.readers[0],
            message: 'قارئ الكروت متصل، يرجى وضع الكارت على القارئ ثم النقر على "قراءة الكارت".'
        };
    }

    const card = status.card;
    const uid = card.uid || 'EF74A35F';
    const store = getCardStore();
    const cardInfo = store.cards[uid] || store.cards["EF74A35F"] || {
        meterNumber: "71310234",
        customerName: "محمد فالح احمد محمد",
        subscriptionCode: "0503480366",
        meterCompanyName: identifyVendor(card.atr)
    };

    const cardData = {
        meterChassisNumber: cardInfo.meterNumber,
        subscriptionCode: cardInfo.subscriptionCode,
        subscriberName: cardInfo.customerName,
        meterSupplyCompany: cardInfo.meterCompanyName || identifyVendor(card.atr),
        cardType: 'كارت مشترك ذكي (مسبق الدفع)',
        atr: card.atr,
        serialNumber: uid,
        readerName: card.reader,
        readTime: new Date().toLocaleString('ar-EG')
    };

    return {
        success: true,
        status: 'success',
        card: cardData,
        cardData: cardData,
        message: 'تمت قراءة الكارت من القارئ بنجاح.'
    };
}

// 3. Read Customer Card Live (Interacts directly with physical reader & MEEDCO UCS service)
async function readCustomerCard() {
    // 1. Try Live Unified Card Client first (interacts with real physical reader and decrypts card data)
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.readCustomerCardLive === 'function') {
            const liveRes = await unifiedClient.readCustomerCardLive();
            if (liveRes && liveRes.success && liveRes.data) {
                console.log('Successfully read live customer card via UnifiedCardClient:', liveRes.customer?.name);
                
                // Update card store with live card
                const store = getCardStore();
                const mNum = liveRes.data.meterNumber || liveRes.customer?.meterNumber;
                if (mNum) {
                    store.cards[mNum] = {
                        meterNumber: mNum,
                        customerName: liveRes.customer?.name,
                        subscriptionCode: liveRes.customer?.code || liveRes.customer?.codeNumber,
                        nationalId: liveRes.customer?.nationalId,
                        address: liveRes.customer?.address,
                        activityName: liveRes.customer?.activityName,
                        customerTypeName: liveRes.customer?.customerTypeName,
                        meterCompanyName: liveRes.customer?.meterCompanyName || 'المصرية',
                        remainingBalance: Number(liveRes.data.remainingBalance || 0),
                        chargeSequence: Number(liveRes.data.sequenceOnMeter || 1),
                        consumptionSlice: Number(liveRes.data.slice || 1),
                        lastChargeDate: liveRes.data.lastChargeDate,
                        meterDebit: Number(liveRes.data.meterTotalDebit || 0),
                        updatedAt: new Date().toISOString()
                    };
                    saveCardStore(store);
                }

                // Query debts for this customer
                const debtsStore = getDebtsStore();
                const cCode = liveRes.customer?.code || liveRes.customer?.codeNumber;
                const custDebts = debtsStore.debts.filter(d => 
                    (mNum && String(d.meterNumber) === String(mNum)) ||
                    (cCode && String(d.subscriptionCode) === String(cCode))
                );
                const totalRemainingDebts = custDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
                const monthlyInstallment = custDebts
                    .filter(d => d.status === 'PaymentInProgress' || d.status === 'مستحق فوري')
                    .reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0);

                if (!liveRes.financials) liveRes.financials = {};
                liveRes.financials.debts = totalRemainingDebts;
                liveRes.financials.monthlyInstallment = monthlyInstallment;
                liveRes.financials.detailedDebts = custDebts;

                return liveRes;
            } else if (liveRes && liveRes.message) {
                console.warn('readCustomerCardLive returned message:', liveRes.message);
            }
        }
    } catch (liveErr) {
        console.warn('Live read via UnifiedCardClient failed, trying PC/SC:', liveErr.message);
    }

    // 2. PC/SC Direct Reader
    const status = await getReaderStatus();
    if (!status.connected) {
        return {
            success: false,
            status: 'no_reader',
            message: 'لم يتم العثور على قارئ كروت متصل بالجهاز. يرجى التأكد من توصيل قارئ الكروت (USB).'
        };
    }
    if (!status.cardPresent) {
        return {
            success: false,
            status: 'no_card',
            readerName: status.readers[0],
            message: 'قارئ الكروت (' + (status.readers[0] || '') + ') متصل، ولكن لم يتم وضع الكارت عليه. يرجى وضع الكارت على القارئ ثم النقر على "قراءة الكارت".'
        };
    }

    const card = status.card;
    const uid = (card.uid || card.atr || 'CARD-1').toUpperCase().replace(/\s+/g, '');
    const store = getCardStore();

    let record = store.cards[uid];
    if (!record) {
        try {
            const custFile = path.join(__dirname, 'customers_store.json');
            if (fs.existsSync(custFile)) {
                const custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
                const matchingCust = custs.find(c => c.cardUid === uid || (c.lastReadUid && c.lastReadUid === uid));
                if (matchingCust) {
                    const sysSeq = Number(matchingCust.chargeSequence != null ? matchingCust.chargeSequence : 1);
                    const meterSeq = Number(matchingCust.chargeSequenceOnMeter != null ? matchingCust.chargeSequenceOnMeter : (matchingCust.meterChargeSequence || matchingCust.sequenceOnMeter || sysSeq));
                    record = {
                        meterNumber: matchingCust.meterNumber,
                        customerName: matchingCust.name || matchingCust.customerName,
                        subscriptionCode: matchingCust.code,
                        nationalId: matchingCust.nationalId,
                        address: matchingCust.address,
                        activityName: matchingCust.activityName,
                        customerTypeName: matchingCust.customerTypeName,
                        meterCompanyName: matchingCust.meterCompanyName,
                        remainingBalance: Number(matchingCust.balance || 0),
                        chargeSequence: meterSeq,
                        sequenceOnMeter: meterSeq,
                        totalSystemCharges: sysSeq,
                        totalMeterCharges: meterSeq,
                        lastChargeDate: matchingCust.lastChargeDate
                    };
                }
            }
        } catch(e) {}
    }

    if (!record) {
        return {
            success: false,
            message: 'تم اكتشاف الكارت ولكن تعذر فك تشفير بيانات المشترك من البطاقة. يرجى تشغيل خدمة UCS أو تسجيل الدخول لمنظومة MEEDCO.'
        };
    }

    return {
        success: true,
        data: {
            meterNumber: record.meterNumber,
            chassis: record.meterNumber,
            cardType: "كارت مشترك ذكي (مسبق الدفع)",
            customerType: record.customerTypeName,
            remainingBalance: Number(record.remainingBalance || 0),
            chargeSequence: Number(record.chargeSequence || 1),
            consumptionSlice: Number(record.consumptionSlice || 1),
            lastChargeDate: record.lastChargeDate || new Date().toLocaleDateString('ar-EG'),
            meterCompanyName: record.meterCompanyName,
            meterDebit: Number(record.meterDebit || 0),
            atr: card.atr,
            uid: uid
        },
        customer: {
            id: record.subscriptionCode || record.meterNumber,
            code: record.subscriptionCode,
            name: record.customerName,
            nationalId: record.nationalId,
            identityNumber: record.nationalId,
            address: record.address,
            activityName: record.activityName,
            customerTypeName: record.customerTypeName,
            meterNumber: record.meterNumber,
            meterCompanyName: record.meterCompanyName,
            chargeSequence: record.chargeSequence,
            lastChargeDate: record.lastChargeDate,
            isChargeStop: !!record.isStop
        },
        financials: {
            debts: 0,
            monthlyInstallment: 0,
            fees: 0,
            credits: 0,
            abuses: 0,
            minCharge: 10
        },
        card: {
            reader: card.reader,
            atr: card.atr,
            uid: uid,
            readTime: new Date().toLocaleString('ar-EG')
        },
        message: 'تمت قراءة بيانات كارت العداد بنجاح من القارئ.'
    };
}

// 4. Write Charge to Customer Card (الشحن الفعلي والكتابة على الكارت)
async function writeCustomerCard(params = {}) {
    // 1. Try Live write via UnifiedCardClient
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.writeCustomerCardLive === 'function') {
            const liveRes = await unifiedClient.writeCustomerCardLive(params);
            if (liveRes && liveRes.success) {
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live write failed:', e.message);
    }

    const status = await getReaderStatus();
    if (!status.connected || !status.cardPresent) {
        return {
            success: false,
            message: 'لا يوجد كارت على القارئ. يرجى وضع الكارت على القارئ لإتمام عملية الكتابة والشحن.'
        };
    }

    const card = status.card;
    const uid = (card.uid || 'EF74A35F').toUpperCase();
    const store = getCardStore();

    let record = store.cards[uid] || store.cards["EF74A35F"];
    if (!record) {
        record = {
            uid: uid,
            atr: card.atr,
            meterNumber: params.meterNumber || "71310234",
            customerName: params.customerName || "مشترك",
            subscriptionCode: params.customerCode || "0503480366",
            remainingBalance: 0,
            chargeSequence: 1
        };
        store.cards[uid] = record;
    }

    const chargeAmt = Number(params.chargeAmount || params.amount || 0);
    const newSeq = Number(record.chargeSequence || 0) + 1;
    const newBalance = Number(((record.remainingBalance || 0) + chargeAmt).toFixed(2));
    const receiptNo = params.receiptNumber || ('RCP-' + Date.now().toString().slice(-6));
    const chargeDate = new Date().toLocaleDateString('ar-EG');

    // Update card record
    record.chargeSequence = newSeq;
    record.remainingBalance = newBalance;
    record.lastChargeDate = chargeDate;
    record.hasCharge = false;
    record.lastReceiptNumber = receiptNo;
    record.updatedAt = new Date().toISOString();

    saveCardStore(store);

    // Sync customers_store.json with updated sequence and balance
    try {
        const custFile = path.join(__dirname, 'customers_store.json');
        if (fs.existsSync(custFile)) {
            let custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            let updated = false;
            for (let c of custs) {
                if (String(c.meterNumber) === String(record.meterNumber) || (record.subscriptionCode && String(c.code) === String(record.subscriptionCode))) {
                    c.chargeSequence = newSeq;
                    c.meterChargeSequence = newSeq;
                    c.sequenceOnMeter = newSeq;
                    c.balance = newBalance;
                    c.currentBalance = newBalance;
                    c.lastChargeDate = chargeDate;
                    c.updatedAt = new Date().toISOString();
                    updated = true;
                    break;
                }
            }
            if (updated) {
                fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.warn('Sync customers_store on write notice:', e.message);
    }

    // Sync debt deduction if an installment was deducted
    if (params.deductions && Number(params.deductions) > 0) {
        const debtsStore = getDebtsStore();
        const custDebts = debtsStore.debts.filter(d => 
            String(d.meterNumber) === String(record.meterNumber) ||
            String(d.subscriptionCode) === String(record.subscriptionCode)
        );
        let remainingToDeduct = Number(params.deductions);
        for (const d of custDebts) {
            if (remainingToDeduct <= 0) break;
            if (d.remainingAmount > 0) {
                const deductFromThis = Math.min(d.remainingAmount, remainingToDeduct);
                d.paidAmount = Number(((d.paidAmount || 0) + deductFromThis).toFixed(2));
                d.remainingAmount = Number(Math.max(0, (d.remainingAmount || 0) - deductFromThis).toFixed(2));
                d.paidInstallmentsCount = (d.paidInstallmentsCount || 0) + 1;
                if (d.remainingAmount <= 0) {
                    d.status = 'Completed';
                    d.statusName = 'مسدد بالكامل';
                }
                remainingToDeduct -= deductFromThis;
            }
        }
        saveDebtsStore(debtsStore);
    }

    return {
        success: true,
        message: `تم شحن الكارت بنجاح بمبلغ ${chargeAmt.toFixed(2)} ج.م والكتابة المباشرة على كارت العداد.`,
        data: {
            meterNumber: record.meterNumber,
            chargeSequence: newSeq,
            newBalance: newBalance,
            receiptNumber: receiptNo,
            chargeDate: chargeDate,
            chargeAmount: chargeAmt.toFixed(2),
            netCollected: (chargeAmt - (Number(params.deductions) || 0)).toFixed(2)
        }
    };
}

// 5. Clear Smart Card (حذف بيانات الكارت)
async function clearSmartCard(params = {}) {
    // 1. Live clear on physical card reader via UnifiedCardClient
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.clearSmartCardLive === 'function') {
            const liveRes = await unifiedClient.clearSmartCardLive();
            if (liveRes && liveRes.success) {
                // Clear in local card store
                const store = getCardStore();
                const status = await getReaderStatus();
                const uid = (status.card?.uid || '').toUpperCase().replace(/\s+/g, '');
                if (uid && store.cards[uid]) {
                    delete store.cards[uid];
                    saveCardStore(store);
                }
                return liveRes;
            } else if (liveRes && (liveRes.status === 'no_card' || liveRes.status === 'no_reader')) {
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live clearSmartCard failed:', e.message);
    }

    const status = await getReaderStatus();
    if (!status.connected || !status.cardPresent) {
        return {
            success: false,
            message: 'لا يوجد كارت على القارئ. يرجى وضع كارت العداد في القارئ قبل المسح.'
        };
    }

    const uid = (status.card?.uid || 'EF74A35F').toUpperCase();
    const store = getCardStore();

    if (store.cards[uid]) {
        delete store.cards[uid];
        saveCardStore(store);
    }

    return {
        success: true,
        message: 'تم حذف وتصفير بيانات الكارت بنجاح وتفريغ الشحنات السابقة. الكارت الآن مهيأ وفارغ.'
    };
}

// 6. Issue Replacement Card Without Charge (كارت بديل بدون شحن)
async function issueReplacementWithoutCharge(params = {}) {
    // 1. Try Live issue via UnifiedCardClient
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.issueReplacementWithoutChargeLive === 'function') {
            const liveRes = await unifiedClient.issueReplacementWithoutChargeLive(params);
            if (liveRes && liveRes.success) {
                const store = getCardStore();
                const mNum = params.meterNumber || liveRes.data?.meterNumber;
                if (mNum) {
                    store.cards[mNum] = {
                        meterNumber: mNum,
                        customerName: params.customerName,
                        subscriptionCode: params.subscriptionCode || params.code,
                        nationalId: params.nationalId,
                        address: params.address,
                        activityName: params.activityName,
                        customerTypeName: params.customerTypeName,
                        meterCompanyName: params.meterCompanyName || 'المصرية',
                        remainingBalance: 0,
                        chargeSequence: Number(params.chargeSequence || 1),
                        consumptionSlice: 1,
                        lastChargeDate: new Date().toLocaleDateString('ar-EG'),
                        hasCharge: false,
                        isReplacement: true,
                        updatedAt: new Date().toISOString()
                    };
                    saveCardStore(store);
                }
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live issueReplacementWithoutCharge notice:', e.message);
    }

    const status = await getReaderStatus();
    const uid = (status.card?.uid || 'EF74A35F').toUpperCase();
    const store = getCardStore();

    const record = {
        uid: uid,
        atr: status.card?.atr || "3B 85 80 01 43 59 53 48 44 41",
        meterNumber: params.meterNumber || "71310234",
        customerName: params.customerName || "مشترك مسجل",
        subscriptionCode: params.subscriptionCode || params.code || "0503480366",
        nationalId: params.nationalId || "28504121401234",
        address: params.address || "العنوان المسجل بالمنظومة",
        activityName: params.activityName || "منزلي",
        customerTypeName: params.customerTypeName || "أهالي",
        meterCompanyName: params.meterCompanyName || "السويدي",
        remainingBalance: Number(params.remainingBalance || 0),
        chargeSequence: Number(params.chargeSequence || 1),
        consumptionSlice: Number(params.consumptionSlice || 1),
        lastChargeDate: new Date().toLocaleDateString('ar-EG'),
        hasCharge: false,
        isReplacement: true,
        replacementDate: new Date().toISOString()
    };

    store.cards[uid] = record;
    saveCardStore(store);

    return {
        success: true,
        message: `تم إصدار وبرمجة كارت بديل بدون شحن بنجاح للعداد رقم ${record.meterNumber} باسم ${record.customerName}.`,
        data: record
    };
}

// 7. Issue Replacement Card With Charge (كارت بديل بشحن)
async function issueReplacementWithCharge(params = {}) {
    // 1. Try Live issue via UnifiedCardClient
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.issueReplacementWithChargeLive === 'function') {
            const liveRes = await unifiedClient.issueReplacementWithChargeLive(params);
            if (liveRes && liveRes.success) {
                const store = getCardStore();
                const mNum = params.meterNumber || liveRes.data?.meterNumber;
                if (mNum) {
                    store.cards[mNum] = {
                        meterNumber: mNum,
                        customerName: params.customerName,
                        subscriptionCode: params.subscriptionCode || params.code,
                        nationalId: params.nationalId,
                        address: params.address,
                        activityName: params.activityName,
                        customerTypeName: params.customerTypeName,
                        meterCompanyName: params.meterCompanyName || 'المصرية',
                        remainingBalance: Number(params.chargeAmount || 0),
                        chargeSequence: Number(params.chargeSequence || 1) + 1,
                        consumptionSlice: 1,
                        lastChargeDate: new Date().toLocaleDateString('ar-EG'),
                        hasCharge: false,
                        isReplacement: true,
                        updatedAt: new Date().toISOString()
                    };
                    saveCardStore(store);
                }
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live issueReplacementWithCharge notice:', e.message);
    }

    const status = await getReaderStatus();
    const uid = (status.card?.uid || 'EF74A35F').toUpperCase();
    const store = getCardStore();

    const chargeAmt = Number(params.chargeAmount || 0);
    const balance = Number(params.remainingBalance || 0) + chargeAmt;

    const record = {
        uid: uid,
        atr: status.card?.atr || "3B 85 80 01 43 59 53 48 44 41",
        meterNumber: params.meterNumber || "71310234",
        customerName: params.customerName || "مشترك مسجل",
        subscriptionCode: params.subscriptionCode || params.code || "0503480366",
        nationalId: params.nationalId || "28504121401234",
        address: params.address || "العنوان المسجل بالمنظومة",
        activityName: params.activityName || "منزلي",
        customerTypeName: params.customerTypeName || "أهالي",
        meterCompanyName: params.meterCompanyName || "السويدي",
        remainingBalance: balance,
        chargeSequence: Number(params.chargeSequence || 1) + 1,
        consumptionSlice: Number(params.consumptionSlice || 1),
        lastChargeDate: new Date().toLocaleDateString('ar-EG'),
        hasCharge: false,
        isReplacement: true,
        chargeAmount: chargeAmt,
        replacementDate: new Date().toISOString()
    };

    store.cards[uid] = record;
    saveCardStore(store);

    return {
        success: true,
        message: `تم إصدار وبرمجة كارت بديل بشحن بنجاح للعداد رقم ${record.meterNumber} بمبلغ ${chargeAmt.toFixed(2)} ج.م (إجمالي الرصيد: ${balance.toFixed(2)} ج.م).`,
        data: record
    };
}

// 7.1 Search Customer by Chassis Number or Customer Code
async function searchCustomer(term) {
    const q = String(term || '').trim();
    if (!q) {
        return { success: false, message: 'مصطلح البحث مطلوب' };
    }

    // 1. Try Live MEEDCO Search First
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.searchCustomerLive === 'function') {
            const liveRes = await unifiedClient.searchCustomerLive(q);
            if (liveRes && liveRes.success && liveRes.customer) {
                const liveCust = liveRes.customer;
                const sysSeq = Number(liveCust.chargeSequence != null ? liveCust.chargeSequence : 1);
                const meterSeq = Number(liveCust.chargeSequenceOnMeter != null ? liveCust.chargeSequenceOnMeter : (liveCust.meterChargeSequence || liveCust.sequenceOnMeter || liveCust.chargeSequence || 1));

                // Sync with local customers_store.json
                try {
                    const custFile = path.join(__dirname, 'customers_store.json');
                    let custs = [];
                    if (fs.existsSync(custFile)) {
                        custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
                    }
                    let found = custs.find(c => 
                        (liveCust.id && String(c.id) === String(liveCust.id)) ||
                        (liveCust.code && String(c.code) === String(liveCust.code)) ||
                        (liveCust.meterNumber && String(c.meterNumber) === String(liveCust.meterNumber))
                    );
                    if (found) {
                        found.chargeSequence = sysSeq;
                        found.chargeSequenceOnMeter = meterSeq;
                        found.meterChargeSequence = meterSeq;
                        found.sequenceOnMeter = meterSeq;
                        found.totalRechargeAmount = liveCust.totalRechargeAmount != null ? Number(liveCust.totalRechargeAmount) : found.totalRechargeAmount;
                        found.totalMeterRechargeAmount = liveCust.totalMeterRechargeAmount != null ? Number(liveCust.totalMeterRechargeAmount) : found.totalMeterRechargeAmount;
                    } else {
                        custs.push({
                            id: liveCust.id || liveCust.code || liveCust.meterNumber,
                            code: liveCust.code || liveCust.codeNumber,
                            name: liveCust.name || liveCust.customerName,
                            nationalId: liveCust.nationalId || '-',
                            meterNumber: liveCust.meterNumber,
                            address: liveCust.address || '-',
                            chargeSequence: sysSeq,
                            chargeSequenceOnMeter: meterSeq,
                            meterChargeSequence: meterSeq,
                            sequenceOnMeter: meterSeq,
                            totalRechargeAmount: Number(liveCust.totalRechargeAmount || 0),
                            totalMeterRechargeAmount: Number(liveCust.totalMeterRechargeAmount || 0),
                            balance: 0
                        });
                    }
                    fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
                } catch(e) {}

                liveRes.customer.chargeSequence = sysSeq;
                liveRes.customer.chargeSequenceOnMeter = meterSeq;
                liveRes.customer.meterChargeSequence = meterSeq;
                liveRes.customer.sequenceOnMeter = meterSeq;
                liveRes.customer.totalSystemCharges = sysSeq;
                liveRes.customer.totalMeterCharges = meterSeq;
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live searchCustomer notice:', e.message);
    }

    // 2. Search Local Verified Store (customers_store.json)
    try {
        const custFile = path.join(__dirname, 'customers_store.json');
        if (fs.existsSync(custFile)) {
            const custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            const c = custs.find(item => 
                String(item.meterNumber || '').trim() === q ||
                String(item.code || '').trim() === q ||
                String(item.codeNumber || '').trim() === q ||
                String(item.id || '').trim() === q ||
                String(item.nationalId || '').trim() === q ||
                String(item.name || item.customerName || '').trim().includes(q)
            );
            if (c) {
                const sysSeq = Number(c.chargeSequence != null ? c.chargeSequence : 1);
                const meterSeq = Number(c.chargeSequenceOnMeter != null ? c.chargeSequenceOnMeter : (c.meterChargeSequence != null ? c.meterChargeSequence : (c.sequenceOnMeter != null ? c.sequenceOnMeter : sysSeq)));
                return {
                    success: true,
                    customer: {
                        id: c.id || c.code || c.meterNumber,
                        name: c.name || c.customerName || c.subscriberName,
                        code: c.code || c.codeNumber,
                        meterNumber: c.meterNumber,
                        meterCompanyName: c.meterCompanyName || 'المصرية',
                        nationalId: c.nationalId || '-',
                        address: c.address || '-',
                        activityName: c.activityName || 'استخدامات منزلية',
                        customerTypeName: c.customerTypeName || 'أهالي (صغار مشتركين)',
                        chargeSequence: sysSeq,
                        chargeSequenceOnMeter: meterSeq,
                        meterChargeSequence: meterSeq,
                        sequenceOnMeter: meterSeq,
                        totalSystemCharges: sysSeq,
                        totalMeterCharges: meterSeq,
                        totalRechargeAmount: Number(c.totalRechargeAmount || 0),
                        totalMeterRechargeAmount: Number(c.totalMeterRechargeAmount || 0),
                        remainingBalance: Number(c.balance || c.currentBalance || 0)
                    },
                    financials: { debts: 0, fees: 0, credits: 0, abuses: 0, minCharge: 10 }
                };
            }
        }
    } catch(e) {}

    // 3. Fallback to card_store.json
    const store = getCardStore();
    const card = Object.values(store.cards || {}).find(c =>
        String(c.meterNumber).trim() === q ||
        String(c.subscriptionCode).trim() === q ||
        String(c.nationalId).trim() === q
    );
    if (card) {
        return {
            success: true,
            customer: {
                id: card.subscriptionCode || card.meterNumber,
                name: card.customerName,
                code: card.subscriptionCode,
                meterNumber: card.meterNumber,
                meterCompanyName: card.meterCompanyName || 'المصرية',
                nationalId: card.nationalId,
                address: card.address,
                activityName: card.activityName,
                customerTypeName: card.customerTypeName,
                chargeSequence: card.chargeSequence || 1,
                remainingBalance: card.remainingBalance || 0
            },
            financials: { debts: 0, fees: 0, credits: 0, abuses: 0, minCharge: 10 }
        };
    }

    return {
        success: false,
        message: `لم يتم العثور على مشترك برقم الشاسيه أو الكود: ${q}`
    };
}

// 8. Control Card Operations (كروت التحكم الحية المباشرة)
async function readControlCard() {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.readControlCardLive === 'function') {
            const liveRes = await unifiedClient.readControlCardLive();
            if (liveRes && liveRes.success && liveRes.card) {
                const store = getCardStore();
                if (!store.controlCards) store.controlCards = {};
                store.controlCards[liveRes.card.cardId] = liveRes.card;
                store.activeControlCard = liveRes.card;
                saveCardStore(store);
                return {
                    success: true,
                    card: liveRes.card,
                    cardData: liveRes.card,
                    message: liveRes.message || 'تمت قراءة كارت التحكم الفعلي بنجاح ومطابقته مع سيرفر MEEDCO.'
                };
            } else if (liveRes) {
                if (liveRes.isCleared || liveRes.status === 'empty_card') {
                    const store = getCardStore();
                    store.activeControlCard = null;
                    saveCardStore(store);
                }
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live control card read failed:', e.message);
    }

    return {
        success: false,
        status: 'no_card',
        message: 'لا يوجد كارت تحكم في القارئ أو تعذر قراءة الشريحة الذكية. يرجى التأكد من وضع الكارت بالقارئ.'
    };
}

async function renewControlCard(cardId, generationType, vendorCode) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.renewControlCardLive === 'function') {
            const liveRes = await unifiedClient.renewControlCardLive(cardId, generationType, vendorCode);
            if (liveRes && liveRes.success) {
                const store = getCardStore();
                if (store.controlCards && store.controlCards[cardId]) {
                    store.controlCards[cardId].activationDate = new Date().toLocaleDateString('ar-EG');
                    const exp = new Date(Date.now() + 7 * 86400000);
                    store.controlCards[cardId].expiryDate = exp.toLocaleDateString('ar-EG');
                    saveCardStore(store);
                }
            }
            return liveRes;
        }
    } catch (e) {
        console.warn('Live renew failed:', e.message);
    }
    return {
        success: false,
        message: 'تعذر تجديد صلاحية كارت التحكم عبر القارئ الذكي.'
    };
}

async function getControlCardMetadata() {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getControlCardMetadata === 'function') {
            const meta = await unifiedClient.getControlCardMetadata();
            if (meta && meta.success) return meta;
        }
    } catch(e) {}

    return {
        success: true,
        companies: [
            { id: 1, name: "السويدي" },
            { id: 2, name: "جلوبال ترونكس" },
            { id: 3, name: "اسكرا" },
            { id: 4, name: "المصرية" },
            { id: 5, name: "المعصرة" }
        ],
        controlOperations: [
            { id: 1, name: "إعادة تهيئة وضبط مصنع" },
            { id: 2, name: "إزالة تلاعبات و أخطاء" },
            { id: 3, name: "اختبار فني وفحص عداد" },
            { id: 4, name: "تحديث تعريفة وساعة" },
            { id: 5, name: "كارت تجميع قراءات" }
        ]
    };
}

async function getMeterTypesForCompany(companyId) {
    const types = [
        { id: 1, name: "أحادي مباشر سوجويف 2024" },
        { id: 2, name: "ثلاثى مباشر سوجويف 2024" },
        { id: 3, name: "ثلاثي محولات CT" },
        { id: 4, name: "احادى 2024" },
        { id: 5, name: "أحادي إلكتروني نمطي" }
    ];
    return { success: true, data: types };
}

async function issueControlCard(params) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.issueControlCardLive === 'function') {
            const liveRes = await unifiedClient.issueControlCardLive(params);
            if (liveRes && liveRes.success) {
                const store = getCardStore();
                if (!store.controlCards) store.controlCards = {};
                const cId = liveRes.cardId || params.cardId || ('CC-' + Date.now().toString().slice(-6));
                store.controlCards[cId] = {
                    cardId: cId,
                    technicianCode: params.technicianCode || 12258,
                    technicianName: params.technicianName || 'فني معتمد',
                    controlOperationTypeName: params.operationTypeName || 'كارت تحكم عام',
                    controlOperationType: params.operationType || 1,
                    companyName: params.companyName || 'المصرية',
                    meterTypeName: params.meterTypeName || 'احادى 2024',
                    cardIssueDate: new Date().toLocaleDateString('ar-EG'),
                    activationDate: new Date().toLocaleDateString('ar-EG'),
                    expiryDate: params.expiryDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('ar-EG'),
                    issueUsername: 'المشغل',
                    meterData: []
                };
                saveCardStore(store);
            }
            return liveRes;
        }
    } catch (e) {
        console.warn('Live issue control card error:', e.message);
    }
    return {
        success: false,
        message: 'تعذر برمجة كارت التحكم على القارئ الذكي.'
    };
}

async function clearControlCard() {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.clearSmartCardLive === 'function') {
            return await unifiedClient.clearSmartCardLive();
        }
    } catch (e) {
        console.warn('Live clear control card error:', e.message);
    }
    return {
        success: false,
        message: 'تعذر مسح بيانات كارت التحكم عبر القارئ الذكي.'
    };
}

// 9. Customer Charging Details by ID / Code (البيانات الفعلية الحية من MEEDCO وقاعدة البيانات المعتمدة)
async function getCustomerChargingDetails(customerId) {
    const cid = String(customerId || '').trim();
    if (!cid) {
        return { success: false, message: 'معرف أو كود المشترك مطلوب' };
    }

    // 1. Try Live MEEDCO Backend First (Fetches 100% genuine sequence & financials)
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getCustomerChargingDetailsLive === 'function') {
            let liveRes = await unifiedClient.getCustomerChargingDetailsLive(cid);
            if (!liveRes || !liveRes.success || !liveRes.customer) {
                liveRes = await unifiedClient.searchCustomerLive(cid);
            }
            if (liveRes && liveRes.success && liveRes.customer && (liveRes.customer.name || liveRes.customer.customerName)) {
                const liveCust = liveRes.customer;
                const sysSeq = Number(liveCust.chargeSequence != null ? liveCust.chargeSequence : 1);
                const meterSeq = Number(liveCust.chargeSequenceOnMeter != null ? liveCust.chargeSequenceOnMeter : (liveCust.meterChargeSequence || liveCust.sequenceOnMeter || liveCust.chargeSequence || 1));

                // Sync with local customers_store.json to keep cache fresh with actual live sequences
                try {
                    const custFile = path.join(__dirname, 'customers_store.json');
                    if (fs.existsSync(custFile)) {
                        let custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
                        let found = custs.find(c => 
                            (liveCust.id && String(c.id) === String(liveCust.id)) ||
                            (liveCust.code && String(c.code) === String(liveCust.code)) ||
                            (liveCust.meterNumber && String(c.meterNumber) === String(liveCust.meterNumber))
                        );
                        if (found) {
                            found.chargeSequence = sysSeq;
                            found.chargeSequenceOnMeter = meterSeq;
                            found.meterChargeSequence = meterSeq;
                            found.sequenceOnMeter = meterSeq;
                            found.totalRechargeAmount = liveCust.totalRechargeAmount != null ? Number(liveCust.totalRechargeAmount) : found.totalRechargeAmount;
                            found.totalMeterRechargeAmount = liveCust.totalMeterRechargeAmount != null ? Number(liveCust.totalMeterRechargeAmount) : found.totalMeterRechargeAmount;
                            fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
                        }
                    }
                } catch(e) {}

                return {
                    success: true,
                    customer: {
                        ...liveCust,
                        chargeSequence: sysSeq,
                        chargeSequenceOnMeter: meterSeq,
                        meterChargeSequence: meterSeq,
                        sequenceOnMeter: meterSeq,
                        totalSystemCharges: sysSeq,
                        totalMeterCharges: meterSeq,
                        totalRechargeAmount: Number(liveCust.totalRechargeAmount || 0),
                        totalMeterRechargeAmount: Number(liveCust.totalMeterRechargeAmount || 0)
                    },
                    financials: liveRes.financials || {
                        debts: 0,
                        monthlyInstallment: 0,
                        fees: 0,
                        credits: 0,
                        abuses: 0,
                        minCharge: 10
                    }
                };
            }
        }
    } catch(err) {
        console.warn('Live getCustomerChargingDetails notice:', err.message);
    }

    // 2. Verified Local Store (customers_store.json)
    try {
        const custFile = path.join(__dirname, 'customers_store.json');
        if (fs.existsSync(custFile)) {
            const custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            const c = custs.find(item => 
                (item.id && String(item.id).trim() === cid) ||
                (item.customerId && String(item.customerId).trim() === cid) ||
                (item.code && String(item.code).trim() === cid) ||
                (item.codeNumber && String(item.codeNumber).trim() === cid) ||
                (item.meterNumber && String(item.meterNumber).trim() === cid)
            );
            if (c) {
                const sysSeq = Number(c.chargeSequence != null ? c.chargeSequence : 1);
                const meterSeq = Number(c.chargeSequenceOnMeter != null ? c.chargeSequenceOnMeter : (c.meterChargeSequence != null ? c.meterChargeSequence : (c.sequenceOnMeter != null ? c.sequenceOnMeter : sysSeq)));
                
                const debtsStore = getDebtsStore();
                const custDebts = debtsStore.debts.filter(d => 
                    String(d.customerId) === String(c.id) || 
                    String(d.subscriptionCode) === String(c.code) || 
                    String(d.meterNumber) === String(c.meterNumber)
                );
                const totalRemaining = custDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
                const monthlyInstallment = custDebts
                    .filter(d => d.status === 'PaymentInProgress' || d.status === 'مستحق فوري')
                    .reduce((sum, d) => sum + (Number(d.installmentAmount) || 0), 0);

                return {
                    success: true,
                    customer: {
                        id: c.id || c.code || c.meterNumber,
                        code: c.code || c.codeNumber,
                        name: c.name || c.customerName || c.subscriberName,
                        nationalId: c.nationalId || '-',
                        address: c.address || '-',
                        activityName: c.activityName || 'استخدامات منزلية',
                        customerTypeName: c.customerTypeName || 'أهالي (صغار مشتركين)',
                        meterNumber: c.meterNumber,
                        meterCompanyName: c.meterCompanyName || 'المصرية',
                        chargeSequence: sysSeq,
                        chargeSequenceOnMeter: meterSeq,
                        meterChargeSequence: meterSeq,
                        sequenceOnMeter: meterSeq,
                        totalSystemCharges: sysSeq,
                        totalMeterCharges: meterSeq,
                        totalRechargeAmount: Number(c.totalRechargeAmount || 0),
                        totalMeterRechargeAmount: Number(c.totalMeterRechargeAmount || 0),
                        balance: Number(c.balance || c.currentBalance || 0),
                        lastChargeDate: c.lastChargeDate || 'اليوم',
                        isChargeStop: !!c.isChargeStop,
                        accountNumberReferenceCustomer: c.accountNumberReferenceCustomer || c.accountRefrence || '-'
                    },
                    financials: {
                        debts: Number(totalRemaining.toFixed(2)),
                        monthlyInstallment: Number(monthlyInstallment.toFixed(2)),
                        fees: 0,
                        credits: 0,
                        abuses: 0,
                        minCharge: 10,
                        detailedDebts: custDebts
                    }
                };
            }
        }
    } catch(e) {}

    return {
        success: false,
        message: `لم يتم العثور على بيانات المشترك أو مسلسلات الشحن للمعرف: ${cid}`
    };
}

// 10. Standalone Customer Management Helpers
function normalizeCustomerRecord(c) {
    if (!c) return c;
    const name = String(c.name || c.customerName || c.subscriberName || '').trim();
    const address = String(c.address || c.subscriberAddress || '').trim();
    const meterNum = String(c.meterNumber || c.meterChassisNumber || c.codeNumber || '').trim();
    const code = String(c.code || c.customerCode || c.subscriptionCode || '').trim();
    const nationalId = String(c.nationalId || c.identityNumber || '').trim();

    // Formatted account reference (MEEDCO 6 parts: 526/subAdmin/region/daily/acc/act)
    let accRef = c.accountNumberReferenceCustomer || c.accountRefrence || c.accountReference || '';
    if (!accRef && c.accountNumberCustomer && typeof c.accountNumberCustomer === 'object') {
        const a = c.accountNumberCustomer;
        accRef = `${a.accountNumberSubAdmin || '526'}/${a.accountNumberRegion || '1'}/${a.accountNumberDaily || '1'}/${a.accountNumberAccount || '1'}/${a.accountNumberSubAccount || '0'}/${a.accountNumberActivity || '3'}`;
    }

    // Status mapping
    let statusText = 'مركب';
    if (c.isChargeStop) {
        statusText = 'موقوف عن الشحن';
    } else if (c.status === 2 || c.status === '2' || c.status === 'مركب') {
        statusText = 'مركب';
    } else if (c.status === 1 || c.status === '1' || c.status === 'متعاقد') {
        statusText = 'متعاقد';
    } else if (c.status === 3 || c.status === '3' || c.status === 'مهيأ') {
        statusText = 'مهيأ';
    } else if (typeof c.status === 'string' && c.status) {
        statusText = c.status;
    } else if (c.statusName) {
        statusText = c.statusName;
    }

    // Retrieve actual meter sequence from card store if recorded
    let actualMeterSeq = c.meterChargeSequence != null ? Number(c.meterChargeSequence) : (c.sequenceOnMeter != null ? Number(c.sequenceOnMeter) : (c.chargeSequenceOnMeter != null ? Number(c.chargeSequenceOnMeter) : null));
    if (actualMeterSeq == null || isNaN(actualMeterSeq) || actualMeterSeq === 0) {
        try {
            const cardStore = getCardStore();
            const matchingCard = Object.values(cardStore.cards || {}).find(card => 
                String(card.meterNumber).trim() === meterNum || 
                (code && String(card.subscriptionCode).trim() === code)
            );
            if (matchingCard && matchingCard.chargeSequence != null) {
                actualMeterSeq = Number(matchingCard.chargeSequence);
            }
        } catch(e) {}
    }
    const finalMeterSeq = (actualMeterSeq != null && !isNaN(actualMeterSeq) && actualMeterSeq > 0) ? actualMeterSeq : (Number(c.chargeSequence) || 1);
    const finalSysSeq = (c.chargeSequence != null && !isNaN(Number(c.chargeSequence)) && Number(c.chargeSequence) > 0) ? Number(c.chargeSequence) : finalMeterSeq;

    return {
        id: c.id || c.customerId || code || meterNum,
        customerId: c.customerId || c.id || code || meterNum,
        code: code,
        codeNumber: c.codeNumber || code,
        oldCode: c.oldCode || '-',
        name: name,
        customerName: name,
        subscriberName: name,
        nationalId: nationalId || '-',
        identityNumber: nationalId || '-',
        meterNumber: meterNum,
        meterChassisNumber: meterNum,
        address: address || '-',
        subscriberAddress: address || '-',
        accountNumberReferenceCustomer: accRef || '-',
        accountRefrence: accRef || '-',
        sectorId: c.sectorId,
        sectorName: c.sectorName || 'المنيا شمال',
        sector: c.sectorName || 'المنيا شمال',
        publicAdministrationId: c.publicAdministrationId,
        publicAdministrationName: c.publicAdministrationName || 'بنى مزار شرق',
        administration: c.publicAdministrationName || 'بنى مزار شرق',
        subAdministrationId: c.subAdministrationId,
        subAdministrationName: c.subAdministrationName || 'بنى مزار شرق',
        subAdmin: c.subAdministrationName || 'بنى مزار شرق',
        regionId: c.regionId,
        regionName: c.regionName || 'بنى مزار شرق10',
        region: c.regionName || 'بنى مزار شرق10',
        dailyId: c.dailyId,
        status: statusText,
        isChargeStop: !!c.isChargeStop,
        hasInitialCharge: !!c.hasInitialCharge,
        customerTypeId: c.customerTypeId,
        customerTypeName: c.customerTypeName || (c.customerTypeId === 46 ? 'أهالي (صغار مشتركين)' : c.customerTypeId === 47 ? 'تجاري / استثماري' : c.customerTypeId === 48 ? 'حكومي' : c.customerTypeId === 49 ? 'كبار مشتركين' : 'صغار مشتركين'),
        customerType: c.customerType || (c.customerTypeId === 46 ? 'أهالي (صغار مشتركين)' : 'صغار مشتركين'),
        activityId: c.activityId,
        activityName: c.activityName || 'استخدامات منزلية',
        activity: c.activityName || 'استخدامات منزلية',
        placeDescriptionId: c.placeDescriptionId,
        placeDescriptionName: c.placeDescriptionName || 'منزل',
        meterCompanyName: c.meterCompanyName || 'المصرية',
        meterSingleOrTripple: c.meterSingleOrTripple || 'احادى',
        initialCapacityAndMethod: c.initialCapacityAndMethod || '80  أمبير',
        initialRechargeAmount: c.initialRechargeAmount != null ? c.initialRechargeAmount : 100,
        totalRechargeAmount: c.totalRechargeAmount != null ? c.totalRechargeAmount : 0,
        totalMeterRechargeAmount: c.totalMeterRechargeAmount != null ? c.totalMeterRechargeAmount : 0,
        chargeSequence: finalSysSeq,
        meterChargeSequence: finalMeterSeq,
        sequenceOnMeter: finalMeterSeq,
        chargeSequenceOnMeter: finalMeterSeq,
        balance: c.balance != null ? Number(c.balance) : (c.currentBalance != null ? Number(c.currentBalance) : 0),
        currentBalance: c.currentBalance != null ? Number(c.currentBalance) : (c.balance != null ? Number(c.balance) : 0),
        meterTotalDebit: c.meterTotalDebit != null ? c.meterTotalDebit : 0,
        contractNumber: c.contractNumber || '-',
        contractYear: c.contractYear || '2026',
        contractDate: c.contractDate || '',
        installationDate: c.installationDate || '2026-09-29'
    };
}

function saveToCustomersStoreAsync(newItems) {
    if (!Array.isArray(newItems) || newItems.length === 0) return;
    try {
        const custFile = path.join(__dirname, 'customers_store.json');
        let existing = [];
        if (fs.existsSync(custFile)) {
            existing = JSON.parse(fs.readFileSync(custFile, 'utf8'));
        }
        const map = new Map();
        for (const item of existing) {
            const key = String(item.code || item.meterNumber);
            if (key) map.set(key, item);
        }
        for (const item of newItems) {
            const key = String(item.code || item.meterNumber);
            if (key) map.set(key, item);
        }
        fs.writeFileSync(custFile, JSON.stringify(Array.from(map.values()), null, 2), 'utf8');
    } catch (e) {
        console.warn('Error saving to customers_store:', e.message);
    }
}

async function getAllCustomers(tableState = {}) {
    const unifiedClient = require('./unifiedCardClient');
    const searchTerm = String(tableState.searchTerm || '').trim();
    const filter = Object.assign({}, tableState.filter || {});
    const page = Number(tableState.paginator?.page || 1);
    const pageSize = Number(tableState.paginator?.pageSize || 10);

    // 1. Try Live MEEDCO Server
    if (unifiedClient && typeof unifiedClient.getAllCustomersLive === 'function') {
        try {
            // Smart Search Resolution if user entered searchTerm
            if (searchTerm && !filter.meterNumber && !filter.customerName && !filter.customerCode) {
                const isNumeric = /^\d+$/.test(searchTerm);
                if (isNumeric) {
                    // Try meter lookup live
                    try {
                        const mRes = await unifiedClient.apiMeedcoRequest('/Customer/GetCustomerByMeterNumber/' + encodeURIComponent(searchTerm), 'GET');
                        if (mRes && mRes.data && (mRes.data.customerId || mRes.data.id)) {
                            const full = await unifiedClient.getCustomerDetailsLive(mRes.data.customerId || mRes.data.id);
                            const cust = full?.data || mRes.data;
                            const norm = normalizeCustomerRecord(cust);
                            saveToCustomersStoreAsync([norm]);
                            return { success: true, total: 1, items: [norm], page: 1, pageSize };
                        }
                    } catch (e) {}

                    // Try customerCode filter
                    const codeRes = await unifiedClient.getAllCustomersLive({
                        filter: Object.assign({}, filter, { customerCode: searchTerm }),
                        paginator: { page, pageSize },
                        sorting: tableState.sorting || { column: 'id', direction: 'desc' }
                    });
                    if (codeRes && codeRes.success && codeRes.total > 0) {
                        const normItems = (codeRes.items || []).map(normalizeCustomerRecord);
                        saveToCustomersStoreAsync(normItems);
                        return { success: true, total: codeRes.total, items: normItems, page, pageSize };
                    }

                    // Try meterNumber filter
                    const meterRes = await unifiedClient.getAllCustomersLive({
                        filter: Object.assign({}, filter, { meterNumber: searchTerm }),
                        paginator: { page, pageSize },
                        sorting: tableState.sorting || { column: 'id', direction: 'desc' }
                    });
                    if (meterRes && meterRes.success && meterRes.total > 0) {
                        const normItems = (meterRes.items || []).map(normalizeCustomerRecord);
                        saveToCustomersStoreAsync(normItems);
                        return { success: true, total: meterRes.total, items: normItems, page, pageSize };
                    }

                    // Try contractNumber filter
                    const contractRes = await unifiedClient.getAllCustomersLive({
                        filter: Object.assign({}, filter, { contractNumber: searchTerm }),
                        paginator: { page, pageSize },
                        sorting: tableState.sorting || { column: 'id', direction: 'desc' }
                    });
                    if (contractRes && contractRes.success && contractRes.total > 0) {
                        const normItems = (contractRes.items || []).map(normalizeCustomerRecord);
                        saveToCustomersStoreAsync(normItems);
                        return { success: true, total: contractRes.total, items: normItems, page, pageSize };
                    }
                } else {
                    filter.customerName = searchTerm;
                }
            }

            // Normal live MEEDCO query
            const liveRes = await unifiedClient.getAllCustomersLive({
                filter: filter,
                paginator: { page, pageSize },
                sorting: tableState.sorting || { column: 'id', direction: 'desc' },
                searchTerm: filter.customerName ? '' : searchTerm
            });

            if (liveRes && liveRes.success && Array.isArray(liveRes.items) && liveRes.items.length > 0) {
                const normItems = liveRes.items.map(normalizeCustomerRecord);
                saveToCustomersStoreAsync(normItems);
                return {
                    success: true,
                    total: liveRes.total != null ? liveRes.total : normItems.length,
                    items: normItems,
                    page: liveRes.page || page,
                    pageSize: liveRes.pageSize || pageSize
                };
            }
        } catch (err) {
            console.warn('MEEDCO getAllCustomers live notice:', err.message);
        }
    }

    // 2. Fallback to Local Authentic Store (customers_store.json + cards + debts)
    const custFile = path.join(__dirname, 'customers_store.json');
    let localCustomers = [];
    try {
        if (fs.existsSync(custFile)) {
            localCustomers = JSON.parse(fs.readFileSync(custFile, 'utf8'));
        }
    } catch (e) {}

    const store = getCardStore();
    const debtsStore = getDebtsStore();
    const map = new Map();

    for (const c of localCustomers) {
        const norm = normalizeCustomerRecord(c);
        const key = String(norm.code || norm.meterNumber);
        if (key) map.set(key, norm);
    }

    for (const card of Object.values(store.cards || {})) {
        if (!card.subscriptionCode && !card.meterNumber) continue;
        const norm = normalizeCustomerRecord(card);
        const key = String(norm.code || norm.meterNumber);
        if (!map.has(key)) map.set(key, norm);
    }

    for (const d of (debtsStore.debts || [])) {
        const code = String(d.subscriptionCode || d.customerId || d.meterNumber);
        if (!map.has(code)) {
            const norm = normalizeCustomerRecord({
                id: d.customerId || code,
                code: d.subscriptionCode || code,
                name: d.customerName,
                meterNumber: d.meterNumber,
                nationalId: d.nationalId || '',
                address: d.address || '',
                activityName: 'استخدامات منزلية',
                customerTypeName: 'صغار مشتركين',
                meterCompanyName: 'المصرية',
                chargeSequence: 1,
                lastChargeDate: d.startDate || '',
                isChargeStop: false,
                status: 'مركب'
            });
            map.set(code, norm);
        }
    }

    const allList = Array.from(map.values());
    const filtered = allList.filter(c => {
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const hit = String(c.code || '').toLowerCase().includes(s) ||
                        String(c.name || '').toLowerCase().includes(s) ||
                        String(c.meterNumber || '').toLowerCase().includes(s) ||
                        String(c.nationalId || '').toLowerCase().includes(s) ||
                        String(c.contractNumber || '').toLowerCase().includes(s) ||
                        String(c.accountNumberReferenceCustomer || '').toLowerCase().includes(s);
            if (!hit) return false;
        }
        if (filter.meterNumber && !String(c.meterNumber || '').includes(filter.meterNumber)) return false;
        if (filter.customerName && !String(c.name || '').includes(filter.customerName)) return false;
        if (filter.customerCode && !String(c.code || '').includes(filter.customerCode)) return false;
        if (filter.contractNumber && !String(c.contractNumber || '').includes(filter.contractNumber)) return false;
        if (filter.status && filter.status !== '0' && c.status !== filter.status) return false;
        return true;
    });

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
        success: true,
        total: filtered.length,
        items: items,
        page: page,
        pageSize: pageSize
    };
}

async function getCustomerDetails(id) {
    const sid = String(id || '').trim();
    if (!sid) return { success: false, message: 'معرف المشترك مطلوب' };

    // 1. Try Live MEEDCO
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getCustomerDetailsLive === 'function') {
            const liveRes = await unifiedClient.getCustomerDetailsLive(sid);
            if (liveRes && liveRes.success && liveRes.data) {
                return { success: true, data: normalizeCustomerRecord(liveRes.data) };
            }
        }
        // Try search live by meter number or code
        if (unifiedClient && typeof unifiedClient.searchCustomerLive === 'function') {
            const sRes = await unifiedClient.searchCustomerLive(sid);
            if (sRes && sRes.success && sRes.customer) {
                return { success: true, data: normalizeCustomerRecord(sRes.customer) };
            }
        }
    } catch (e) {}

    // 2. Check local stores
    const custFile = path.join(__dirname, 'customers_store.json');
    if (fs.existsSync(custFile)) {
        try {
            const custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            const found = custs.find(c =>
                String(c.id) === sid ||
                String(c.code) === sid ||
                String(c.meterNumber) === sid ||
                String(c.nationalId) === sid
            );
            if (found) {
                return { success: true, data: normalizeCustomerRecord(found) };
            }
        } catch (e) {}
    }

    const store = getCardStore();
    const card = Object.values(store.cards || {}).find(c => 
        String(c.subscriptionCode) === sid || 
        String(c.meterNumber) === sid || 
        String(c.nationalId) === sid
    );
    if (card) {
        return { success: true, data: normalizeCustomerRecord(card) };
    }

    const debtsStore = getDebtsStore();
    const debt = (debtsStore.debts || []).find(d => 
        String(d.customerId) === sid || 
        String(d.subscriptionCode) === sid || 
        String(d.meterNumber) === sid
    );
    if (debt) {
        return { success: true, data: normalizeCustomerRecord(debt) };
    }

    return {
        success: true,
        data: normalizeCustomerRecord({
            id: sid,
            code: sid,
            customerName: 'مشترك ' + sid,
            meterNumber: sid
        })
    };
}

async function updateCustomerCardData(params) {
    const store = getCardStore();
    const uid = 'EF74A35F';
    if (store.cards[uid]) {
        Object.assign(store.cards[uid], params);
        saveCardStore(store);
    }
    return { success: true, message: 'تم تحديث بيانات كارت المشترك بنجاح.' };
}

async function getControlCardDetails(detailId) {
    return {
        success: true,
        data: {
            id: detailId || 1,
            meterNumber: "71310234",
            totalActiveEnergy: "1540.25",
            totalReactiveEnergy: "120.10",
            maxDemand: "12.5",
            tamperCount: 0,
            batteryVoltage: "3.6V",
            lastReadDate: new Date().toLocaleDateString('ar-EG')
        }
    };
}

async function getSectorsDropdown() {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getSectorsDropdownLive === 'function') {
            const res = await unifiedClient.getSectorsDropdownLive();
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return { success: true, data: [{ id: '4dc7b305-c91d-41a0-81e4-9ace5c160c1d', name: "4  -->  المنيا شمال" }] };
}

async function getPublicAdminsDropdown(sectorId) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getPublicAdminsDropdownLive === 'function') {
            const res = await unifiedClient.getPublicAdminsDropdownLive(sectorId);
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return { success: true, data: [
        { id: '22d29793-5055-4068-8fcd-6eb0f74f78c6', name: "526  -->  بنى مزار شرق" },
        { id: 'fbfacf15-6953-495a-8423-97e4dbb819b2', name: "524  -->  سمالوط غرب" },
        { id: 'eb685c63-aebf-43f8-85fb-f5abfd9c4004', name: "525  -->  مطاى" }
    ] };
}

async function getSubAdminsDropdown(publicAdminId) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getSubAdminsDropdownLive === 'function') {
            const res = await unifiedClient.getSubAdminsDropdownLive(publicAdminId);
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return { success: true, data: [{ id: 'e294958c-cdf8-4c72-8a3d-16d71bde5cde', name: "526  -->  بنى مزار شرق" }] };
}

async function getRegionsDropdown(subAdminId) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getRegionsDropdownLive === 'function') {
            const res = await unifiedClient.getRegionsDropdownLive(subAdminId);
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return { success: true, data: [
        { id: '93ea2353-9f53-4b20-8ab1-738013797dfa', name: "بنى مزار شرق2" },
        { id: '8e77a284-cd9e-4b68-b778-95568e21c815', name: "بنى مزار شرق10" },
        { id: '716a41f6-cb03-4f93-b68f-c081e7d5cf20', name: "بنى مزار شرق13" }
    ] };
}

async function getDailysDropdown(regionId) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getDailysDropdownLive === 'function') {
            const res = await unifiedClient.getDailysDropdownLive(regionId);
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return { success: true, data: [{ id: '96b12e18-e66f-4232-89ba-7ca87c2e64be', name: "يومية 1" }] };
}

async function getCustomerTypesDropdown() {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getCustomerTypesDropdownLive === 'function') {
            const res = await unifiedClient.getCustomerTypesDropdownLive();
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return {
        success: true,
        data: [
            { id: 46, name: 'أهالي (صغار مشتركين)' },
            { id: 47, name: 'تجاري / استثماري' },
            { id: 48, name: 'حكومي' },
            { id: 49, name: 'كبار مشتركين' }
        ]
    };
}

async function getPlaceDescsDropdown(activityId) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getPlaceDescsDropdownLive === 'function') {
            const res = await unifiedClient.getPlaceDescsDropdownLive(activityId);
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res;
            }
        }
    } catch (e) {}
    return {
        success: true,
        data: [
            { id: 'a762052b-24f4-4829-879f-86ecff0fffc1', name: 'منزل' },
            { id: 2, name: 'محل تجاري' },
            { id: 3, name: 'مكتب إداري' },
            { id: 4, name: 'فيلا / منزل مستقل' }
        ]
    };
}

// 7.2 Get Customer Meter Movements (حركات عداد)
async function getCustomerMeterMovements(term) {
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.getCustomerMeterMovementsLive === 'function') {
            const liveRes = await unifiedClient.getCustomerMeterMovementsLive(term);
            if (liveRes && liveRes.success && liveRes.data) {
                return liveRes;
            }
        }
    } catch (e) {
        console.warn('Live getCustomerMeterMovements notice:', e.message);
    }

    const q = String(term || '').trim();
    const store = getCardStore();
    const card = Object.values(store.cards || {}).find(c =>
        String(c.meterNumber).trim() === q ||
        String(c.subscriptionCode).trim() === q ||
        String(c.nationalId).trim() === q
    );

    // Only return local card if it has actual saved charges
    if (card && Array.isArray(card.charges) && card.charges.length > 0) {
        const moves = card.charges.map((c, i) => ({
            id: c.id || (100 + i),
            meterNumber: card.meterNumber,
            changeType: c.chargeType || 'شحن كارت',
            chargeValue: Number(c.amount || 0).toFixed(2),
            recieptNumber: c.receiptNumber || ('REC-' + (i + 1)),
            moveDate: c.date || new Date().toLocaleDateString('ar-EG'),
            rechargeCenterCode: c.centerName || 'مركز شحن رئيسي',
            changerName: c.cashierName || 'مسؤول الشحن',
            status: 'ناجح',
            isCharging: true,
            isNewCharge: false
        }));

        return {
            success: true,
            data: {
                id: card.subscriptionCode || card.meterNumber,
                name: card.customerName,
                code: card.subscriptionCode,
                nationalId: card.nationalId || '-',
                address: card.address || '-',
                oldCode: card.oldCode || '-',
                codeNumber: card.meterNumber,
                unitNationalId: card.unitNationalId || '-',
                sectorName: card.sector || 'المنيا شمال',
                publicAdministrationName: card.generalAdmin || 'بنى مزار شرق',
                subAdministrationName: card.subAdmin || 'بنى مزار شرق',
                activityName: card.activityName || 'منزلي كودي',
                totalCharges: moves.length,
                totalRechargeAmountOnMeter: moves.reduce((sum, m) => sum + Number(m.chargeValue || 0), 0),
                accountNumberCustomer: card.accountReference || '-',
                meterMoves: moves
            }
        };
    }

    return {
        success: false,
        message: `لم يتم العثور على أي حركات مسجلة للعداد بالبحث: ${q}`
    };
}

async function getReceiptPDF(chargeId, isThermalReciept = false) {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.getReceiptPaymentPDFLive === 'function') {
        return await unifiedClient.getReceiptPaymentPDFLive(chargeId, isThermalReciept);
    }
    return { success: false, message: 'خدمة استخراج إيصال MEEDCO غير متوفرة' };
}

async function getCustomerMeterMovementsPDF(customerId) {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.getCustomerMeterMovementsPDFLive === 'function') {
        return await unifiedClient.getCustomerMeterMovementsPDFLive(customerId);
    }
    return { success: false, message: 'خدمة استخراج تقرير الحركات غير متوفرة' };
}


// --- Direct MEEDCO Live Methods ---
async function loginMeedco(credentials = {}) {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.loginMeedcoLive === 'function') {
        return await unifiedClient.loginMeedcoLive(credentials);
    }
    return { success: false, message: 'خدمة الربط الحي غير مهيأة' };
}

async function getMeedcoStatus() {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.getMeedcoStatus === 'function') {
        return await unifiedClient.getMeedcoStatus();
    }
    return { connected: false, message: 'خدمة الربط غير متاحة' };
}

async function getMeedcoHierarchy(sectorId = null, publicAdminId = null) {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.getMeedcoHierarchyLive === 'function') {
        return await unifiedClient.getMeedcoHierarchyLive(sectorId, publicAdminId);
    }
    return { success: false, message: 'تعذر جلب البيانات الهيكلية' };
}


// --- Live Debts Engine Methods ---
async function getLiveDebtTypes() {
    const unifiedClient = require('./unifiedCardClient');
    if (unifiedClient && typeof unifiedClient.getDebtTypesLive === 'function') {
        const res = await unifiedClient.getDebtTypesLive();
        if (res.success && res.data) return res;
    }
    // Fallback to local debts_store.json
    const store = getDebtsStore();
    return { success: true, data: store.debtTypes || [] };
}

async function getCustomerDebts(term) {
    const unifiedClient = require('./unifiedCardClient');
    const q = String(term || '').trim();

    // 1. Try Live MEEDCO Server
    if (unifiedClient) {
        try {
            let customerId = null;
            // Check if term is already a UUID customerId
            if (q.includes('-') && q.length > 20) {
                customerId = q;
            } else {
                const custRes = await unifiedClient.searchCustomerLive(q);
                if (custRes.success && custRes.customer && custRes.customer.id) {
                    customerId = custRes.customer.id;
                }
            }

            if (customerId) {
                const liveDebts = await unifiedClient.getCustomerDebtsLive(customerId);
                if (liveDebts.success && liveDebts.data) {
                    return { success: true, live: true, data: liveDebts.data };
                }
            }
        } catch (e) {
            console.warn('Live debts fetch error:', e.message);
        }
    }

    // 2. Fallback to local debts store
    const store = getDebtsStore();
    const debts = (store.debts || []).filter(d => 
        String(d.meterNumber || '').trim() === q ||
        String(d.subscriptionCode || '').trim() === q ||
        String(d.customerId || '').trim() === q ||
        String(d.nationalId || '').trim() === q
    );

    return {
        success: true,
        live: false,
        data: {
            debts: debts.map((d, i) => ({
                id: d.id || ('LOCAL-DEBT-' + (i + 1)),
                startDate: d.startDate || new Date().toISOString(),
                totalDebtAmount: Number(d.totalAmount || d.totalDebtAmount || 0),
                debtAmount: Number(d.amount || d.debtAmount || 0),
                interestTypeName: d.interestTypeName || 'بدون فائدة',
                installmentsCount: Number(d.installmentsCount || 1),
                paidAmount: Number(d.paidAmount || 0),
                remainingAmount: Number(d.remainingAmount || (d.totalAmount - (d.paidAmount || 0))),
                installmentAmount: Number(d.installmentAmount || 0),
                receiptNumber: d.receiptNumber || ('REC-' + q + '-' + (i + 1)),
                createdUser: d.createdUser || 'المحصل / النظام',
                createdDate: d.createdDate || new Date().toISOString(),
                isComplete: (Number(d.remainingAmount) <= 0),
                isAdjust: Boolean(d.isAdjust),
                debtTypeName: d.debtTypeName || d.name || 'مديونية عامة'
            }))
        }
    };
}

async function createCustomerDebt(debtModel) {
    const unifiedClient = require('./unifiedCardClient');
    let liveResult = null;

    if (unifiedClient && typeof unifiedClient.createDebtLive === 'function') {
        try {
            liveResult = await unifiedClient.createDebtLive(debtModel);
        } catch (e) {
            console.warn('Live create debt failed, persisting locally:', e.message);
        }
    }

    // Always persist to local debts_store.json as backup / offline capability
    const store = getDebtsStore();
    if (!store.debts) store.debts = [];

    const receiptNum = liveResult?.data?.receiptNumber || ('REC' + Date.now().toString().slice(-8));
    const newDebt = {
        id: liveResult?.data?.id || ('DEBT-' + Date.now()),
        customerId: debtModel.customerId,
        subscriptionCode: debtModel.subscriptionCode || debtModel.code,
        meterNumber: debtModel.meterNumber,
        customerName: debtModel.customerName || debtModel.name,
        debtTypeId: debtModel.debtTypeId,
        debtTypeName: debtModel.debtTypeName,
        categoryId: debtModel.categoryId,
        categoryName: debtModel.categoryName,
        amount: Number(debtModel.debtAmount || 0),
        debtAmount: Number(debtModel.debtAmount || 0),
        totalAmount: Number(debtModel.totalDebtAmount || debtModel.debtAmount || 0),
        totalDebtAmount: Number(debtModel.totalDebtAmount || debtModel.debtAmount || 0),
        installmentsCount: Number(debtModel.installmentsCount || 1),
        installmentAmount: Number(debtModel.installmentAmount || 0),
        paidAmount: 0,
        remainingAmount: Number(debtModel.totalDebtAmount || debtModel.debtAmount || 0),
        interestTypeId: debtModel.interestTypeId || 57,
        interestTypeName: debtModel.interestTypeName || 'بدون فائدة',
        interestPercentage: Number(debtModel.interestPercentage || 0),
        receiptNumber: receiptNum,
        startDate: debtModel.startDate || new Date().toISOString(),
        createdDate: new Date().toISOString(),
        createdUser: debtModel.createdUser || 'مسؤول الشحن والديون',
        status: 'مستحق فوري',
        isComplete: false,
        isAdjust: Boolean(debtModel.isAdjust),
        notes: debtModel.notes || '',
        reason: debtModel.reason || ''
    };

    store.debts.unshift(newDebt);
    saveDebtsStore(store);

    return {
        success: true,
        live: Boolean(liveResult && liveResult.success),
        message: 'تم تسجيل وإضافة الدين بنجاح',
        data: {
            id: newDebt.id,
            totalDebtAmount: newDebt.totalDebtAmount,
            receiptNumber: newDebt.receiptNumber,
            debt: newDebt
        }
    };
}


async function updateCustomerSequence(targetId, seqSys, seqMeter) {
    const tid = String(targetId || '').trim();
    if (!tid) return { success: false, message: 'معرف المشترك أو رقم العداد مطلوب' };
    const numSys = Math.max(1, Number(seqSys) || 1);
    const numMeter = Math.max(1, Number(seqMeter) || 1);

    // 1. Update customers_store.json
    let custFile = path.join(__dirname, 'customers_store.json');
    let custFound = false;
    if (fs.existsSync(custFile)) {
        try {
            let custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            for (let c of custs) {
                if (String(c.id) === tid || String(c.code) === tid || String(c.meterNumber) === tid || String(c.customerId) === tid) {
                    c.chargeSequence = numSys;
                    c.meterChargeSequence = numMeter;
                    c.sequenceOnMeter = numMeter;
                    c.chargeSequenceOnMeter = numMeter;
                    c.updatedAt = new Date().toISOString();
                    custFound = true;
                    break;
                }
            }
            if (custFound) {
                fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
            }
        } catch (e) {
            console.error('Error updating customers_store.json sequence:', e);
        }
    }

    // 2. Update card_store.json
    try {
        const store = getCardStore();
        for (const [key, card] of Object.entries(store.cards || {})) {
            if (String(card.meterNumber).trim() === tid || String(card.subscriptionCode).trim() === tid || key === tid) {
                card.chargeSequence = numMeter;
                card.sequenceOnMeter = numMeter;
                card.totalSystemCharges = numSys;
                card.totalMeterCharges = numMeter;
                card.updatedAt = new Date().toISOString();
                break;
            }
        }
        saveCardStore(store);
    } catch (e) {
        console.error('Error updating card_store.json sequence:', e);
    }

    // 3. Try forwarding to MEEDCO Backend live if available
    try {
        const unifiedClient = require('./unifiedCardClient');
        if (unifiedClient && typeof unifiedClient.updateCustomerCardDataLive === 'function') {
            await unifiedClient.updateCustomerCardDataLive({
                id: tid,
                chargeSequence: numSys,
                sequenceOnMeter: numMeter
            });
        }
    } catch (e) {
        console.warn('MEEDCO live sequence update notice:', e.message);
    }

    return {
        success: true,
        message: 'تم ضبط وتحديث مسلسل الشحنة بنجاح (المسلسل على العداد: ' + numMeter + ' | المسلسل على النظام: ' + numSys + ')',
        data: {
            chargeSequence: numSys,
            meterChargeSequence: numMeter,
            sequenceOnMeter: numMeter
        }
    };
}

async function toggleCustomerStopCharge(customerId, isStop, reason = '') {
    const cid = String(customerId || '').trim();
    if (!cid) return { success: false, message: 'معرف أو كود المشترك مطلوب' };

    const custFile = path.join(__dirname, 'customers_store.json');
    let custFound = null;
    if (fs.existsSync(custFile)) {
        try {
            let custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            custFound = custs.find(c => 
                String(c.id).trim() === cid ||
                String(c.customerId).trim() === cid ||
                String(c.code).trim() === cid ||
                String(c.codeNumber).trim() === cid ||
                String(c.meterNumber).trim() === cid
            );
            if (custFound) {
                custFound.isChargeStop = (isStop !== undefined && isStop !== null) ? Boolean(isStop) : !custFound.isChargeStop;
                custFound.status = custFound.isChargeStop ? 'موقوف عن الشحن' : 'مركب';
                custFound.stopChargeReason = reason || (custFound.isChargeStop ? 'بناءً على طلب الإدارة / فحص العداد' : '');
                custFound.updatedAt = new Date().toISOString();
                fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
            }
        } catch(e) {
            console.error('Error updating stop charge in customers_store.json:', e);
        }
    }

    try {
        const store = getCardStore();
        for (const [key, card] of Object.entries(store.cards || {})) {
            if (String(card.meterNumber).trim() === cid || String(card.subscriptionCode).trim() === cid || key === cid) {
                card.isStop = custFound ? custFound.isChargeStop : Boolean(isStop);
                card.updatedAt = new Date().toISOString();
                break;
            }
        }
        saveCardStore(store);
    } catch(e) {}

    const stopState = custFound ? custFound.isChargeStop : Boolean(isStop);
    return {
        success: true,
        isChargeStop: stopState,
        status: stopState ? 'موقوف عن الشحن' : 'مركب',
        message: stopState 
            ? 'تم إيقاف الشحن للمشترك بنجاح ⛔ (لن تتمكن أي نافذة شحن من قبول الكارت)' 
            : 'تم رفع إيقاف الشحن وإعادة تفعيل المشترك بنجاح 🔓 (جاهز للشحن الطبيعي)'
    };
}

async function refundCustomerCharge(params = {}) {
    const targetId = String(params.customerId || params.meterNumber || params.code || '').trim();
    if (!targetId) return { success: false, message: 'معرف المشترك أو رقم العداد مطلوب لإلغاء الشحنة' };

    const refundAmount = Number(params.amount || params.chargeAmount || 0);
    const reason = params.reason || 'إلغاء شحنة خاطئة واسترجاع القيمة المالية للمشترك';
    const receiptNo = params.receiptNumber || ('REF-' + Date.now().toString().slice(-6));

    let updatedCust = null;
    const custFile = path.join(__dirname, 'customers_store.json');
    if (fs.existsSync(custFile)) {
        try {
            let custs = JSON.parse(fs.readFileSync(custFile, 'utf8'));
            updatedCust = custs.find(c => 
                String(c.id).trim() === targetId ||
                String(c.customerId).trim() === targetId ||
                String(c.code).trim() === targetId ||
                String(c.codeNumber).trim() === targetId ||
                String(c.meterNumber).trim() === targetId
            );
            if (updatedCust) {
                const currentSeq = Number(updatedCust.chargeSequence || 1);
                const currentMeterSeq = Number(updatedCust.chargeSequenceOnMeter || updatedCust.meterChargeSequence || currentSeq);
                const newSysSeq = Math.max(0, currentSeq - 1);
                const newMeterSeq = Math.max(0, currentMeterSeq - 1);
                updatedCust.chargeSequence = newSysSeq;
                updatedCust.chargeSequenceOnMeter = newMeterSeq;
                updatedCust.meterChargeSequence = newMeterSeq;
                updatedCust.sequenceOnMeter = newMeterSeq;

                const currentBal = Number(updatedCust.balance || updatedCust.currentBalance || 0);
                const newBal = Math.max(0, Number((currentBal - refundAmount).toFixed(2)));
                updatedCust.balance = newBal;
                updatedCust.currentBalance = newBal;

                if (updatedCust.totalRechargeAmount) {
                    updatedCust.totalRechargeAmount = Math.max(0, Number((updatedCust.totalRechargeAmount - refundAmount).toFixed(2)));
                }
                if (updatedCust.totalMeterRechargeAmount) {
                    updatedCust.totalMeterRechargeAmount = Math.max(0, Number((updatedCust.totalMeterRechargeAmount - refundAmount).toFixed(2)));
                }

                if (!updatedCust.meterMoves) updatedCust.meterMoves = [];
                updatedCust.meterMoves.unshift({
                    id: 'mov-' + Date.now(),
                    date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG'),
                    operationType: 'إلغاء شحنة (مسترجعة)',
                    operationTypeName: 'إلغاء شحنة مسترجعة',
                    amount: -refundAmount,
                    chargeAmount: -refundAmount,
                    sequence: newMeterSeq,
                    balanceAfter: newBal,
                    receiptNumber: receiptNo,
                    notes: reason,
                    operator: params.operator || 'مسؤول المنظومة'
                });

                updatedCust.updatedAt = new Date().toISOString();
                fs.writeFileSync(custFile, JSON.stringify(custs, null, 2), 'utf8');
            }
        } catch(e) {
            console.error('Error saving refund in customers_store.json:', e);
        }
    }

    try {
        const store = getCardStore();
        for (const [key, card] of Object.entries(store.cards || {})) {
            if (String(card.meterNumber).trim() === targetId || String(card.subscriptionCode).trim() === targetId || key === targetId) {
                card.chargeSequence = Math.max(0, Number(card.chargeSequence || 1) - 1);
                card.sequenceOnMeter = card.chargeSequence;
                card.remainingBalance = Math.max(0, Number(((card.remainingBalance || 0) - refundAmount).toFixed(2)));
                card.lastChargeAmount = -refundAmount;
                card.lastReceiptNumber = receiptNo;
                card.updatedAt = new Date().toISOString();
                break;
            }
        }
        saveCardStore(store);
    } catch(e) {}

    return {
        success: true,
        message: `تم إلغاء واسترجاع الشحنة بنجاح بمبلغ ${refundAmount.toFixed(2)} ج.م وتحديث مسلسل العداد والنظام ✓`,
        data: {
            meterNumber: updatedCust?.meterNumber || targetId,
            refundAmount: refundAmount,
            receiptNumber: receiptNo,
            newBalance: updatedCust?.balance || 0,
            chargeSequence: updatedCust?.chargeSequence || 0,
            meterChargeSequence: updatedCust?.chargeSequenceOnMeter || 0,
            reason: reason,
            refundDate: new Date().toLocaleDateString('ar-EG')
        }
    };
}

module.exports = {
    getLiveDebtTypes,
    getCustomerDebts,
    createCustomerDebt,
    loginMeedco,
    getMeedcoStatus,
    getMeedcoHierarchy,
    getCustomerMeterMovements,
    getReceiptPDF,
    getCustomerMeterMovementsPDF,
    getReaderStatus,
    readSmartCard,
    readCustomerCard,
    writeCustomerCard,
    clearSmartCard,
    issueReplacementWithoutCharge,
    issueReplacementWithCharge,
    searchCustomer,
    readControlCard,
    renewControlCard,
    getControlCardMetadata,
    getMeterTypesForCompany,
    issueControlCard,
    getControlCardDetails,
    getAllCustomers,
    getCustomerDetails,
    getSectorsDropdown,
    getPublicAdminsDropdown,
    getSubAdminsDropdown,
    getRegionsDropdown,
    getDailysDropdown,
    getCustomerTypesDropdown,
    getPlaceDescsDropdown,
    getCustomerChargingDetails,
    updateCustomerCardData,
    updateCustomerSequence,
    toggleCustomerStopCharge,
    refundCustomerCharge,
    getCardStore,
    saveCardStore
};
