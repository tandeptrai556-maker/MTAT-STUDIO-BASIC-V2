// FIX: dùng module.exports thay vì this.config / this.run
module.exports.config = {
  name: "rs",
  version: "1.1.0",
  hasPermssion: 3,
  credits: "MTAT STUDIO",
  description: "Khởi động lại bot",
  commandCategory: "Admin",
  usages: "",
  cooldowns: 0,
  images: []
};

module.exports.run = async function({ event, api }) {
  const moment = require('moment-timezone');
  const time = moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss DD/MM/YYYY');
  return api.sendMessage(
    `🔄 Bot đang khởi động lại...\n⏰ ${time}`,
    event.threadID,
    () => process.exit(1),
    event.messageID
  );
};
