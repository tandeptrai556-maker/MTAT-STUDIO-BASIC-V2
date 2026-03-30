// FIX: xóa \r\n CRLF; fix money - mon (string - number bug); nâng cấp UI
module.exports.config = {
  name: "money",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "MTAT STUDIO",
  description: "Kiểm tra và quản lý tiền của thành viên",
  commandCategory: "Người dùng",
  usages: "[@tag | reply] [+ - * / ++ -- +- +% -%] [số]",
  cooldowns: 3,
  usePrefix: false
};

module.exports.run = async function({ Currencies, api, event, args, Users, permssion }) {
  const axios = require('axios');
  const moment = require('moment-timezone');
  const { threadID, messageID, senderID, mentions, type, messageReply } = event;

  let targetID = senderID;
  if (type === 'message_reply') targetID = messageReply.senderID;
  else if (Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];

  const name  = (await Users.getNameUser(targetID)) || targetID;
  const time  = moment.tz('Asia/Ho_Chi_Minh').format('HH:mm:ss - DD/MM/YYYY');
  const money = (await Currencies.getData(targetID)).money || 0;
  const mon   = parseInt(args[1]); // FIX: parseInt để tránh string arithmetic

  const i = (url) => axios.get(url, { responseType: 'stream', timeout: 10000 }).then(r => r.data).catch(() => null);
  const gif = 'https://files.catbox.moe/shxujt.gif';

  const send = async (body) => {
    const att = await i(gif);
    return api.sendMessage(att ? { body, attachment: att } : body, threadID, messageID);
  };

  const noPermMsg = `❌ Bạn không đủ quyền để dùng lệnh này!`;

  if (!args[0]) {
    const display = money === Infinity ? '∞ (Vô hạn)' : (money ?? 0).toLocaleString('vi-VN') + '$';
    return send(`╭──── 💰 SỐ DƯ ────⭓\n│ 👤 ${name}\n│ 💵 ${display}\n│ ⏰ ${time}\n╰───────────────────⭓`);
  }

  switch (args[0]) {
    case '+': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      if (isNaN(mon))    return api.sendMessage('❎ Số tiền không hợp lệ!', threadID, messageID);
      await Currencies.increaseMoney(targetID, mon);
      return send(`╭──── 💰 CỘNG TIỀN ────⭓\n│ 👤 ${name}\n│ ➕ +${mon.toLocaleString()}$\n│ 💵 Còn: ${(money + mon).toLocaleString()}$\n│ ⏰ ${time}\n╰───────────────────────⭓`);
    }
    case '-': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      if (isNaN(mon))    return api.sendMessage('❎ Số tiền không hợp lệ!', threadID, messageID);
      await Currencies.increaseMoney(targetID, -mon);
      return send(`╭──── 💰 TRỪ TIỀN ────⭓\n│ 👤 ${name}\n│ ➖ -${mon.toLocaleString()}$\n│ 💵 Còn: ${(money - mon).toLocaleString()}$\n│ ⏰ ${time}\n╰───────────────────────⭓`);
    }
    case '*': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      if (isNaN(mon))    return api.sendMessage('❎ Số không hợp lệ!', threadID, messageID);
      await Currencies.increaseMoney(targetID, money * (mon - 1));
      return send(`💸 Nhân tiền ${name} lên ${mon} lần\n💵 Còn: ${(money * mon).toLocaleString()}$\n⏰ ${time}`);
    }
    case '/': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      if (isNaN(mon) || mon === 0) return api.sendMessage('❎ Số chia không hợp lệ!', threadID, messageID);
      const newVal = Math.floor(money / mon);
      await Currencies.increaseMoney(targetID, -money + newVal);
      return send(`💸 Chia tiền ${name} đi ${mon} lần\n💵 Còn: ${newVal.toLocaleString()}$\n⏰ ${time}`);
    }
    case '++': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      await Currencies.increaseMoney(targetID, Infinity);
      return send(`💸 ${name} có vô hạn tiền!\n⏰ ${time}`);
    }
    case '--': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      await Currencies.decreaseMoney(targetID, money);
      return send(`💸 Reset tiền ${name} về 0$\n⏰ ${time}`);
    }
    case '+-': {
      if (permssion < 2) return api.sendMessage(noPermMsg, threadID, messageID);
      if (isNaN(mon))    return api.sendMessage('❎ Số tiền không hợp lệ!', threadID, messageID);
      await Currencies.decreaseMoney(targetID, money);
      await Currencies.increaseMoney(targetID, mon);
      return send(`💸 Set tiền ${name} = ${mon.toLocaleString()}$\n⏰ ${time}`);
    }
    case 'pay': {
      const myMoney = (await Currencies.getData(senderID)).money || 0;
      const bet     = args[1] === 'all' ? myMoney : mon;
      if (isNaN(bet) || bet < 1) return api.sendMessage('❎ Số tiền chuyển không hợp lệ hoặc không đủ tiền!', threadID, messageID);
      if (myMoney < bet)         return api.sendMessage(`❎ Bạn chỉ có ${myMoney.toLocaleString()}$, không đủ để chuyển ${bet.toLocaleString()}$!`, threadID, messageID);
      await Currencies.increaseMoney(senderID, -bet);
      await Currencies.increaseMoney(targetID, bet);
      return api.sendMessage(`✅ Đã chuyển ${bet.toLocaleString()}$ cho ${name}`, threadID, messageID);
    }
    default:
      return api.sendMessage(
        `╭──── 💰 MONEY ────⭓\n│ + [số]   – cộng tiền\n│ - [số]   – trừ tiền\n│ * [lần]  – nhân tiền\n│ / [lần]  – chia tiền\n│ ++       – vô hạn\n│ --       – reset 0\n│ +- [số]  – set cứng\n│ pay [số] – chuyển tiền\n╰──────────────────────⭓`,
        threadID, messageID
      );
  }
};
