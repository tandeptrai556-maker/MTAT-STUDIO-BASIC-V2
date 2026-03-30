// FIX: this.config → module.exports; fix handleReply type "remove" bug (splice muddies index)
const fs   = require('fs');
const path = require('path');

module.exports.config = {
  name: "duyet",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "MTAT STUDIO",
  description: "Duyệt / quản lý nhóm được dùng bot",
  commandCategory: "Admin",
  usages: "[list | pending | del [ID] | help | ID]",
  cooldowns: 5,
  prefix: true
};

const dataPath        = path.resolve(__dirname, '../../utils/data/approvedThreads.json');
const dataPendingPath = path.resolve(__dirname, '../../utils/data/pendingThreads.json');

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(_) { return []; } }
function saveJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }

module.exports.handleReply = async function({ event, api, handleReply, Threads }) {
  if (handleReply.author !== event.senderID) return;
  const { body, threadID, messageID } = event;
  let approved = readJSON(dataPath);
  let pending  = readJSON(dataPendingPath);

  // ── Duyệt từ danh sách chờ ──
  if (handleReply.type === 'pending') {
    if (body.trim().toLowerCase() === 'all') {
      approved = [...new Set([...approved, ...pending])];
      saveJSON(dataPath, approved);
      saveJSON(dataPendingPath, []);
      pending.forEach(id => api.sendMessage('✅ Nhóm đã được phê duyệt!\n🎉 Chúc mọi người dùng bot vui vẻ!', id));
      return api.sendMessage(`✅ Đã duyệt toàn bộ ${pending.length} nhóm chờ`, threadID, messageID);
    }
    const nums    = body.split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1);
    let success   = 0;
    // xử lý từ cuối để splice không lệch index
    const sorted  = [...nums].sort((a,b) => b - a);
    for (const num of sorted) {
      const idx = num - 1;
      if (idx < 0 || idx >= pending.length) continue;
      const idBox = pending[idx];
      if (!approved.includes(idBox)) approved.push(idBox);
      pending.splice(idx, 1);
      api.sendMessage('✅ Nhóm đã được phê duyệt!\n🎉 Chúc mọi người dùng bot vui vẻ!', idBox);
      success++;
    }
    saveJSON(dataPath, approved);
    saveJSON(dataPendingPath, pending);
    return api.sendMessage(
      success > 0 ? `✅ Đã duyệt ${success} nhóm` : '❎ Không có nhóm nào được duyệt',
      threadID, messageID
    );
  }

  // ── Xóa nhóm khỏi danh sách đã duyệt ──
  if (handleReply.type === 'remove') {
    const nums   = body.split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1);
    const sorted = [...nums].sort((a,b) => b - a);
    let removed  = 0;
    for (const num of sorted) {
      const idx = num - 1;
      if (idx < 0 || idx >= approved.length) continue;
      const idBox = approved[idx];
      approved.splice(idx, 1);
      try { await api.removeUserFromGroup(api.getCurrentUserID(), idBox); } catch(_) {}
      removed++;
    }
    saveJSON(dataPath, approved);
    return api.sendMessage(
      removed > 0 ? `✅ Đã xóa ${removed} nhóm khỏi danh sách` : '❎ Không có nhóm nào bị xóa',
      threadID, messageID
    );
  }
};

module.exports.run = async function({ event, api, args, Threads }) {
  const { threadID, messageID, senderID } = event;
  let approved = readJSON(dataPath);
  let pending  = readJSON(dataPendingPath);

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'list' || sub === 'l') {
    if (!approved.length) return api.sendMessage('📋 Chưa có nhóm nào được duyệt.', threadID, messageID);
    let msg = `╭──── ✅ NHÓM ĐÃ DUYỆT ────⭓\n│\n`;
    for (const [i, id] of approved.entries()) {
      let name = 'Không rõ';
      try { name = (await Threads.getData(id))?.threadInfo?.threadName || id; } catch(_) {}
      msg += `│ ${i + 1}. ${name}\n│    🆔 ${id}\n│\n`;
    }
    msg += `├──────────────────────────⭔\n│ 💡 Reply số để xóa nhóm khỏi danh sách\n╰──────────────────────────⭓`;
    return api.sendMessage(msg, threadID, (err, info) => {
      if (!err) global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        type: 'remove'
      });
    }, messageID);
  }

  if (sub === 'pending' || sub === 'p') {
    if (!pending.length) return api.sendMessage('📋 Không có nhóm nào đang chờ duyệt.', threadID, messageID);
    let msg = `╭──── ⏳ NHÓM CHỜ DUYỆT ────⭓\n│\n`;
    for (const [i, id] of pending.entries()) {
      let name = 'Không rõ';
      try { name = (await Threads.getData(id))?.threadInfo?.threadName || id; } catch(_) {}
      msg += `│ ${i + 1}. ${name}\n│    🆔 ${id}\n│\n`;
    }
    msg += `├──────────────────────────⭔\n│ 💡 Reply số để duyệt | Reply "all" để duyệt hết\n╰──────────────────────────⭓`;
    return api.sendMessage(msg, threadID, (err, info) => {
      if (!err) global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        type: 'pending'
      });
    }, messageID);
  }

  if (sub === 'del' || sub === 'd') {
    const idBox = args[1] || threadID;
    if (!approved.includes(idBox)) return api.sendMessage('❎ Nhóm chưa được duyệt trước đó', threadID, messageID);
    approved = approved.filter(id => id !== idBox);
    saveJSON(dataPath, approved);
    try { await api.removeUserFromGroup(api.getCurrentUserID(), idBox); } catch(_) {}
    return api.sendMessage(`✅ Đã gỡ nhóm ${idBox} khỏi danh sách`, threadID, messageID);
  }

  if (sub === 'help' || sub === 'h') {
    const P = (global.data.threadData.get(String(threadID)) || {}).PREFIX || global.config.PREFIX;
    return api.sendMessage(
      `╭──── 📖 DUYỆT BOX ────⭓\n` +
      `│ ${P}duyet list        – nhóm đã duyệt\n` +
      `│ ${P}duyet pending     – nhóm chờ duyệt\n` +
      `│ ${P}duyet del [ID]    – xóa nhóm\n` +
      `│ ${P}duyet [ID]        – duyệt nhóm\n` +
      `╰──────────────────────⭓`,
      threadID, messageID
    );
  }

  // Duyệt theo ID trực tiếp
  const idBox = args[0] || threadID;
  if (isNaN(parseInt(idBox))) return api.sendMessage('❎ ID không hợp lệ', threadID, messageID);
  if (approved.includes(idBox)) return api.sendMessage(`❎ Nhóm ${idBox} đã được duyệt trước đó`, threadID, messageID);
  approved.push(idBox);
  pending = pending.filter(id => id !== idBox);
  saveJSON(dataPath, approved);
  saveJSON(dataPendingPath, pending);
  api.sendMessage('✅ Nhóm đã được phê duyệt!\n🎉 Chúc mọi người dùng bot vui vẻ!', idBox);
  return api.sendMessage(`✅ Đã duyệt nhóm ${idBox}`, threadID, messageID);
};
