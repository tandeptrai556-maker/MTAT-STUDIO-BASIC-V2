const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

module.exports.config = {
    name: "admin",
    version: "1.1.0",
    hasPermssion: 2,
    credits: "MTAT STUDIO",
    description: "Quản lý admin bot (NDH)",
    commandCategory: "Hệ thống",
    usages: "admin list | add [UID] | remove [UID]",
    cooldowns: 2,
    dependencies: {}
};

module.exports.run = async function({ api, event, args }) {
    const { threadID, messageID } = event;
    const send = (msg) => api.sendMessage(msg, threadID, messageID);

    let config;
    try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch(e) { return send("❎ Không đọc được config.json: " + e.message); }

    const admins = config.NDH || [];

    switch ((args[0] || '').toLowerCase()) {
        case "list": {
            if (!admins.length) return send("📋 Chưa có NDH nào trong danh sách.");
            const list = admins.map((id, i) => `│ ${i+1}. ${id}`).join('\n');
            return send(`╭──── 👑 DANH SÁCH NDH ────⭓\n${list}\n╰──────────────────────────⭓\nTổng: ${admins.length} người`);
        }
        case "add": {
            const uid = args[1];
            if (!uid) return send("⚠️ Vui lòng cung cấp UID người dùng!\nVD: admin add 123456789");
            if (admins.includes(uid)) return send(`⚠️ ${uid} đã là NDH rồi!`);
            admins.push(uid);
            config.NDH = admins;
            global.config.NDH = admins;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
            return send(`✅ Đã thêm ${uid} vào danh sách NDH!\n👑 Tổng NDH: ${admins.length} người`);
        }
        case "remove": {
            const uid = args[1];
            if (!uid) return send("⚠️ Vui lòng cung cấp UID người dùng!\nVD: admin remove 123456789");
            if (!admins.includes(uid)) return send(`❎ ${uid} không có trong danh sách NDH!`);
            config.NDH = admins.filter(a => a !== uid);
            global.config.NDH = config.NDH;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
            return send(`✅ Đã xóa ${uid} khỏi danh sách NDH!\n👑 Còn lại: ${config.NDH.length} người`);
        }
        default:
            return send(
                `╭──── ⚙️ LỆNH ADMIN ────⭓\n` +
                `│ admin list          – xem danh sách\n` +
                `│ admin add [UID]     – thêm NDH\n` +
                `│ admin remove [UID]  – xóa NDH\n` +
                `╰──────────────────────────⭓`
            );
    }
};
