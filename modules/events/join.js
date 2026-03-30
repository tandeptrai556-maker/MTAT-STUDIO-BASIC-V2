const path = require("path");
const fsExtra = require("fs-extra");

module.exports.config = {
    name: "joinNoti",
    eventType: ["log:subscribe"],
    version: "2.1.0",
    credits: "MTAT STUDIO",
    description: "Thông báo bot hoặc người vào nhóm",
    dependencies: { "fs-extra": "" }
};

module.exports.run = async function({ api, event, Users }) {
    const { join } = path; // FIX: dùng require("path") thay global.nodemodule["path"]
    const { threadID } = event;

    // Bot được thêm vào nhóm
    if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
        try {
            await api.changeNickname(
                `[ ${global.config.PREFIX} ] • ${global.config.BOTNAME || "MTAT STUDIO"}`,
                threadID,
                api.getCurrentUserID()
            );
        } catch(_) {}
        return api.sendMessage(
            `╔══════════════════════╗\n` +
            `║  🤖  MTAT STUDIO BOT  ║\n` +
            `╚══════════════════════╝\n\n` +
            `👋 Xin chào mọi người!\n` +
            `Mình là ${global.config.BOTNAME || "MTAT STUDIO"} - bot trợ lý thông minh của nhóm.\n\n` +
            `📌 Prefix lệnh: ${global.config.PREFIX}\n` +
            `📋 Gõ ${global.config.PREFIX}help để xem danh sách lệnh\n\n` +
            `✨ Chúc cả nhóm vui vẻ! 🎉`,
            threadID
        );
    }

    // Thành viên mới vào nhóm
    try {
        const { createReadStream, existsSync, mkdirSync } = fsExtra; // FIX: dùng require() thay global.nodemodule
        let { threadName, participantIDs } = await api.getThreadInfo(threadID);
        const threadData = global.data.threadData.get(threadID) || {};
        const cachePath = join(__dirname, "cache", "joinGif");
        const pathGif = join(cachePath, `${threadID}.gif`);

        var mentions = [], nameArray = [], memLength = [], i = 0;

        for (const id in event.logMessageData.addedParticipants) {
            const p = event.logMessageData.addedParticipants[id];
            const userName = p.fullName;
            const uid = p.userFbId;
            nameArray.push(userName);
            mentions.push({ tag: userName, id: uid });
            memLength.push(participantIDs.length - i++);

            if (!global.data.allUserID.includes(uid)) {
                await Users.createData(uid, { name: userName, data: {} });
                global.data.allUserID.push(uid);
            }
        }
        memLength.sort((a, b) => a - b);

        var msg;
        if (typeof threadData.customJoin == "undefined") {
            msg =
                `🎉 Chào mừng {name} đã đến với {threadName}!\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👤 {type} là thành viên thứ {soThanhVien} của nhóm\n` +
                `📋 Gõ ${global.config.PREFIX}help để xem lệnh bot nhé!\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `🤖 ${global.config.BOTNAME || "MTAT STUDIO"}`;
        } else {
            msg = threadData.customJoin;
        }

        msg = msg
            .replace(/\{name}/g, nameArray.join(", "))
            .replace(/\{type}/g, memLength.length > 1 ? "các bạn" : "bạn")
            .replace(/\{soThanhVien}/g, memLength.join(", "))
            .replace(/\{threadName}/g, threadName);

        // Tạo thư mục cache nếu chưa có
        if (!existsSync(cachePath)) mkdirSync(cachePath, { recursive: true });

        const formPush = existsSync(pathGif)
            ? { body: msg, attachment: createReadStream(pathGif), mentions }
            : { body: msg, mentions };

        return api.sendMessage(formPush, threadID);
    } catch (e) { return console.log("join.js error:", e); }
};
