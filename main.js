const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// ضبط وتوسيع ذاكرة V8 المخصصة للتطبيق إلى 8 جيجابايت لاستيعاب ملايين المشتركين والعمليات الضخمة
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch('disk-cache-size', '1073741824'); // 1GB
app.commandLine.appendSwitch('enable-features', 'IndexedDBLargeValuePreload');

// Initialize knex for SQLite
let db;

let mainWindow;
let splashWindow;

function createWindow() {
  // إنشاء نافذة المتصفح الرئيسية.
  // show: false لمنع ظهور النافذة الرئيسية حتى يتم تحميلها بالكامل
  mainWindow = new BrowserWindow({
    title: 'المنظومة الموحدة للعدادات',
    width: 1280,
    height: 800,
    show: false, 
    webPreferences: {
      // __dirname هو المسار الحالي للملف (main.js) 
      // path.join يضمن توافق المسار مع جميع أنظمة التشغيل
      preload: path.join(__dirname, 'preload.js'),
      // من المهم ضبط nodeIntegration على false و contextIsolation على true لأسباب أمنية
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // يمنع تجميد الواجهة عند انشغال النظام
      // webSecurity: false is not recommended. Let's keep it true for security.
      // If you face issues with loading local files, it's better to handle them properly
      // than disabling web security.
    },
    icon: path.join(__dirname, 'icon.png') // يمكنك إضافة أيقونة للتطبيق هنا
  });

  // تفريغ الكاش بالكامل عند الإقلاع لضمان تحميل أحدث الأكواد والتعديلات فوراً
  mainWindow.webContents.session.clearCache();

  // تحميل ملف index.html الخاص بالتطبيق.
  mainWindow.loadFile(path.join(__dirname, 'المنظومة الموحدة للعدادات.html'));

  // السماح بنوافذ الطباعة الداخلية وفتح الروابط الخارجية في المتصفح الافتراضي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || url.startsWith('blob:') || !url.startsWith('http')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // إعادة تحميل النافذة تلقائياً في حالة انهيار عملية العرض (الشاشة البيضاء)
  mainWindow.webContents.on('render-process-gone', (event, detailed) => {
    console.log(`!Renderer Crashed! Reason: ${detailed.reason} - Reloading...`);
  });

  // --- Live Reload for Development ---
  // This will automatically reload the window when you make changes to the source code.
  // It's only active when the app is not packaged (i.e., in development).
  // To use this, run `npm run dev` from your terminal.
  // تم تعطيل خاصية إعادة التحميل التلقائي (Live Reload) نهائياً لحل مشكلة تعارض حفظ البيانات عند استخدام VS Code
  // if (!app.isPackaged) {
  //   const chokidar = require('chokidar');
  //   chokidar.watch([
  //     path.join(__dirname, 'المنظومة الموحدة للعدادات.html'),
  //     path.join(__dirname, 'index.css'),
  //     path.join(__dirname, 'dist')
  //   ], { ignoreInitial: true }).on('all', (event, path) => {
  //     console.log(`Change detected (${event}), reloading window...`);
  //     mainWindow.webContents.reload();
  //   });
  // }

  // عندما تكون النافذة الرئيسية جاهزة للعرض، أظهرها وأغلق شاشة البداية
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true, // لجعل الخلفية شفافة إذا كانت الصورة تحتوي على شفافية
    frame: false,      // لإزالة شريط العنوان والأزرار
    alwaysOnTop: true, // لتكون دائماً في المقدمة
    resizable: false,  // لمنع تغيير حجمها
    show: false,       // لا تظهر النافذة حتى يتم تحميلها بالكامل
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  // عندما تكون شاشة البداية جاهزة للعرض، أظهرها
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

const isMac = process.platform === 'darwin';

const menuTemplate = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  {
    label: 'ملف',
    submenu: [
      isMac ? { role: 'close', label: 'إغلاق' } : { role: 'quit', label: 'خروج' }
    ]
  },
  {
    label: 'أدوات',
    submenu: [
      {
        label: 'فتح أدوات المطور',
        accelerator: 'Ctrl+Shift+I',
        click: (item, focusedWindow) => {
          focusedWindow.webContents.toggleDevTools();
        }
      }
    ]
  }
];

async function setupDatabase() {
  const hasTable = await db.schema.hasTable('app_state');
  if (!hasTable) {
    await db.schema.createTable('app_state', (table) => {
      table.string('key').primary();
      table.text('value');
    });
    console.log('Database table "app_state" created.');
  }
}

// هذه الدالة سيتم استدعاؤها عندما يكون Electron جاهزًا.
app.whenReady().then(() => {
  // محاولة تهيئة قاعدة البيانات عند بدء التشغيل
  try {
    const knex = require('knex');
    db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: path.join(app.getPath('userData'), 'database.sqlite')
      },
      useNullAsDefault: true
    });
  } catch (err) {
    dialog.showErrorBox('خطأ في تشغيل النظام', 'فشل تحميل محرك قاعدة البيانات.\nيرجى التأكد من تثبيت Visual C++ Redistributable أو إعادة بناء التطبيق.\n\n' + err.message);
    app.quit();
    return;
  }

  setupDatabase().then(() => {
    // تشغيل خادم محرك الكروت المحلي المدمج تلقائياً وبشكل مستقل
    try {
      const { startInternalServer } = require('./internalCardServer');
      startInternalServer(5002);
    } catch (sErr) {
      console.error('Failed to start internal card server:', sErr);
    }

    createSplashWindow(); // أنشئ شاشة البداية أولاً
    createWindow();       // ثم أنشئ النافذة الرئيسية

    // --- منطق التحديث التلقائي المحسّن ---
    // بمجرد أن تصبح النافذة جاهزة، ابدأ في البحث عن التحديثات بصمت في الخلفية.
    mainWindow.once('ready-to-show', () => {
      autoUpdater.checkForUpdates();
    });

    // --- رسائل تتبع حالة التحديث (للتصحيح والمطور) ---
    autoUpdater.on('checking-for-update', () => {
      console.log('جاري البحث عن تحديثات...');
    });
    autoUpdater.on('update-available', (info) => {
      console.log('تم العثور على تحديث جديد، جاري التنزيل...', info);
    });
    autoUpdater.on('update-not-available', (info) => {
      console.log('أنت تستخدم أحدث إصدار.', info);
    });
    autoUpdater.on('error', (err) => {
      console.error('خطأ في التحديث التلقائي: ' + err.message);
      dialog.showErrorBox('خطأ في التحديث', 'حدث خطأ أثناء محاولة تحديث البرنامج: ' + err.message);
    });
    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = `سرعة التنزيل: ${progressObj.bytesPerSecond} - تم تنزيل ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      console.log(log_message);
      // يمكنك إرسال هذه البيانات إلى واجهة المستخدم لعرض شريط تقدم
      mainWindow.webContents.send('download-progress', progressObj);
    });
    autoUpdater.on('update-downloaded', (info) => {
      console.log('تم تحميل التحديث بنجاح.', info);
      dialog.showMessageBox({
        type: 'info',
        title: 'تحديث جاهز',
        message: 'تم تحميل إصدار جديد من البرنامج. هل تريد إعادة التشغيل لتثبيت التحديث الآن؟',
        buttons: ['إعادة التشغيل الآن', 'لاحقاً']
      }).then((result) => {
        if (result.response === 0) { // 0 هو زر "إعادة التشغيل الآن"
          autoUpdater.quitAndInstall();
        }
      });
    });
  }).catch(err => {
    console.error('Database setup failed:', err);
    dialog.showErrorBox('خطأ في قاعدة البيانات', 'فشل إعداد جداول قاعدة البيانات.\n' + err.message);
    app.quit();
  });

  app.on('activate', () => {
    // على نظام macOS، من الشائع إعادة إنشاء نافذة في التطبيق عندما
    // يتم النقر على أيقونة dock ولا توجد نوافذ أخرى مفتوحة.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

// --- Automatic Backup and Restore Logic ---
const backupPath = path.join(app.getPath('userData'), 'backup.json'); // Legacy backup file

// Listen for the 'before-quit' event to save a backup
app.on('before-quit', async (event) => {
  if (mainWindow) {
    try {
      // Get state from the database
      const stateRecord = await db('app_state').where('key', 'appState').first();
      const appState = stateRecord ? stateRecord.value : null;
      if (appState) {
        fs.writeFileSync(backupPath, appState, 'utf-8');
        console.log('Automatic backup created successfully at:', backupPath);
      }
    } catch (err) {
      console.error('Failed to create automatic backup:', err);
    } 
  }
});

// Handle request from renderer to get backup data
ipcMain.handle('get-backup-data', (event) => {
  if (fs.existsSync(backupPath)) {
    return fs.readFileSync(backupPath, 'utf-8');
  }
  return null;
});

// --- New Database IPC Handlers ---
ipcMain.handle('db:getState', async () => {
  try {
    const result = await db('app_state').where('key', 'appState').first();
    return result ? result.value : null;
  } catch (err) {
    console.error('Failed to get state from DB:', err);
    return null;
  }
});

ipcMain.handle('db:saveState', async (event, stateJSON) => {
  try {
    await db('app_state').insert({ key: 'appState', value: stateJSON }).onConflict('key').merge();
    return { success: true };
  } catch (err) {
    console.error('Failed to save state to DB:', err);
    return { success: false, error: err.message };
  }
});

// --- App Version IPC Handler ---
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// --- Check for Updates IPC Handler ---
ipcMain.handle('check-for-updates', async () => {
  try {
    // checkForUpdates returns a Promise<UpdateCheckResult>
    const result = await autoUpdater.checkForUpdates();
    // We return basic info to the renderer
    return { success: true, updateInfo: result ? result.updateInfo : null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Smart Card Reader Handlers ---
const cardReader = require('./cardReader');

ipcMain.handle('smart-card:status', async () => {
  return await cardReader.getReaderStatus();
});

ipcMain.handle('smart-card:read', async (event, mockData) => {
  return await cardReader.readSmartCard(mockData);
});

ipcMain.handle('control-card:read', async () => {
  return await cardReader.readControlCard();
});

ipcMain.handle('control-card:renew', async (event, cardId, generationType, vendorCode) => {
  return await cardReader.renewControlCard(cardId, generationType, vendorCode);
});

ipcMain.handle('control-card:metadata', async () => {
  return await cardReader.getControlCardMetadata();
});

ipcMain.handle('control-card:meter-types', async (event, companyId) => {
  return await cardReader.getMeterTypesForCompany(companyId);
});

ipcMain.handle('control-card:issue', async (event, params) => {
  return await cardReader.issueControlCard(params);
});

// --- Customer Card Handlers (قراءة وشحن ومسح وكروت بديلة) ---
ipcMain.handle('customer-card:read', async () => {
  return await cardReader.readCustomerCard();
});

ipcMain.handle('customer-card:write', async (event, params) => {
  return await cardReader.writeCustomerCard(params);
});

ipcMain.handle('customer-card:clear', async (event, params) => {
  return await cardReader.clearSmartCard(params);
});

ipcMain.handle('customer-card:replace-no-charge', async (event, params) => {
  return await cardReader.issueReplacementWithoutCharge(params);
});

ipcMain.handle('customer-card:replace-with-charge', async (event, params) => {
  return await cardReader.issueReplacementWithCharge(params);
});

ipcMain.handle('customer-card:charging-details', async (event, customerId) => {
  return await cardReader.getCustomerChargingDetails(customerId);
});

// أغلق التطبيق عند إغلاق جميع النوافذ (باستثناء macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});