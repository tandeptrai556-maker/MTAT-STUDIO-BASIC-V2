const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");
//const login = require("../fca-unofficial");
const login = require('@dongdev/fca-unofficial')
const fs = require('fs-extra');
const moment = require('moment-timezone');
if (!fs.existsSync('./utils/data')) {
  fs.mkdirSync('./utils/data', { recursive: true });
}
global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleReaction: [],
  handleReply: [],
  mainPath: process.cwd(),
  configPath: "",
  getTime: option => moment.tz("Asia/Ho_Chi_Minh").format({ seconds: "ss", minutes: "mm", hours: "HH", date: "DD", month: "MM", year: "YYYY", fullHour: "HH:mm:ss", fullYear: "DD/MM/YYYY", fullTime: "HH:mm:ss DD/MM/YYYY" }[option])
};
global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});
global.utils = require("./utils/func");
global.config = require('./config.json');
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();
const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}
global.getText = function (...args) {
    const langText = global.language;    
    if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}
// ════════════════════════════════════════════════════════════
//  HỆ THỐNG MULTI-ACCOUNT – Tự đổi acc khi cookie die
//  Đặt các file appstate vào thư mục  accounts/
//    accounts/acc1.json  (JSON appstate)
//    accounts/acc2.json
//    accounts/acc3.json  ...
//  File accounts/current.json lưu index account đang dùng.
//  Nếu thư mục accounts/ không có gì thì dùng appstate.json / cookie.txt như cũ.
// ════════════════════════════════════════════════════════════

const ACCOUNTS_DIR    = join(__dirname, 'accounts');
const CURRENT_ACC_FILE = join(ACCOUNTS_DIR, 'current.json');

/** Trả về danh sách đường dẫn các file account */
function getAccountFiles() {
    const list = [];
    // 1) Các file trong accounts/
    if (existsSync(ACCOUNTS_DIR)) {
        const files = fs.readdirSync(ACCOUNTS_DIR)
            .filter(f => f.endsWith('.json') && f !== 'current.json')
            .sort(); // acc1, acc2, acc3 ...
        for (const f of files) list.push(join(ACCOUNTS_DIR, f));
    }
    // 2) appstate.json gốc (nếu có)
    if (existsSync('./appstate.json')) list.push(join(__dirname, 'appstate.json'));
    return list;
}

/** Lấy index account hiện tại từ file lưu trữ */
function getCurrentIndex() {
    try {
        if (existsSync(CURRENT_ACC_FILE)) {
            return JSON.parse(readFileSync(CURRENT_ACC_FILE, 'utf8')).index || 0;
        }
    } catch (_) {}
    return 0;
}

/** Lưu index account hiện tại */
function saveCurrentIndex(index) {
    if (!existsSync(ACCOUNTS_DIR)) fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
    writeFileSync(CURRENT_ACC_FILE, JSON.stringify({ index }, null, 2));
}

/** Đọc appstate từ file (JSON array hoặc cookie string) */
function readAccountFile(filePath) {
    const raw = readFileSync(filePath, 'utf8').trim();
    try {
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) return { appState: data };
    } catch (_) {}
    // Thử parse cookie string
    if (raw.length > 0) return { appState: global.utils.parseCookies(raw) };
    throw new Error('File không hợp lệ: ' + filePath);
}

/** Kiểm tra lỗi có phải cookie/session die không */
function isCookieDead(err) {
    if (!err) return false;
    const msg = (typeof err === 'string' ? err : JSON.stringify(err)).toLowerCase();
    return (
        msg.includes('login') ||
        msg.includes('session') ||
        msg.includes('cookie') ||
        msg.includes('not logged') ||
        msg.includes('checkpoint') ||
        msg.includes('invalid') ||
        msg.includes('account disabled') ||
        msg.includes('please log in')
    );
}

/**
 * Hàm login chính – có thể gọi đệ quy để thử account tiếp theo.
 * @param {object} models  – Sequelize models
 * @param {number} accIndex – index account đang thử
 * @param {number} tried    – số account đã thử (tránh vòng lặp vô tận)
 */
function tryLogin({ models, accIndex, tried = 0 }) {
    const accountFiles = getAccountFiles();

    // ─── Không có account nào → fallback cookie.txt cũ ────────
    if (accountFiles.length === 0) {
        if (existsSync('./cookie.txt')) {
            try {
                const raw = readFileSync('./cookie.txt', 'utf8').trim();
                if (raw.length > 0) {
                    logger('✅ Dùng cookie.txt (không có thư mục accounts/)', '[ LOGIN ]');
                    doLogin({ loginData: { appState: global.utils.parseCookies(raw) }, models, accIndex: 0, accountFiles: [], tried });
                    return;
                }
            } catch (_) {}
        }
        logger('❌ Không tìm thấy file đăng nhập!\nTạo thư mục accounts/ với acc1.json, acc2.json... hoặc để appstate.json / cookie.txt.', '[ LOGIN ]');
        process.exit(1);
        return;
    }

    // ─── Chọn account theo index (xoay vòng) ──────────────────
    const idx   = accIndex % accountFiles.length;
    const fPath = accountFiles[idx];
    logger(`📂 Đang đăng nhập bằng account [${idx + 1}/${accountFiles.length}]: ${require('path').basename(fPath)}`, '[ LOGIN ]');

    let loginData;
    try {
        loginData = readAccountFile(fPath);
    } catch (e) {
        logger(`⚠️  Không đọc được ${fPath}: ${e.message} → thử account tiếp theo`, '[ LOGIN ]');
        return tryNextAccount({ models, accIndex, accountFiles, tried });
    }

    doLogin({ loginData, models, accIndex: idx, accountFiles, tried, fPath });
}

/** Thử account tiếp theo (tránh vòng lặp nếu tất cả đều chết) */
function tryNextAccount({ models, accIndex, accountFiles, tried }) {
    if (tried >= accountFiles.length) {
        logger(`❌ Tất cả ${accountFiles.length} account đều không đăng nhập được. Thoát...`, '[ LOGIN ]');
        process.exit(2); // exit 2 → index.js sẽ restart sau vài giây
        return;
    }
    const nextIdx = (accIndex + 1) % accountFiles.length;
    saveCurrentIndex(nextIdx);
    logger(`🔄 Chuyển sang account [${nextIdx + 1}/${accountFiles.length}]...`, '[ LOGIN ]');
    setTimeout(() => tryLogin({ models, accIndex: nextIdx, tried: tried + 1 }), 3000);
}

/** Thực hiện login FCA với loginData đã chuẩn bị */
function doLogin({ loginData, models, accIndex, accountFiles, tried, fPath }) {
    login(loginData, async (loginError, api) => {
        if (loginError) {
            const errStr = JSON.stringify(loginError);
            logger(`⚠️  Đăng nhập thất bại: ${errStr}`, '[ LOGIN ]');
            if (isCookieDead(loginError)) {
                logger('💀 Cookie/Session đã chết!', '[ LOGIN ]');
                // Đổi tên file die để bỏ qua lần sau
                if (fPath && existsSync(fPath)) {
                    try {
                        fs.renameSync(fPath, fPath + '.died');
                        logger(`🗑️  Đã đánh dấu ${require('path').basename(fPath)} là .died`, '[ LOGIN ]');
                    } catch (_) {}
                }
                return tryNextAccount({ models, accIndex, accountFiles, tried });
            }
            // Lỗi khác (network...) → restart toàn bộ process sau 10s
            logger('⏳ Lỗi kết nối, thử lại sau 10 giây...', '[ LOGIN ]');
            setTimeout(() => tryLogin({ models, accIndex, tried }), 10000);
            return;
        }
        api.setOptions(global.config.FCAOption);
        // Lưu lại appstate mới nhất vào đúng file account đang dùng
        try {
            const newAppState = api.getAppState();
            const savePath = (fPath && existsSync(require('path').dirname(fPath))) ? fPath : join(__dirname, 'appstate.json');
            writeFileSync(savePath, JSON.stringify(newAppState, null, 2));
            logger('💾 Đã lưu appstate mới nhất → ' + require('path').basename(savePath), '[ LOGIN ]');
            saveCurrentIndex(accIndex);
        } catch (_) {}
        global.config.version = '3.0.0';
        global.client.timeStart = new Date().getTime();
        global.client.api = api;
        const userId = api.getCurrentUserID();
        const user = await api.getUserInfo([userId]);
        const userName = user[userId]?.name || null;
        logger(`✅ Đăng nhập thành công - ${userName} (${userId})`, '[ LOGIN ] >');
        console.log(require('chalk').cyan(
          "\n╔══════════════════════════════════════╗\n" +
          "║         🤖  MTAT STUDIO BOT          ║\n" +
          "║          Messenger Chatbot           ║\n" +
          "╚══════════════════════════════════════╝\n"
        ));
        const moment = require('moment-timezone');
        const startTime = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
        logger(`🚀 Bot: ${global.config.BOTNAME} | Prefix: ${global.config.PREFIX} | Phiên bản: ${global.config.version}`, '[ MTAT STUDIO ]');
        logger(`⏰ Khởi động lúc: ${startTime}`, '[ MTAT STUDIO ]');
        (function () {
            const loadModules = (path, collection, disabledList, type) => {
              const items = readdirSync(path).filter(file => file.endsWith('.js') && !file.includes('example') && !disabledList.includes(file));
              let loadedCount = 0;   
              for (const file of items) {
                try {
                  const item = require(join(path, file));
                  const { config, run, onLoad, handleEvent } = item;
                  if (!config || !run || (type === 'commands' && !config.commandCategory)) {
                    throw new Error(`Lỗi định dạng trong ${type === 'commands' ? 'lệnh' : 'sự kiện'}: ${file}`);
                  }  
                  if (global.client[collection].has(config.name)) {
                    throw new Error(`Tên ${type === 'commands' ? 'lệnh' : 'sự kiện'} đã tồn tại: ${config.name}`);
                  }
                  if (config.envConfig) {
                    global.configModule[config.name] = global.configModule[config.name] || {};
                    global.config[config.name] = global.config[config.name] || {};  
                    for (const key in config.envConfig) {
                      global.configModule[config.name][key] = global.config[config.name][key] || config.envConfig[key] || '';
                      global.config[config.name][key] = global.configModule[config.name][key];
                    }
                  }
                  if (onLoad) onLoad({ api, models });
                  if (handleEvent) global.client.eventRegistered.push(config.name);
                  global.client[collection].set(config.name, item);
                  loadedCount++;
                } catch (error) {
                  console.error(`Lỗi khi tải ${type === 'commands' ? 'lệnh' : 'sự kiện'} ${file}:`, error);
                }
              }
              if (loadedCount === 0) {
                console.log(`Không tìm thấy ${type === 'commands'? 'lệnh' :'sự kiện'} nào trong thư mục ${path}`); 
              }
              return loadedCount;
            };
            const commandPath = join(global.client.mainPath, 'modules', 'commands');
            const eventPath = join(global.client.mainPath, 'modules', 'events');
            // FIX: lưu vào global để dùng ngoài IIFE scope
            global._loadedCommandsCount = loadModules(commandPath, 'commands', global.config.commandDisabled, 'commands');
            logger.loader(`Loaded ${global._loadedCommandsCount} commands`);    
            global._loadedEventsCount = loadModules(eventPath, 'events', global.config.eventDisabled, 'events');
            logger.loader(`Loaded ${global._loadedEventsCount} events`);
        })();
        logger.loader(' Ping load source: ' + (Date.now() - global.client.timeStart) + 'ms');
        logger(`🎉 ${global.config.BOTNAME} đã sẵn sàng hoạt động! Đã tải ${global._loadedCommandsCount} lệnh và ${global._loadedEventsCount} sự kiện.`, '[ MTAT STUDIO ]');
        writeFileSync('./config.json', JSON.stringify(global.config, null, 4), 'utf8');
        const listener = require('./includes/listen')({ api, models });
        function listenerCallback(error, event) {
          if (error) {
            if (JSON.stringify(error).includes("601051028565049")) {
              const form = {
                av: api.getCurrentUserID(),
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "FBScrapingWarningMutation",
                variables: "{}",
                server_timestamps: "true",
                doc_id: "6339492849481770",
              };
              api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
                const res = JSON.parse(i);
                if (e || res.errors) return logger("Lỗi không thể xóa cảnh cáo của facebook.", "error");
                if (res.data.fb_scraping_warning_clear.success) {
                  logger("Đã vượt cảnh cáo facebook thành công.", "[ SUCCESS ] >");
                  connect_mqtt();
                }
              });
            } else {
              return logger(global.getText("mirai", "handleListenError", JSON.stringify(error)), "error");
            }
          }
          if (!event) return;
          if (["presence", "typ", "read_receipt"].some((data) => data === event?.type)) return;
          if (global.config.DeveloperMode) console.log(event);
          return listener(event);
        }
        let mqttRestartTimer = null;
        function connect_mqtt() {
          // Dừng kết nối cũ nếu có
          if (global.handleListen) {
            try {
              if (typeof global.handleListen.end === 'function') global.handleListen.end();
              else if (typeof global.handleListen === 'function') global.handleListen();
            } catch (_) {}
          }
          if (mqttRestartTimer) clearTimeout(mqttRestartTimer);
          global.handleListen = api.listenMqtt(listenerCallback);
          // Reconnect sau 1 giờ để tránh disconnect tự nhiên
          mqttRestartTimer = setTimeout(() => connect_mqtt(), 1000 * 60 * 60 * 1);
          logger(global.getText('mirai', 'successConnectMQTT'), '[ MQTT ]');
        }
        connect_mqtt();

        // Detect cookie die trong lúc bot đang chạy
        process.on("uncaughtException", (err) => {
            const msg = (err && err.message) ? err.message : String(err);
            logger('💥 Lỗi không bắt được: ' + msg, '[ CRASH ]');
            if (isCookieDead(msg)) {
                logger('💀 Cookie die khi đang chạy → đổi tài khoản...', '[ LOGIN ]');
                if (fPath && existsSync(fPath)) {
                    try { fs.renameSync(fPath, fPath + '.died'); } catch (_) {}
                }
                const allAcc = getAccountFiles();
                saveCurrentIndex((accIndex + 1) % Math.max(allAcc.length, 1));
                process.exit(2);
            } else {
                process.exit(1);
            }
        });
    });
}

(async() => {
    try {
        const { Sequelize, sequelize } = require("./includes/database");
        await sequelize.authenticate();
        const models = require('./includes/database/model')({ Sequelize, sequelize });
        logger(global.getText('mirai', 'successConnectDatabase'), '[ DATABASE ]');
        // Lấy index account hiện tại rồi bắt đầu đăng nhập
        const startIndex = getCurrentIndex();
        tryLogin({ models, accIndex: startIndex, tried: 0 });
    } catch (error) {
        logger('❌ Lỗi kết nối database: ' + error, '[ DATABASE ]');
        process.exit(1);
    }
})();
process.on("unhandledRejection", (err, p) => { console.log(p); });