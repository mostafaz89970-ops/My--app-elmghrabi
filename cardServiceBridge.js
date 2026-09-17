/**
 * Card Service Bridge - Compatibility shim
 * يوجه الطلبات مباشرة إلى الخادم المحلي المدمج المستقل internalCardServer
 */
const { startInternalServer } = require('./internalCardServer');
startInternalServer(5002);
