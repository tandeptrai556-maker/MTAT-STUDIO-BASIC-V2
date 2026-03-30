const leaveNoti = require('../../modules/events/leaveNoti.js');

module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    const path = require("path");
    const fs = require("fs");
    const axios = require("axios");

    const ANTI_PATH = path.join(__dirname, '../../modules/commands/data/anti.json');
    function readAnti() {
        try {
            if (fs.existsSync(ANTI_PATH)) return JSON.parse(fs.readFileSync(ANTI_PATH, 'utf8'));
        } catch(_) {}
        return { boxname: [], boximage: [], antiNickname: [], antiout: {}, antijoin: {}, antitag: {}, antilink: {} };
    }

    return async function ({ event }) {
        const { threadID, logMessageType, logMessageData, author } = event;
        const { setData, getData, delData } = Threads;

        try {
            let threadData = await getData(threadID);
            if (!threadData) {
                logger('Dữ liệu nhóm không tồn tại: ' + threadID, '[ERROR]');
                return;
            }

            let dataThread = threadData.threadInfo || {};
            dataThread.adminIDs = dataThread.adminIDs || [];
            dataThread.participantIDs = dataThread.participantIDs || [];

            switch (logMessageType) {
                case "log:thread-admins": {
                    if (logMessageData.ADMIN_EVENT == "add_admin") {
                        dataThread.adminIDs.push({ id: logMessageData.TARGET_ID });
                        api.sendMessage(`✅ Update ${dataThread.adminIDs.length} QTV`, threadID);
                    } else if (logMessageData.ADMIN_EVENT == "remove_admin") {
                        dataThread.adminIDs = dataThread.adminIDs.filter(item => item.id != logMessageData.TARGET_ID);
                        api.sendMessage(`✅ Update ${dataThread.adminIDs.length} QTV`, threadID);
                    }
                    logger('Làm mới list admin tại nhóm ' + threadID, '[UPDATE DATA]');
                    await setData(threadID, { threadInfo: dataThread });
                    break;
                }

                case "log:thread-name": {
                    logger('Cập nhật tên tại nhóm ' + threadID, '[UPDATE DATA]');
                    const antiData = readAnti();
                    const antiName = antiData.boxname && antiData.boxname.find(i => i.threadID === threadID);
                    if (antiName) {
                        // ── ANTI NAME: khôi phục tên cũ ──
                        try {
                            await api.setTitle(antiName.name, threadID);
                            api.sendMessage(`⚠️ Anti Name: Đã khôi phục tên nhóm!\n📝 Tên cũ: ${antiName.name}\n👤 Người đổi UID: ${author}`, threadID);
                        } catch(e) {
                            api.sendMessage(`⚠️ Anti Name phát hiện đổi tên nhưng không thể khôi phục: ${e.message}`, threadID);
                        }
                    } else {
                        dataThread.threadName = logMessageData.name;
                        await setData(threadID, { threadInfo: dataThread });
                        api.sendMessage(`📝 Tên nhóm đã được đổi thành: ${logMessageData.name}`, threadID);
                    }
                    break;
                }

                case "log:thread-image": {
                    // ── ANTI ẢNH BOX: kick + khôi phục ──
                    const antiData = readAnti();
                    const antiImg = antiData.boximage && antiData.boximage.find(i => i.threadID === threadID);
                    if (antiImg && antiImg.url) {
                        // Kick người đổi ảnh
                        try {
                            const tInfo = await api.getThreadInfo(threadID);
                            const isAdmin = tInfo.adminIDs.some(a => a.id == author);
                            if (!isAdmin && author != api.getCurrentUserID()) {
                                await api.removeUserFromGroup(author, threadID);
                                api.sendMessage(`🖼️ Anti Avatar Box: Đã kick thành viên vì đổi ảnh nhóm!\n👤 UID: ${author}`, threadID);
                            }
                        } catch(e) {
                            logger('Anti image - không thể kick: ' + e.message, '[ANTI]');
                        }
                        // Khôi phục ảnh cũ
                        try {
                            const imgRes = await axios.get(antiImg.url, { responseType: 'stream', timeout: 15000 });
                            await api.changeGroupImage(imgRes.data, threadID);
                            api.sendMessage(`🔄 Anti Avatar Box: Đã khôi phục ảnh nhóm!`, threadID);
                        } catch(e) {
                            api.sendMessage(`⚠️ Anti Avatar Box: Không thể khôi phục ảnh - ${e.message}`, threadID);
                        }
                    }
                    break;
                }

                case 'log:unsubscribe': {
                    const userFbId = logMessageData.leftParticipantFbId;
                    if (userFbId == api.getCurrentUserID()) {
                        logger('Thực hiện xóa data của nhóm ' + threadID, '[DELETE DATA THREAD]');
                        const index = global.data.allThreadID?.findIndex(item => item == threadID);
                        if (index > -1) global.data.allThreadID.splice(index, 1);
                        await delData(threadID);
                        return;
                    } else {
                        // ── ANTI OUT: thêm lại nếu anti out bật ──
                        const antiData = readAnti();
                        if (antiData.antiout && antiData.antiout[threadID] === true) {
                            try {
                                const userInfo = await api.getUserInfo([userFbId]);
                                const uName = userInfo[userFbId]?.name || userFbId;
                                api.sendMessage(`🚪 Anti Out: ${uName} đã rời nhóm!`, threadID);
                            } catch(_) {}
                        }
                        (await leaveNoti.run({ api, event, Users, Threads }));
                        const participantIndex = dataThread.participantIDs.findIndex(item => item == userFbId);
                        if (participantIndex > -1) dataThread.participantIDs.splice(participantIndex, 1);
                        const adminIndex = dataThread.adminIDs.findIndex(item => item.id == userFbId);
                        if (adminIndex > -1) dataThread.adminIDs.splice(adminIndex, 1);
                        logger('Thực hiện xóa user ' + userFbId, '[DELETE DATA USER]');
                        await setData(threadID, { threadInfo: dataThread });
                    }
                    break;
                }

                case 'log:subscribe': {
                    // ── ANTI JOIN: kick thành viên mới nếu bật ──
                    const antiData = readAnti();
                    if (antiData.antijoin && antiData.antijoin[threadID] === true) {
                        if (logMessageData.addedParticipants) {
                            for (const p of logMessageData.addedParticipants) {
                                const uid = p.userFbId;
                                if (uid == api.getCurrentUserID()) continue;
                                try {
                                    await api.removeUserFromGroup(uid, threadID);
                                    api.sendMessage(`🚫 Anti Join: Đã kick thành viên mới!\n👤 ${p.fullName} (${uid})`, threadID);
                                } catch(_) {}
                            }
                        }
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('Đã xảy ra lỗi update data: ' + e);
        }
        return;
    };
};
