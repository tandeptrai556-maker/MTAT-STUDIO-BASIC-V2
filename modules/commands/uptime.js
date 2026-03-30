const os = require('os');
const moment = require('moment-timezone');

module.exports.config = {
    name: "uptime",
    version: "2.0.0",
    hasPermssion: 0,
    credits: "MTAT STUDIO",
    description: "Xem thời gian bot hoạt động và thông tin hệ thống",
    commandCategory: "Hệ thống",
    usages: "",
    cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
    try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
        const toGB = (b) => (b / 1024 / 1024 / 1024).toFixed(2);

        const platform = { linux: "🐧 Linux", win32: "🪟 Windows", darwin: "🍎 macOS" }[os.platform()] || os.platform();
        const cpuModel = os.cpus()[0]?.model?.trim() || "Không xác định";
        const loadAvg = os.loadavg()[0].toFixed(2);
        const now = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
        const bar = "█".repeat(Math.round(memPercent / 10)) + "░".repeat(10 - Math.round(memPercent / 10));

        const msg =
            `╔══════════════════════╗\n` +
            `║  🤖  MTAT STUDIO BOT  ║\n` +
            `╚══════════════════════╝\n\n` +
            `⏱️ Thời gian hoạt động:\n` +
            `   ${String(hours).padStart(2,"0")} giờ ${String(minutes).padStart(2,"0")} phút ${String(seconds).padStart(2,"0")} giây\n\n` +
            `💻 Hệ thống:\n` +
            `   • HĐH: ${platform}\n` +
            `   • CPU: ${cpuModel}\n` +
            `   • Tải CPU: ${loadAvg}%\n\n` +
            `🧠 RAM:\n` +
            `   • Đã dùng: ${toGB(usedMem)} GB / ${toGB(totalMem)} GB\n` +
            `   • Còn trống: ${toGB(freeMem)} GB\n` +
            `   [${bar}] ${memPercent}%\n\n` +
            `🕐 Thời gian hiện tại:\n` +
            `   ${now}`;

        return api.sendMessage(msg, event.threadID, event.messageID);
    } catch (e) {
        console.log(e);
        return api.sendMessage("❌ Đã xảy ra lỗi khi lấy thông tin hệ thống!", event.threadID, event.messageID);
    }
};
