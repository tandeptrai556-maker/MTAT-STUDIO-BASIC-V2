// FIX: loại bỏ CRLF; nâng cấp UI; fix handleEvent không có commandCategory
module.exports.config = {
  name: "uid",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "MTAT STUDIO",
  description: "Lấy ID người dùng hoặc từ link Facebook",
  commandCategory: "Công cụ",
  usages: "[@tag | reply | link Facebook]",
  cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;

  if (type === 'message_reply') {
    const uid = messageReply.senderID;
    return api.sendMessage(
      `╭──── 🆔 USER ID ────⭓\n│ 👤 UID: ${uid}\n│ 🔗 fb.com/profile.php?id=${uid}\n╰───────────────────────⭓`,
      threadID, messageID
    );
  }

  if (Object.keys(mentions).length > 0) {
    let msg = `╭──── 🆔 USER ID ────⭓\n│\n`;
    for (const [uid, tag] of Object.entries(mentions)) {
      msg += `│ 👤 ${tag.replace('@', '')}: ${uid}\n│\n`;
    }
    msg += `╰───────────────────────⭓`;
    return api.sendMessage(msg, threadID, messageID);
  }

  if (!args[0]) {
    return api.sendMessage(
      `╭──── 🆔 USER ID ────⭓\n│ 👤 UID của bạn:\n│ ${senderID}\n│ 🔗 fb.com/profile.php?id=${senderID}\n╰───────────────────────⭓`,
      threadID, messageID
    );
  }

  if (args[0].includes('.com/') || args[0].includes('fb.com')) {
    try {
      const resID = await api.getUID(args[0]);
      return api.sendMessage(
        `╭──── 🆔 USER ID ────⭓\n│ 🔗 ${args[0]}\n│ 👤 UID: ${resID}\n╰───────────────────────⭓`,
        threadID, messageID
      );
    } catch(e) {
      return api.sendMessage('❌ Không thể lấy UID từ link này!\nVui lòng kiểm tra lại đường dẫn.', threadID, messageID);
    }
  }

  return api.sendMessage(
    `╭──── 🆔 USER ID ────⭓\n│ 👤 UID của bạn:\n│ ${senderID}\n╰───────────────────────⭓`,
    threadID, messageID
  );
};

module.exports.handleEvent = async function({ api, event }) {
  if (!event.body) return;
  if (event.body.toLowerCase().trim() === 'uid') {
    await module.exports.run({ api, event, args: [] });
  }
};
