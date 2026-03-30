// FIX: module.exports thay vì this.config; fix \r\n CRLF; fix HH:MM→HH:mm; fix timezone
const moment = require('moment-timezone');

module.exports.config = {
  name: 'listbox',
  version: '2.0.0',
  credits: 'MTAT STUDIO',
  hasPermssion: 3,
  description: 'Danh sách nhóm bot đang tham gia – Ban/Unban/Out',
  commandCategory: 'Admin',
  usages: '[số trang | all]',
  cooldowns: 5
};

module.exports.handleReply = async function({ api, event, Threads, handleReply }) {
  const { threadID, messageID } = event;
  if (String(event.senderID) !== String(handleReply.author)) return;
  const time = moment.tz('Asia/Ho_Chi_Minh').format('HH:mm:ss DD/MM/YYYY');
  const arg  = (event.body || '').trim().split(/\s+/);
  const cmd  = arg[0].toLowerCase();

  if (handleReply.type !== 'reply') return;

  const nums = arg.slice(1).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1);

  if (cmd === 'ban') {
    let msg = '';
    for (const num of nums) {
      const idgr = handleReply.groupid[num - 1];
      const name = handleReply.groupName[num - 1];
      if (!idgr) continue;
      const data = (await Threads.getData(idgr)).data || {};
      data.banned = true; data.dateAdded = time;
      await Threads.setData(idgr, { data });
      global.data.threadBanned.set(idgr, { dateAdded: time });
      api.sendMessage(
        `🔴 Nhóm này đã bị ban!\nLiên hệ admin để được gỡ ban.`,
        idgr
      );
      msg += `• ${name} (${idgr})\n`;
    }
    api.unsendMessage(handleReply.messageID);
    return api.sendMessage(
      `╭──── 🔨 BAN NHÓM ────⭓\n│\n${msg.split('\n').map(l => l ? `│ ${l}` : '').join('\n')}\n╰──────────────────────⭓\n✅ Đã ban ${nums.length} nhóm`,
      threadID, messageID
    );
  }

  if (cmd === 'unban') {
    let msg = '';
    for (const num of nums) {
      const idgr = handleReply.groupid[num - 1];
      const name = handleReply.groupName[num - 1];
      if (!idgr) continue;
      const data = (await Threads.getData(idgr)).data || {};
      data.banned = false; data.dateAdded = null;
      await Threads.setData(idgr, { data });
      global.data.threadBanned.delete(idgr);
      api.sendMessage('✅ Nhóm của bạn đã được gỡ ban!\nChúc sử dụng bot vui vẻ 🎉', idgr);
      msg += `• ${name} (${idgr})\n`;
    }
    api.unsendMessage(handleReply.messageID);
    return api.sendMessage(
      `╭──── ✅ UNBAN NHÓM ────⭓\n│\n${msg.split('\n').map(l => l ? `│ ${l}` : '').join('\n')}\n╰───────────────────────⭓\n✅ Đã unban ${nums.length} nhóm`,
      threadID, messageID
    );
  }

  if (cmd === 'out') {
    let msg = '';
    for (const num of nums) {
      const idgr = handleReply.groupid[num - 1];
      const name = handleReply.groupName[num - 1];
      if (!idgr) continue;
      try {
        api.sendMessage('👋 Bot đã được lệnh rời nhóm. Tạm biệt!', idgr);
        await api.removeUserFromGroup(api.getCurrentUserID(), idgr);
        msg += `• ${name} (${idgr})\n`;
      } catch(e) { msg += `• ❌ Lỗi ${name}: ${e.message}\n`; }
    }
    api.unsendMessage(handleReply.messageID);
    return api.sendMessage(
      `╭──── 🚪 OUT NHÓM ────⭓\n│\n${msg.split('\n').map(l => l ? `│ ${l}` : '').join('\n')}\n╰──────────────────────⭓`,
      threadID, messageID
    );
  }
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // Lấy danh sách nhóm
  const inbox = await api.getThreadList(100, null, ['INBOX']);
  const list = inbox
    .filter(g => g.isSubscribed && g.isGroup)
    .map(g => ({
      id: g.threadID,
      name: g.name || 'Chưa đặt tên',
      participants: g.participants?.length || 0,
      messageCount: g.messageCount || 0
    }))
    .sort((a, b) => b.participants - a.participants);

  const isAll   = args[0] === 'all';
  const page    = isAll ? 1 : (parseInt(args[0]) || 1);
  const limit   = isAll ? list.length : 30;
  const numPage = Math.ceil(list.length / limit);
  const slice   = list.slice((page - 1) * limit, (page - 1) * limit + limit);

  const groupid   = [];
  const groupName = [];

  let msg = `╭──── 📋 DANH SÁCH NHÓM ────⭓\n│ Trang ${page}/${numPage} | Tổng: ${list.length} nhóm\n├──────────────────────────────⭔\n`;
  for (let i = 0; i < slice.length; i++) {
    const g = slice[i];
    msg += `│ ${(page - 1) * limit + i + 1}. ${g.name}\n│    🆔 ${g.id} | 👥 ${g.participants} người\n│\n`;
    groupid.push(g.id);
    groupName.push(g.name);
  }
  msg += `├──────────────────────────────⭔\n│ 💡 Reply: ban/unban/out + số thứ tự\n│ 💡 Vd: ban 1 3 5 | out 2\n╰──────────────────────────────⭓`;

  return api.sendMessage(msg, threadID, (e, data) => {
    if (e) return;
    global.client.handleReply.push({
      name: module.exports.config.name,
      author: senderID,
      messageID: data.messageID,
      groupid,
      groupName,
      type: 'reply'
    });
  }, messageID);
};
