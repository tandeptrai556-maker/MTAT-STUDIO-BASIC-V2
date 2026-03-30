// FIX: dùng module.exports thay vì this.config / this.run
module.exports.config = {
  name: "contact",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "MTAT STUDIO",
  description: "Chia sẻ thông tin liên hệ của thành viên trong nhóm",
  commandCategory: "Công cụ",
  usages: "[@tag | reply | UID]",
  cooldowns: 5,
  prefix: false
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, messageReply, senderID, mentions, type } = event;

  let id = senderID;
  if (type === "message_reply") {
    id = messageReply.senderID;
  } else if (Object.keys(mentions).length > 0) {
    id = Object.keys(mentions)[0].replace(/&mibextid=\w+/g, '');
  } else if (args[0]) {
    id = isNaN(args[0]) ? senderID : args[0];
  }

  try {
    api.shareContact("📋 Thông tin liên hệ", id, threadID, messageID);
  } catch(e) {
    api.sendMessage("❌ Không thể chia sẻ liên hệ: " + e.message, threadID, messageID);
  }
};
