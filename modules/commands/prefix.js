// FIX: CRLF; fix hasPermission → hasPermssion (typo khác key); fix handleEvent dùng client param không có
module.exports.config = {
  name: "prefix",
  version: "2.1.0",
  hasPermssion: 0,
  credits: "MTAT STUDIO",
  description: "Xem hoặc đặt prefix riêng cho nhóm",
  commandCategory: "Hệ thống",
  usages: "[prefix mới]",
  cooldowns: 0
};

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  if (!body) return;

  const threadSetting = global.data.threadData.get(threadID) || {};
  const prefix = threadSetting.PREFIX || global.config.PREFIX;

  const trigger = body.toLowerCase().trim();
  if (['prefix', 'prefix bot là gì', 'quên prefix r', 'dùng sao', 'prefix bot'].includes(trigger)) {
    return api.sendMessage(
      `╭──── 📌 PREFIX BOT ────⭓\n│ Prefix nhóm   : ${prefix}\n│ Prefix hệ thống: ${global.config.PREFIX}\n│\n│ 💡 Dùng: ${prefix}help để xem lệnh\n╰────────────────────────⭓`,
      threadID, messageID
    );
  }
};

module.exports.run = async function({ api, event, args, Threads }) {
  const { threadID, messageID, senderID } = event;
  const threadSetting = global.data.threadData.get(threadID) || {};
  const currentPrefix = threadSetting.PREFIX || global.config.PREFIX;

  // Không có arg → hiển thị prefix hiện tại
  if (!args[0]) {
    return api.sendMessage(
      `╭──── 📌 PREFIX BOT ────⭓\n│ Prefix nhóm   : ${currentPrefix}\n│ Prefix hệ thống: ${global.config.PREFIX}\n│\n│ 💡 ${currentPrefix}prefix [mới] – đổi prefix nhóm\n╰────────────────────────⭓`,
      threadID, messageID
    );
  }

  // Đổi prefix – cần QTV
  const tInfo  = await api.getThreadInfo(threadID);
  const isAdmin = tInfo.adminIDs?.some(a => a.id == senderID) || global.config.ADMINBOT?.includes(String(senderID));
  if (!isAdmin) return api.sendMessage('❎ Chỉ quản trị viên nhóm mới có thể đổi prefix!', threadID, messageID);

  const newPrefix = args[0].trim();
  if (newPrefix.length > 5) return api.sendMessage('❎ Prefix không được quá 5 ký tự!', threadID, messageID);

  const data = (await Threads.getData(threadID)).data || {};
  data.PREFIX = newPrefix;
  await Threads.setData(threadID, { data });
  global.data.threadData.set(threadID, { ...threadSetting, PREFIX: newPrefix });

  return api.sendMessage(
    `✅ Đã đổi prefix nhóm thành: ${newPrefix}\n💡 Dùng ${newPrefix}help để xem lệnh`,
    threadID, messageID
  );
};
