/**
 * Lệnh /thuebot – Thuê bot cho nhóm qua chuyển khoản ngân hàng
 * Admin thêm tay: /thuebot add [threadID] [days]
 * Admin xóa:      /thuebot remove [threadID]
 * Xem hạn:        /thuebot info [threadID]
 * Danh sách:      /thuebot list
 */

const moment  = require('moment-timezone');
const autobank = require('../../includes/autobank');

module.exports.config = {
    name: 'thuebot',
    version: '1.0.0',
    hasPermssion: 0,
    credits: 'MTAT STUDIO',
    description: 'Thuê bot cho nhóm qua chuyển khoản ngân hàng tự động',
    commandCategory: 'Hệ thống',
    usages: '/thuebot [7|30|90] | /thuebot add/remove/list/info',
    cooldowns: 5,
    usePrefix: true
};

function fmtMoney(n) {
    return Number(n).toLocaleString('vi-VN') + 'đ';
}

function fmtTime(ms) {
    return moment(ms).tz('Asia/Ho_Chi_Minh').format('HH:mm DD/MM/YYYY');
}

function fmtRemaining(ms) {
    const diff = ms - Date.now();
    if (diff <= 0) return '❌ Đã hết hạn';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return `${d} ngày ${h} giờ`;
}

module.exports.run = async function ({ api, event, args, permssion }) {
    const { threadID, senderID, messageID } = event;
    const cfg       = global.config?.autobank || {};
    const goiThue   = cfg.goiThue || { '7': 15000, '30': 50000, '90': 120000 };
    const prefix    = cfg.contentPrefix || 'THUEBOT';
    const bankName  = cfg.bankName   || '(chưa cấu hình)';
    const bankNum   = cfg.bankNumber || '(chưa cấu hình)';
    const bankOwner = cfg.bankOwner  || '(chưa cấu hình)';
    const P         = global.config.PREFIX;

    // ─── ADMIN: add / remove / list / info ─────────────────
    if (args[0] && ['add', 'remove', 'list', 'info'].includes(args[0].toLowerCase())) {
        if (permssion < 2) return api.sendMessage('❌ Chỉ admin bot mới dùng được lệnh này.', threadID, messageID);

        switch (args[0].toLowerCase()) {

            case 'add': {
                const tid  = args[1] || threadID;
                const days = parseInt(args[2]);
                if (!days || days < 1) return api.sendMessage('❌ Dùng: /thuebot add [threadID] [số ngày]', threadID, messageID);
                const rental = autobank.addRental(tid, days, senderID);
                // Thêm vào approved
                try {
                    const fs   = require('fs-extra');
                    const path = require('path');
                    const f    = path.join(__dirname, '../../utils/data/approvedThreads.json');
                    let ap     = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
                    if (!ap.includes(tid)) { ap.push(tid); fs.writeFileSync(f, JSON.stringify(ap, null, 2)); }
                } catch (_) {}
                return api.sendMessage(
                    `✅ Đã thêm ${days} ngày cho box ${tid}\n⏳ Hết hạn: ${fmtTime(rental.expiry)}`,
                    threadID, messageID
                );
            }

            case 'remove': {
                const tid = args[1] || threadID;
                autobank.removeRental(tid);
                return api.sendMessage(`✅ Đã xóa thuê của box ${tid}`, threadID, messageID);
            }

            case 'list': {
                const data = autobank.loadData();
                const list = Object.entries(data.rentals);
                if (list.length === 0) return api.sendMessage('📋 Chưa có nhóm nào thuê bot.', threadID, messageID);
                const rows = list.map(([tid, r], i) => {
                    const exp = r.expiry > Date.now() ? fmtRemaining(r.expiry) : '❌ Hết hạn';
                    return `${i + 1}. Box: ${tid}\n   ⏳ Còn: ${exp}`;
                }).join('\n─────────────────\n');
                return api.sendMessage(`📋 DANH SÁCH THUÊ BOT (${list.length} nhóm):\n─────────────────\n${rows}`, threadID, messageID);
            }

            case 'info': {
                const tid    = args[1] || threadID;
                const rental = autobank.getRentalInfo(tid);
                if (!rental) return api.sendMessage(`📭 Box ${tid} chưa thuê bot.`, threadID, messageID);
                return api.sendMessage(
                    `📋 THÔNG TIN THUÊ – Box ${tid}\n` +
                    `⏳ Còn lại: ${fmtRemaining(rental.expiry)}\n` +
                    `📅 Hết hạn: ${fmtTime(rental.expiry)}\n` +
                    `🔄 Lần gia hạn: ${rental.renewCount || 1}\n` +
                    `📆 Lần cuối nạp: ${rental.lastRenew || 'N/A'}`,
                    threadID, messageID
                );
            }
        }
        return;
    }

    // ─── USER: xem giá / chọn gói ──────────────────────────
    const days  = parseInt(args[0]);
    const isValidPkg = days && goiThue[String(days)] != null;

    // Hiển thị bảng giá nếu không có arg hoặc arg không hợp lệ
    if (!isValidPkg) {
        const rental    = autobank.getRentalInfo(threadID);
        const statusStr = rental && rental.expiry > Date.now()
            ? `✅ Nhóm đang thuê | Còn: ${fmtRemaining(rental.expiry)}`
            : '❌ Nhóm chưa thuê bot';

        const pkgList = Object.entries(goiThue)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([d, p]) => `  📦 ${d} ngày  →  ${fmtMoney(p)}`)
            .join('\n');

        return api.sendMessage(
            `╔══════════════════════════════╗\n` +
            `║  🤖  MTAT STUDIO – THUEBOT  ║\n` +
            `╚══════════════════════════════╝\n\n` +
            `${statusStr}\n\n` +
            `📊 BẢNG GIÁ THUÊ BOT:\n${pkgList}\n\n` +
            `📌 Để thuê, gõ: ${P}thuebot [số ngày]\n` +
            `   Ví dụ: ${P}thuebot 30`,
            threadID, messageID
        );
    }

    // ─── Hiển thị thông tin thanh toán cho gói đã chọn ────
    const price  = goiThue[String(days)];
    const content = `${prefix} ${threadID}`;
    const rental  = autobank.getRentalInfo(threadID);
    const curStatus = rental && rental.expiry > Date.now()
        ? `⏳ Hạn hiện tại còn: ${fmtRemaining(rental.expiry)}\n(Nếu gia hạn sẽ cộng thêm ${days} ngày)`
        : '(Nhóm chưa có hạn)';

    return api.sendMessage(
        `╔══════════════════════════════╗\n` +
        `║  🤖  MTAT STUDIO – THUEBOT  ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `📦 Gói: ${days} ngày  |  💰 ${fmtMoney(price)}\n` +
        `${curStatus}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 THÔNG TIN CHUYỂN KHOẢN:\n` +
        `   Ngân hàng : ${bankName}\n` +
        `   Số TK     : ${bankNum}\n` +
        `   Chủ TK    : ${bankOwner}\n` +
        `   Số tiền   : ${fmtMoney(price)}\n` +
        `   Nội dung  : ${content}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ QUAN TRỌNG: Ghi ĐÚNG nội dung\n` +
        `"${content}"\n` +
        `để bot tự động kích hoạt!\n\n` +
        `✅ Bot sẽ tự xác nhận trong ~${global.config?.autobank?.pollInterval || 20}s sau khi nhận tiền.`,
        threadID, messageID
    );
};
