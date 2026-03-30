// FIX: this.config → module.exports; fix handleReaction không await; cải tiến UI
module.exports.config = {
  name: "qtv",
  version: "1.1.0",
  hasPermssion: 1,
  credits: "MTAT STUDIO",
  description: "Thêm hoặc gỡ quyền quản trị viên",
  commandCategory: "Nhóm",
  usages: "[add | remove] [@tag | reply]",
  cooldowns: 5
};

module.exports.run = async function({ event, api, args, Users, Threads }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;

  if (!args[0]) return api.sendMessage(
    `╭──── 🛡️ LỆNH QTV ────⭓\n` +
    `│ qtv add    – thêm quản trị viên\n` +
    `│ qtv remove – gỡ quản trị viên\n` +
    `│ 💡 Dùng kèm @tag hoặc reply tin nhắn\n` +
    `╰──────────────────────⭓`,
    threadID, messageID
  );

  const dataThread = (await Threads.getData(threadID)).threadInfo;
  const botID      = api.getCurrentUserID();
  const botIsAdmin = dataThread.adminIDs?.some(i => i.id == botID);

  if (!botIsAdmin) return api.sendMessage('❎ Bot cần quyền quản trị viên để thực hiện lệnh này!', threadID, messageID);

  const sub = args[0].toLowerCase();
  if (!['add', 'remove'].includes(sub)) return api.sendMessage('❎ Dùng: qtv add hoặc qtv remove', threadID, messageID);

  let uid;
  if (type === 'message_reply') {
    uid = messageReply.senderID;
  } else if (Object.keys(mentions).length > 0) {
    uid = Object.keys(mentions)[0];
  } else {
    uid = senderID;
  }

  const name = (await Users.getData(uid))?.name || uid;

  return api.sendMessage(
    `📌 Xác nhận ${sub === 'add' ? 'thêm' : 'gỡ'} QTV: ${name}\nThả cảm xúc để xác nhận`,
    threadID,
    (err, info) => {
      if (err) return;
      global.client.handleReaction.push({
        name: module.exports.config.name,
        type: sub,
        messageID: info.messageID,
        author: senderID,
        userID: uid,
        userName: name
      });
    },
    messageID
  );
};

module.exports.handleReaction = async function({ event, api, handleReaction, Users }) {
  if (String(event.userID) !== String(handleReaction.author)) return;

  const { threadID, messageID } = event;
  const { type, userID, userName } = handleReaction;
  const isAdd = (type === 'add');

  try {
    await new Promise((resolve, reject) => {
      api.changeAdminStatus(threadID, userID, isAdd, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    api.sendMessage(
      isAdd
        ? `✅ Đã thêm ${userName} làm quản trị viên nhóm 🛡️`
        : `✅ Đã gỡ quyền quản trị viên của ${userName}`,
      threadID, messageID
    );
  } catch(e) {
    api.sendMessage(
      `❎ Không thể ${isAdd ? 'thêm' : 'gỡ'} QTV: ${e.message}`,
      threadID, messageID
    );
  }
};
