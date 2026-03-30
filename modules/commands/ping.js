// FIX: CRLF; nâng cấp UI; fix commandCategory 'group' → tiếng Việt chuẩn
module.exports.config = {
  name: "ping",
  version: "1.1.0",
  hasPermssion: 1,
  credits: "MTAT STUDIO",
  description: "Tag toàn bộ thành viên trong nhóm",
  commandCategory: "Nhóm",
  usages: "[nội dung]",
  cooldowns: 60
};

module.exports.run = async function({ api, event, args }) {
  try {
    const botID = api.getCurrentUserID();
    const listUserID = event.participantIDs.filter(id => id != botID && id != event.senderID);
    const text = args.length ? args.join(' ') : '📣 Thông báo từ quản trị viên nhóm!';

    let body = text;
    const mentions = [];

    for (const id of listUserID) {
      body = '\u200b' + body;
      mentions.push({ id, tag: '\u200b', fromIndex: 0 });
    }

    return api.sendMessage({ body, mentions }, event.threadID, event.messageID);
  } catch(e) {
    console.log(e);
    return api.sendMessage('❌ Đã xảy ra lỗi khi tag thành viên!', event.threadID, event.messageID);
  }
};
