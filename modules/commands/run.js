// FIX: dùng module.exports thay vì this.config / this.run
module.exports.config = {
  name: "run",
  version: "1.1.0",
  hasPermssion: 3,
  credits: "MTAT STUDIO",
  description: "Thực thi JavaScript trực tiếp",
  commandCategory: "Admin",
  usages: "[code JS]",
  cooldowns: 5
};

module.exports.run = async function({ api, event, args, Threads, Users, Currencies, models, permssion }) {
  const axios = require('axios');
  const fs = require('fs');
  const { threadID, messageID, senderID } = event;
  const { sendMessage, editMessage, shareContact } = api;

  const tpo = a =>
    typeof a === 'object' && a !== null && Object.keys(a).length !== 0
      ? JSON.stringify(a, null, 2)
      : ['number', 'boolean'].includes(typeof a)
        ? a.toString()
        : String(a ?? 'undefined');

  const send = a => api.sendMessage(tpo(a), threadID, messageID);

  if (!args.length) {
    return send(
      `╭──── ⚙️ RUN ────⭓\n` +
      `│ Thực thi JS trực tiếp\n` +\
      `│ Dùng: /run [code]\n` +
      `╰────────────────⭓`
    );
  }

  try {
    const result = await eval(`(async () => { ${args.join(' ')} })()`);
    send(result);
  } catch(e) {
    try {
      const translated = (await axios.get(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(e.message)}`,
        { timeout: 5000 }
      )).data?.[0]?.[0]?.[0] || '';
      send(`⚠️ Lỗi: ${e.message}${translated ? `\n📝 Dịch: ${translated}` : ''}`);
    } catch(_) {
      send(`⚠️ Lỗi: ${e.message}`);
    }
  }
};
