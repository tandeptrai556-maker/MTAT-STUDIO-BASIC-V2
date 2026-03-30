const axios = require('axios');
const moment = require('moment-timezone');

// FIX: dùng module.exports thay vì this.config / this.run (invalid pattern)
module.exports.config = {
    name: "help",
    version: "2.0.0",
    hasPermssion: 0,
    credits: "MTAT STUDIO",
    description: "Xem danh sách lệnh và thông tin chi tiết",
    commandCategory: "Hệ thống",
    usages: "[tên lệnh | all]",
    cooldowns: 5,
    images: []
};

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const cmds = global.client.commands;
    const TIDdata = global.data.threadData.get(threadID) || {};
    const prefix = TIDdata.PREFIX || global.config.PREFIX;
    const NameBot = global.config.BOTNAME || "MTAT STUDIO";
    const adminCount = global.config.ADMINBOT?.length || 0;
    const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm || DD/MM/YYYY");

    var type = args[0] ? args[0].toLowerCase() : "";

    // ── /help all ──────────────────────────────────────────────────────────
    if (type === "all") {
        let msg = `╭──── 📋 TẤT CẢ LỆNH ────⭓\n│\n`, i = 0;
        for (const cmd of cmds.values()) {
            msg += `│ ${++i}. ${cmd.config.name}\n│    ↳ ${cmd.config.description}\n│\n`;
        }
        msg += `╰──────────────────────────⭓\n📝 Tổng: ${cmds.size} lệnh`;
        return api.sendMessage(msg, threadID, messageID);
    }

    // ── /help [tên lệnh] ───────────────────────────────────────────────────
    if (type) {
        const cmd = cmds.get(type);
        if (!cmd) {
            const stringSimilarity = require('string-similarity');
            const allNames = Array.from(cmds.keys());
            const { bestMatch } = stringSimilarity.findBestMatch(type, allNames);
            return api.sendMessage(
                `❎ Không tìm thấy lệnh '${type}'\n💡 Lệnh gần giống: ${bestMatch.target}`,
                threadID, messageID
            );
        }
        const c = cmd.config;
        const permText = c.hasPermssion === 0 ? "👤 Thành Viên"
            : c.hasPermssion === 1 ? "🛡️ Quản Trị Viên"
            : c.hasPermssion === 2 ? "⚙️ Admin Bot"
            : "👑 Toàn Quyền";
        const msg =
            `╭──── 📖 CHI TIẾT LỆNH ────⭓\n` +
            `│ 📌 Tên : ${c.name}\n` +
            `│ 👤 Tác giả : ${c.credits}\n` +
            `│ 🔖 Phiên bản : ${c.version}\n` +
            `│ 🔐 Quyền : ${permText}\n` +
            `│ 📝 Mô tả : ${c.description}\n` +
            `│ 📂 Nhóm : ${c.commandCategory}\n` +
            `│ 📎 Cách dùng : ${prefix}${c.name} ${c.usages}\n` +
            `│ ⏳ Cooldown : ${c.cooldowns}s\n` +
            `╰──────────────────────────⭓`;
        return api.sendMessage(msg, threadID, messageID);
    }

    // ── /help (menu theo nhóm lệnh) ────────────────────────────────────────
    const groups = {};
    for (const cmd of cmds.values()) {
        const cat = cmd.config.commandCategory || "Khác";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(cmd.config.name);
    }
    const cats = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    let msg = `╭──── 🤖 ${NameBot.toUpperCase()} ────⭓\n│\n`;
    let idx = 0;
    for (const [cat, names] of cats) {
        msg += `│ ${++idx}. 📂 ${cat} (${names.length} lệnh)\n│    ${names.join(" • ")}\n│\n`;
    }
    msg +=
        `├──────────────────────────⭔\n` +
        `│ 📝 Tổng: ${cmds.size} lệnh  |  ⏰ ${time}\n` +
        `│ 👑 Admin Bot: ${adminCount} người\n` +
        `│ 📌 Prefix: ${prefix}\n` +
        `├──────────────────────────⭔\n` +
        `│ 💡 ${prefix}help [tên lệnh] – xem chi tiết\n` +
        `│ 💡 ${prefix}help all – xem tất cả\n` +
        `│ 💡 @Bot [lệnh] – dùng không cần prefix\n` +
        `╰──────────────────────────⭓`;
    return api.sendMessage(msg, threadID, messageID);
};

module.exports.handleEvent = async function() {};
