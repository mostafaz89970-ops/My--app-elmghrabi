/**
 * Smart Card Reader Module - منظومة العدادات 2025
 * يعمل بالكامل محلياً وبشكل مستقل عبر محرك الكروت المباشر (nativeCardEngine)
 * دون الحاجة لأي تطبيق خارجي أو خدمة وسيطة
 */

const nativeEngine = require('./nativeCardEngine');

module.exports = {
    getReaderStatus: nativeEngine.getReaderStatus,
    readSmartCard: nativeEngine.readSmartCard,
    readControlCard: nativeEngine.readControlCard,
    renewControlCard: nativeEngine.renewControlCard,
    getControlCardMetadata: nativeEngine.getControlCardMetadata,
    getMeterTypesForCompany: nativeEngine.getMeterTypesForCompany,
    issueControlCard: nativeEngine.issueControlCard,
    getControlCardDetails: nativeEngine.getControlCardDetails,
    getAllCustomers: nativeEngine.getAllCustomers,
    getCustomerDetails: nativeEngine.getCustomerDetails,
    getSectorsDropdown: nativeEngine.getSectorsDropdown,
    getPublicAdminsDropdown: nativeEngine.getPublicAdminsDropdown,
    getSubAdminsDropdown: nativeEngine.getSubAdminsDropdown,
    getRegionsDropdown: nativeEngine.getRegionsDropdown,
    getDailysDropdown: nativeEngine.getDailysDropdown,
    getCustomerTypesDropdown: nativeEngine.getCustomerTypesDropdown,
    getPlaceDescsDropdown: nativeEngine.getPlaceDescsDropdown,
    readCustomerCard: nativeEngine.readCustomerCard,
    getCustomerChargingDetails: nativeEngine.getCustomerChargingDetails,
    writeCustomerCard: nativeEngine.writeCustomerCard,
    updateCustomerCardData: nativeEngine.updateCustomerCardData,
    clearSmartCard: nativeEngine.clearSmartCard,
    issueReplacementWithoutCharge: nativeEngine.issueReplacementWithoutCharge,
    issueReplacementWithCharge: nativeEngine.issueReplacementWithCharge,
    getCardStore: nativeEngine.getCardStore,
    saveCardStore: nativeEngine.saveCardStore
};
