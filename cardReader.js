/**
 * Smart Card Reader Module - منظومة العدادات 2025
 * يمرر عمليات القارئ إلى nativeCardEngine، بينما تُعتمد بيانات كارت التحكم من MEEDCO.
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
    searchCustomer: nativeEngine.searchCustomer,
    getCustomerMeterMovements: nativeEngine.getCustomerMeterMovements,
    getCustomerMeterMovementsPDF: nativeEngine.getCustomerMeterMovementsPDF,
    getReceiptPDF: nativeEngine.getReceiptPDF,
    getCardStore: nativeEngine.getCardStore,
    saveCardStore: nativeEngine.saveCardStore
};
