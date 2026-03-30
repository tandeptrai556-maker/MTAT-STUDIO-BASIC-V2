/**
 * ╔══════════════════════════════════════════╗
 * ║     AUTOBANK – MTAT STUDIO Bot V3        ║
 * ║  Tự động phát hiện CK & kích hoạt thuê  ║
 * ╚══════════════════════════════════════════╝
 *
 * API sử dụng: https://api.sieuthicode.net
 * Cấu hình trong config.json → "autobank"
 *
 * Nội dung CK format: THUEBOT [threadID]
 * Ví dụ: THUEBOT 123456789012345
 */

const fs      = require('fs-extra');
const path    = require('path');
const axios   = require('axios');
const logger  = require('../utils/log');
const moment  = require('moment-timezone');

// ── Đường dẫn file lưu dữ liệu ────────────────────────────
const DATA_FILE = path.join(__dirname, '../utils/data/thuebot_data.json');

// ── Đọc / Ghi dữ liệu ────────────────────────────────────
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const init = { rentals: {}, processedTxns: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
        return init;
    }
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch (_) { return { rentals: {}, processedTxns: [] }; }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Lấy giá thuê theo gói ────────────────────────────────
function getPrice(days) {
    const cfg = global.config?.autobank?.goiThue || {};
    return cfg[String(days)] || null;
}

// ── Kiểm tra nhóm còn hạn không ─────────────────────────
function isRented(threadID) {
    const data = loadData();
    const rental = data.rentals[String(threadID)];
    if (!rental) return false;
    return rental.expiry > Date.now();
}

// ── Lấy thông tin hạn thuê ───────────────────────────────
function getRentalInfo(threadID) {
    const data = loadData();
    return data.rentals[String(threadID)] || null;
}

// ── Thêm / gia hạn nhóm (cộng thêm số ngày) ─────────────
function addRental(threadID, days, owner = null) {
    const data   = loadData();
    const key    = String(threadID);
    const now    = Date.now();
    const msDay  = 86400000;

    const current = data.rentals[key];
    // Nếu còn hạn → cộng tiếp, nếu hết → tính từ now
    const base   = (current && current.expiry > now) ? current.expiry : now;
    const expiry = base + days * msDay;

    data.rentals[key] = {
        expiry,
        owner:      owner || current?.owner || null,
        totalDays:  (current?.totalDays || 0) + days,
        renewCount: (current?.renewCount || 0) + 1,
        lastRenew:  moment().tz('Asia/Ho_Chi_Minh').format('HH:mm DD/MM/YYYY')
    };
    saveData(data);
    return data.rentals[key];
}

// ── Xóa thuê ─────────────────────────────────────────────
function removeRental(threadID) {
    const data = loadData();
    delete data.rentals[String(threadID)];
    saveData(data);
}

// ════════════════════════════════════════════════════════
//  POLLING – Lấy giao dịch từ API sieuthicode.net
// ════════════════════════════════════════════════════════
let pollingTimer = null;

async function fetchTransactions() {
    const cfg      = global.config?.autobank || {};
    const token    = cfg.apiToken || '';
    const limit    = cfg.limit    || 20;
    const endpoint = cfg.apiEndpoint || 'https://api.sieuthicode.net/api/history';

    if (!token) return [];

    try {
        const res = await axios.get(endpoint, {
            params:  { token, limit },
            timeout: 10000,
            headers: { 'User-Agent': 'MTAT-Studio-Bot/3.0' }
        });
        const body = res.data;

        // Tương thích nhiều cấu trúc trả về phổ biến
        if (Array.isArray(body))           return body;
        if (Array.isArray(body?.data))     return body.data;
        if (Array.isArray(body?.result))   return body.result;
        if (Array.isArray(body?.records))  return body.records;
        return [];
    } catch (err) {
        logger(`⚠️  AutoBank fetch lỗi: ${err.message}`, '[ AUTOBANK ]');
        return [];
    }
}

// ── Xử lý 1 giao dịch ───────────────────────────────────
async function processTxn(txn, api) {
    const cfg    = global.config?.autobank || {};
    const prefix = (cfg.contentPrefix || 'THUEBOT').toUpperCase();
    const data   = loadData();

    // Lấy ID giao dịch – hỗ trợ nhiều tên field
    const txnID = String(txn.id || txn.transaction_id || txn.trans_id || txn._id || '');
    if (!txnID || data.processedTxns.includes(txnID)) return;

    // Lấy nội dung CK – hỗ trợ nhiều tên field
    const desc = String(
        txn.description || txn.content || txn.memo ||
        txn.remark      || txn.note    || ''
    ).toUpperCase().trim();

    // Lấy số tiền nhận vào
    const amount = Number(
        txn.amount || txn.creditAmount || txn.in ||
        txn.value  || txn.money        || 0
    );

    // Chỉ xử lý giao dịch tiền vào (credit)
    const txnType = String(txn.type || txn.direction || 'in').toLowerCase();
    if (txnType === 'out' || txnType === 'debit' || amount <= 0) return;

    // Kiểm tra nội dung khớp format: THUEBOT <threadID>
    const regex = new RegExp(`${prefix}\\s+(\\d{10,20})`, 'i');
    const match = desc.match(regex);
    if (!match) return;

    const threadID = match[1];

    // Tính số ngày thuê tương ứng với số tiền
    const goiThue = cfg.goiThue || { '7': 15000, '30': 50000, '90': 120000 };
    let bestDays  = 0;
    // Tìm gói có giá ≤ amount và lớn nhất
    for (const [days, price] of Object.entries(goiThue)) {
        if (amount >= price && Number(days) > bestDays) bestDays = Number(days);
    }

    if (bestDays === 0) {
        logger(`⚠️  Giao dịch ${txnID} – ${amount}đ không khớp gói nào (nội dung: ${desc})`, '[ AUTOBANK ]');
        // Đánh dấu đã xử lý để không log lại
        data.processedTxns.push(txnID);
        if (data.processedTxns.length > 500) data.processedTxns = data.processedTxns.slice(-300);
        saveData(data);
        return;
    }

    // Kích hoạt thuê
    const rental = addRental(threadID, bestDays);
    const expStr  = moment(rental.expiry).tz('Asia/Ho_Chi_Minh').format('HH:mm DD/MM/YYYY');

    logger(`✅ AutoBank – Box ${threadID} thuê ${bestDays} ngày | Hết hạn: ${expStr}`, '[ AUTOBANK ]');

    // Thêm vào danh sách đã duyệt nếu chưa có
    try {
        const approvedFile = path.join(__dirname, '../utils/data/approvedThreads.json');
        let approved = [];
        if (fs.existsSync(approvedFile)) approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
        if (!approved.includes(threadID)) {
            approved.push(threadID);
            fs.writeFileSync(approvedFile, JSON.stringify(approved, null, 2));
        }
    } catch (_) {}

    // Gửi thông báo vào nhóm
    try {
        const msg =
            `╔══════════════════════════════╗\n` +
            `║  🤖  MTAT STUDIO – THUEBOT  ║\n` +
            `╚══════════════════════════════╝\n\n` +
            `✅ Đã nhận thanh toán!\n` +
            `💰 Số tiền: ${amount.toLocaleString('vi-VN')}đ\n` +
            `📅 Gói thuê: ${bestDays} ngày\n` +
            `⏳ Hết hạn: ${expStr}\n\n` +
            `Cảm ơn đã thuê bot! Gõ ${global.config.PREFIX}hanbot để kiểm tra hạn.`;
        await api.sendMessage(msg, threadID);
    } catch (_) {}

    // Thông báo về box admin
    try {
        if (global.config.BOXADMIN) {
            const adminMsg =
                `💳 GD AutoBank mới!\n` +
                `📦 Box: ${threadID}\n` +
                `💰 ${amount.toLocaleString('vi-VN')}đ → ${bestDays} ngày\n` +
                `🕐 ${moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss DD/MM/YYYY')}\n` +
                `📝 ND: ${desc}`;
            await api.sendMessage(adminMsg, global.config.BOXADMIN);
        }
    } catch (_) {}

    // Đánh dấu đã xử lý
    data.processedTxns.push(txnID);
    if (data.processedTxns.length > 500) data.processedTxns = data.processedTxns.slice(-300);
    saveData(data);
}

// ── Bắt đầu polling ──────────────────────────────────────
function startPolling(api) {
    const cfg      = global.config?.autobank || {};
    const interval = (cfg.pollInterval || 20) * 1000;

    if (!cfg.enable) {
        logger('AutoBank đang tắt (enable: false trong config)', '[ AUTOBANK ]');
        return;
    }
    if (!cfg.apiToken) {
        logger('⚠️  AutoBank chưa có apiToken trong config.json!', '[ AUTOBANK ]');
        return;
    }

    logger(`✅ AutoBank đã bật – kiểm tra mỗi ${cfg.pollInterval || 20}s`, '[ AUTOBANK ]');

    async function poll() {
        try {
            const txns = await fetchTransactions();
            for (const txn of txns) {
                await processTxn(txn, api);
            }
        } catch (err) {
            logger(`AutoBank poll lỗi: ${err.message}`, '[ AUTOBANK ]');
        }
    }

    // Chạy ngay lần đầu
    poll();
    pollingTimer = setInterval(poll, interval);
}

function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

// ── Kiểm tra hạn thuê định kỳ – cảnh báo sắp hết hạn ───
function startExpiryChecker(api) {
    const WARN_BEFORE_MS = 3 * 86400000; // Cảnh báo trước 3 ngày

    setInterval(async () => {
        const data = loadData();
        const now  = Date.now();
        for (const [threadID, rental] of Object.entries(data.rentals)) {
            const remaining = rental.expiry - now;
            // Hết hạn → xóa khỏi approved
            if (remaining <= 0) {
                try {
                    const approvedFile = path.join(__dirname, '../utils/data/approvedThreads.json');
                    if (fs.existsSync(approvedFile)) {
                        let approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
                        approved = approved.filter(id => id !== threadID);
                        fs.writeFileSync(approvedFile, JSON.stringify(approved, null, 2));
                    }
                    await api.sendMessage(
                        `⚠️ Hạn thuê bot của nhóm đã hết!\n` +
                        `Gõ ${global.config.PREFIX}thuebot để gia hạn tiếp tục sử dụng.`,
                        threadID
                    );
                } catch (_) {}
                removeRental(threadID);
                logger(`🕐 Box ${threadID} hết hạn thuê – đã xóa`, '[ AUTOBANK ]');
            }
            // Sắp hết hạn → cảnh báo
            else if (remaining <= WARN_BEFORE_MS && !rental.warned) {
                try {
                    const days = Math.ceil(remaining / 86400000);
                    await api.sendMessage(
                        `⏰ Nhắc nhở: Hạn thuê bot còn ${days} ngày!\n` +
                        `Gõ ${global.config.PREFIX}thuebot để gia hạn.`,
                        threadID
                    );
                    const d2 = loadData();
                    if (d2.rentals[threadID]) {
                        d2.rentals[threadID].warned = true;
                        saveData(d2);
                    }
                } catch (_) {}
            }
        }
    }, 30 * 60 * 1000); // check mỗi 30 phút
}

module.exports = {
    startPolling,
    stopPolling,
    startExpiryChecker,
    isRented,
    getRentalInfo,
    addRental,
    removeRental,
    loadData,
    getPrice
};
