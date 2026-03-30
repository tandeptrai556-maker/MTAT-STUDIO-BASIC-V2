// FIX: Xóa circular require handleRefresh (không dùng đến, gây vòng lặp)
module.exports.config = {
    name: "leaveNoti",
    eventType: ["log:unsubscribe"],
    version: "2.0.0",
    credits: "MTAT STUDIO",
    description: "Thông báo khi người dùng rời khỏi nhóm",
    dependencies: {
        "fs-extra": "",
        "path": ""
    }
};

module.exports.onLoad = function () {
    const { existsSync, mkdirSync } = require("fs-extra");
    const { join } = require("path");
    const path = join(__dirname, "cache", "leaveGif");
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
    const path2 = join(__dirname, "cache", "leaveGif", "randomgif");
    if (!existsSync(path2)) mkdirSync(path2, { recursive: true });
};

module.exports.run = async function ({ api, event, Users, Threads }) {
    try {
        const { threadID } = event;
        const iduser = event.logMessageData.leftParticipantFbId;
        if (iduser == api.getCurrentUserID()) return;

        const moment = require("moment-timezone");
        const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm - DD/MM/YYYY");
        const threadDataCache = global.data.threadData.get(String(threadID));
        const data = threadDataCache || (await Threads.getData(threadID)).data;
        const userData = await Users.getData(event.author);
        const nameAuthor = userData.name || "Quản trị viên";
        const name = global.data.userName.get(iduser) || await Users.getNameUser(iduser);

        const isKicked = event.author !== iduser;
        const typeMsg = isKicked
            ? `đã bị ${nameAuthor} mời ra khỏi nhóm 👢`
            : `đã tự rời khỏi nhóm 🚪`;

        var msg;
        if (data.customLeave) {
            msg = data.customLeave
                .replace(/\{name}/g, name)
                .replace(/\{type}/g, typeMsg)
                .replace(/\{iduser}/g, iduser)
                .replace(/\{author}/g, nameAuthor)
                .replace(/\{time}/g, time);
        } else {
            msg =
                `━━━━━━━━━━━━━━━━━━\n` +
                `${isKicked ? "👢" : "👋"} ${name} ${typeMsg}\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `🔗 FB: https://www.facebook.com/profile.php?id=${iduser}\n` +
                `🕐 Lúc: ${time}\n` +
                `🤖 ${global.config.BOTNAME || "MTAT STUDIO"}`;
        }

        return new Promise((resolve, reject) => {
            api.sendMessage(msg, threadID, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (e) {
        console.log(e);
    }
};
