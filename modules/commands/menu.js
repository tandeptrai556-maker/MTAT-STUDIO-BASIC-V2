module.exports.config = {
    name: 'menu',
    version: '2.0.0',
    hasPermssion: 0,
    credits: 'MTAT STUDIO',
    description: 'Xem danh sách nhóm lệnh & thông tin lệnh',
    commandCategory: 'Hệ thống',
    usages: '[tên lệnh | all]',
    cooldowns: 5,
    envConfig: {
        autoUnsend: { status: true, timeOut: 60 }
    }
};

const { findBestMatch } = require('string-similarity');
const moment = require('moment-timezone');
const axios = require('axios');

function getPrefix(tid) {
    const data = global.data.threadData.get(tid) || {};
    return data.PREFIX || global.config.PREFIX;
}

function permText(p) {
    return p === 0 ? "👤 Thành Viên"
        : p === 1 ? "🛡️ Quản Trị Viên"
        : p === 2 ? "⚙️ Admin Bot"
        : "👑 Toàn Quyền";
}

function buildGroups() {
    const groups = [];
    for (const cmd of global.client.commands.values()) {
        const { name, commandCategory } = cmd.config;
        const found = groups.find(g => g.cat === commandCategory);
        if (!found) groups.push({ cat: commandCategory, names: [name] });
        else found.names.push(name);
    }
    return groups.sort((a, b) => b.names.length - a.names.length);
}

function infoCmd(c, prefix) {
    return (
        `╭──── 📖 CHI TIẾT LỆNH ────⭓\n` +
        `│ 📌 Tên : ${c.name}\n` +
        `│ 👤 Tác giả : ${c.credits}\n` +
        `│ 🔖 Phiên bản : ${c.version}\n` +
        `│ 🔐 Quyền : ${permText(c.hasPermssion)}\n` +
        `│ 📝 Mô tả : ${c.description}\n` +
        `│ 📂 Nhóm : ${c.commandCategory}\n` +
        `│ 📎 Cách dùng : ${prefix}${c.name} ${c.usages}\n` +
        `│ ⏳ Cooldown : ${c.cooldowns}s\n` +
        `╰──────────────────────────⭓`
    );
}

module.exports.run = async function ({ api, event, args }) {
    const { threadID: tid, messageID: mid, senderID: sid } = event;
    const cmds = global.client.commands;
    const prefix = getPrefix(tid);
    const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm || DD/MM/YYYY");
    const NameBot = global.config.BOTNAME || "MTAT STUDIO";
    const autoUnsend = global.config?.menu?.autoUnsend || module.exports.config.envConfig.autoUnsend;

    // Lấy avatar bot
    let img = null;
    try {
        const url = 'https://files.catbox.moe/amblv9.gif';
        img = (await axios.get(url, { responseType: "stream", timeout: 8000 })).data;
    } catch(_) {}

    // ── menu [tên lệnh] ──────────────────────────────────────────────
    if (args.length >= 1 && args[0] !== 'all') {
        const cmdName = args.join(' ').toLowerCase();
        const cmd = cmds.get(cmdName);
        if (cmd) return api.sendMessage(infoCmd(cmd.config, prefix), tid, mid);
        // gợi ý lệnh gần giống
        const allNames = Array.from(cmds.keys());
        const { bestMatch } = findBestMatch(cmdName, allNames);
        return api.sendMessage(`❎ Không tìm thấy lệnh '${cmdName}'\n💡 Lệnh gần giống: ${bestMatch.target}`, tid, mid);
    }

    // ── menu all ─────────────────────────────────────────────────────
    if (args[0] === 'all') {
        let txt = `╭──── 📋 TẤT CẢ LỆNH ────⭓\n│\n`, i = 0;
        for (const cmd of cmds.values())
            txt += `│ ${++i}. ${cmd.config.name}\n│    ↳ ${cmd.config.description}\n│\n`;
        txt += `╰────────────────────────⭓\n📝 Tổng: ${cmds.size} lệnh`;
        const form = img ? { body: txt, attachment: img } : txt;
        return api.sendMessage(form, tid, (err, info) => {
            if (!err && autoUnsend.status)
                setTimeout(() => api.unsendMessage(info.messageID), 1000 * autoUnsend.timeOut);
        });
    }

    // ── menu (trang chủ theo nhóm) ────────────────────────────────────
    const groups = buildGroups();
    let txt = `╭──── 🤖 ${NameBot.toUpperCase()} ────⭓\n│\n`;
    let idx = 0;
    const icons = ["📁","📂","🗂️","📋","📌","🔧","⚙️","🎮","🎵","🌐","💬","🎨","🛡️","💡","📊"];
    for (const g of groups) {
        const icon = icons[idx % icons.length];
        txt += `│ ${++idx}. ${icon} ${g.cat} (${g.names.length} lệnh)\n│\n`;
    }
    txt +=
        `├──────────────────────────⭔\n` +
        `│ 📝 Tổng: ${cmds.size} lệnh\n` +
        `│ ⏰ ${time}\n` +
        `│ 📌 Prefix: ${prefix}\n` +
        `├──────────────────────────⭔\n` +
        `│ 💡 Reply số để xem lệnh nhóm đó\n` +
        `│ 💡 ${prefix}help [lệnh] – chi tiết lệnh\n` +
        `│ 💡 @Bot [lệnh] – dùng không cần prefix\n` +
        `╰──────────────────────────⭓`;

    const form = img ? { body: txt, attachment: img } : txt;
    return api.sendMessage(form, tid, (err, info) => {
        if (err) return;
        global.client.handleReply.push({
            name: module.exports.config.name,
            messageID: info.messageID,
            author: sid,
            case: 'infoGr',
            data: groups
        });
        if (autoUnsend.status)
            setTimeout(() => api.unsendMessage(info.messageID), 1000 * autoUnsend.timeOut);
    }, mid);
};

module.exports.handleReply = async function ({ handleReply: $, api, event }) {
    const { threadID: tid, messageID: mid, senderID: sid, body } = event;
    const autoUnsend = global.config?.menu?.autoUnsend || module.exports.config.envConfig.autoUnsend;
    const prefix = getPrefix(tid);

    if (sid != $.author) return api.sendMessage("⛔ Bạn không phải người dùng lệnh này!", tid, mid);

    let img = null;
    try {
        img = (await axios.get('https://files.catbox.moe/amblv9.gif', { responseType: "stream", timeout: 8000 })).data;
    } catch(_) {}

    const num = parseInt((body || '').trim());

    switch ($.case) {
        // ── Chọn nhóm lệnh ──────────────────────────────────────────────
        case 'infoGr': {
            const group = $.data[num - 1];
            if (!group) return api.sendMessage(`❎ "${body}" không nằm trong menu\n💡 Chọn từ 1 đến ${$.data.length}`, tid, mid);
            api.unsendMessage($.messageID);

            let txt = `╭──── 📂 ${group.cat.toUpperCase()} ────⭓\n│\n`, i = 0;
            for (const name of group.names) {
                const c = global.client.commands.get(name)?.config;
                if (c) txt += `│ ${++i}. ${c.name}\n│    ↳ ${c.description}\n│\n`;
            }
            txt +=
                `├──────────────────────────⭔\n` +
                `│ 💡 Reply số để xem chi tiết lệnh\n` +
                `│ 💡 ${prefix}help [lệnh] – chi tiết\n` +
                `╰──────────────────────────⭓`;

            const form = img ? { body: txt, attachment: img } : txt;
            return api.sendMessage(form, tid, (err, info) => {
                if (err) return;
                global.client.handleReply.push({
                    name: module.exports.config.name,
                    messageID: info.messageID,
                    author: sid,
                    case: 'infoCmds',
                    data: group.names
                });
                if (autoUnsend.status)
                    setTimeout(() => api.unsendMessage(info.messageID), 1000 * autoUnsend.timeOut);
            });
        }

        // ── Xem chi tiết lệnh ───────────────────────────────────────────
        case 'infoCmds': {
            const name = $.data[num - 1];
            const cmd = global.client.commands.get(name);
            if (!cmd) return api.sendMessage(`❎ "${body}" không nằm trong menu\n💡 Chọn từ 1 đến ${$.data.length}`, tid, mid);
            api.unsendMessage($.messageID);
            return api.sendMessage(infoCmd(cmd.config, prefix), tid, mid);
        }

        default: break;
    }
};
