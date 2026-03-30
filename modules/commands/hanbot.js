/**
 * Lệnh /hanbot – Kiểm tra hạn thuê bot của nhóm hiện tại
 */

const moment   = require('moment-timezone');
const autobank = require('../../includes/autobank');

module.exports.config = {
    name: 'hanbot',
    version: '1.0.0',
    hasPermssion: 0,
    credits: 'MTAT STUDIO',
    description: 'Kiểm tra hạn thuê bot của nhóm',
    commandCategory: 'Hệ thống',
    usages: '/hanbot',
    cooldowns: 5,
    usePrefix: true
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;
    const rental  = autobank.getRentalInfo(threadID);
    const P       = global.config.PREFIX;
    const now     = Date.now();

    if (!rental || rental.expiry <= now) {
        return api.sendMessage(
            `❌ Nhóm này chưa thuê bot hoặc đã hết hạn.\n` +
            `Gõ ${P}thuebot để xem bảng giá và gia hạn!`,
            threadID, messageID
        );
    }

    const diff   = rental.expiry - now;
    const days   = Math.floor(diff / 86400000);
    const hours  = Math.floor((diff % 86400000) / 3600000);
    const expStr = moment(rental.expiry).tz('Asia/Ho_Chi_Minh').format('HH:mm - DD/MM/YYYY');
    const lastR  = rental.lastRenew || 'N/A';

    // Icon trạng thái theo số ngày còn lại
    const icon = days > 7 ? '✅' : days > 3 ? '⚠️' : '🔴';

    return api.sendMessage(
        `╔══════════════════════════════╗\n` +
        `║  🤖  MTAT STUDIO – THUEBOT  ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `${icon} Trạng thái: Đang hoạt động\n\n` +
        `⏳ Còn lại  : ${days} ngày ${hours} giờ\n` +
        `📅 Hết hạn  : ${expStr}\n` +
        `🔄 Số lần nạp: ${rental.renewCount || 1} lần\n` +
        `🕐 Lần cuối : ${lastR}\n\n` +
        (days <= 3 ? `⚠️ SẮP HẾT HẠN! Hãy gia hạn sớm.\nGõ ${P}thuebot để gia hạn.` : `Gõ ${P}thuebot để gia hạn thêm.`),
        threadID, messageID
    );
};
