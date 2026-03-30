module.exports.config = {
  name: "anti",
  version: "5.0.0",
  hasPermssion: 1,
  credits: "MTAT STUDIO",
  description: "Anti change Box chat – bảo vệ nhóm toàn diện",
  commandCategory: "Box chat",
  usages: "anti – dùng để bật/tắt các chế độ bảo vệ nhóm",
  cooldowns: 5,
  dependencies: { "fs-extra": "", "axios": "" }
};

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs-extra");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const DATA_DIR = path.join(__dirname, "data");
const ANTI_PATH = path.join(DATA_DIR, "anti.json");
const ANTIQTV_PATH = path.join(DATA_DIR, "antiqtv.json");
const ANTIEMOJI_PATH = path.join(DATA_DIR, "antiemoji.json");
const ANTITHEME_PATH = path.join(DATA_DIR, "antitheme.json");

// Đảm bảo thư mục & file data tồn tại
function ensureData() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(ANTI_PATH))
    writeFileSync(ANTI_PATH, JSON.stringify({ boxname: [], boximage: [], antiNickname: [], antiout: {}, antijoin: {}, antitag: {}, antilink: {} }, null, 2));
  if (!existsSync(ANTIQTV_PATH)) writeFileSync(ANTIQTV_PATH, "{}");
  if (!existsSync(ANTIEMOJI_PATH)) writeFileSync(ANTIEMOJI_PATH, "{}");
  if (!existsSync(ANTITHEME_PATH)) writeFileSync(ANTITHEME_PATH, "{}");
}
ensureData();

// Đặt global.anti để handleRefresh có thể dùng
global.anti = ANTI_PATH;

const MENU = `╭─────────────────────────⭓
│ 🛡️ Anti Bảo Vệ Nhóm
├──────────────────────⭔
│ 1. anti namebox  – cấm đổi tên nhóm
│ 2. anti avatar   – cấm đổi ảnh + kick + khôi phục
│ 3. anti nickname – cấm đổi biệt danh
│ 4. anti out      – thông báo khi thành viên rời
│ 5. anti emoji    – cấm đổi emoji nhóm
│ 6. anti theme    – cấm đổi chủ đề nhóm
│ 7. anti qtv      – cấm cướp quyền quản trị viên
│ 8. anti join     – kick thành viên mới được thêm vào
│ 9. check trạng thái anti của nhóm
│ 10. anti tag     – kick khi tag quá nhiều người
│ 11. anti link    – kick khi gửi link
╰─────────────────────────⭓
📌 Reply (phản hồi) theo số để bật/tắt chế độ`;

module.exports.run = async ({ api, event, permssion }) => {
  const { threadID, messageID, senderID } = event;
  ensureData();
  return api.sendMessage(MENU, threadID, (error, info) => {
    if (error) return api.sendMessage("❎ Đã xảy ra lỗi!", threadID);
    global.client.handleReply.push({
      name: module.exports.config.name,
      messageID: info.messageID,
      author: senderID,
      permssion
    });
  }, messageID);
};

module.exports.handleReply = async function ({ api, event, handleReply, Threads }) {
  const { senderID, threadID, messageID } = event;
  const { author, permssion } = handleReply;
  if (author !== senderID) return api.sendMessage("❎ Bạn không phải người dùng lệnh", threadID);

  ensureData();
  const dataAnti = JSON.parse(readFileSync(ANTI_PATH, "utf8"));
  const numbers = (event.body || "").split(/\s+/).filter(i => !isNaN(i) && i !== "");

  for (const num of numbers) {
    switch (num) {
      // ── 1. ANTI TÊN BOX ──────────────────────────────────────────────────
      case "1": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        const existing = dataAnti.boxname.find(i => i.threadID === threadID);
        if (existing) {
          dataAnti.boxname = dataAnti.boxname.filter(i => i.threadID !== threadID);
          api.sendMessage("☑️ Tắt anti đổi tên box", threadID, messageID);
        } else {
          const { threadName } = await api.getThreadInfo(threadID);
          dataAnti.boxname.push({ threadID, name: threadName });
          api.sendMessage(`☑️ Bật anti đổi tên box\n📝 Tên được bảo vệ: ${threadName}`, threadID, messageID);
        }
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 2. ANTI ẢNH BOX (kick + khôi phục) ──────────────────────────────
      case "2": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        const existing = dataAnti.boximage.find(i => i.threadID === threadID);
        if (existing) {
          dataAnti.boximage = dataAnti.boximage.filter(i => i.threadID !== threadID);
          api.sendMessage("☑️ Tắt anti đổi ảnh box\n🖼️ Sẽ không kick & khôi phục ảnh nữa", threadID, messageID);
        } else {
          try {
            const tInfo = await api.getThreadInfo(threadID);
            let imgUrl = tInfo.imageSrc || null;
            if (!imgUrl) {
              api.sendMessage("⚠️ Nhóm chưa có ảnh bìa để lưu!", threadID, messageID);
              break;
            }
            // Lưu URL trực tiếp (imgur nếu cần)
            if (global.api && global.api.imgur) {
              try { const r = await global.api.imgur(imgUrl); imgUrl = r.link; } catch(_) {}
            }
            dataAnti.boximage.push({ threadID, url: imgUrl });
            api.sendMessage("☑️ Bật anti đổi ảnh box\n🖼️ Sẽ kick người đổi ảnh và tự khôi phục!", threadID, messageID);
          } catch(e) {
            api.sendMessage(`❎ Lỗi khi lưu ảnh: ${e.message}`, threadID, messageID);
          }
        }
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 3. ANTI BIỆT DANH ────────────────────────────────────────────────
      case "3": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        const existing = dataAnti.antiNickname.find(i => i.threadID === threadID);
        if (existing) {
          dataAnti.antiNickname = dataAnti.antiNickname.filter(i => i.threadID !== threadID);
          api.sendMessage("☑️ Tắt anti đổi biệt danh", threadID, messageID);
        } else {
          const { nicknames } = await api.getThreadInfo(threadID);
          dataAnti.antiNickname.push({ threadID, data: nicknames });
          api.sendMessage("☑️ Bật anti đổi biệt danh", threadID, messageID);
        }
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 4. ANTI OUT ──────────────────────────────────────────────────────
      case "4": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        dataAnti.antiout[threadID] = !dataAnti.antiout[threadID];
        api.sendMessage(`☑️ ${dataAnti.antiout[threadID] ? "Bật" : "Tắt"} anti out`, threadID, messageID);
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 5. ANTI EMOJI ────────────────────────────────────────────────────
      case "5": {
        const data = JSON.parse(fs.readFileSync(ANTIEMOJI_PATH, "utf8"));
        let emoji = "";
        try { emoji = (await api.getThreadInfo(threadID)).emoji; } catch(_) {}
        if (!data[threadID]) {
          data[threadID] = { emoji, emojiEnabled: true };
        } else {
          data[threadID].emojiEnabled = !data[threadID].emojiEnabled;
          if (data[threadID].emojiEnabled) data[threadID].emoji = emoji;
        }
        fs.writeFileSync(ANTIEMOJI_PATH, JSON.stringify(data, null, 2));
        api.sendMessage(`☑️ ${data[threadID].emojiEnabled ? "Bật" : "Tắt"} anti emoji`, threadID, messageID);
        break;
      }

      // ── 6. ANTI THEME ────────────────────────────────────────────────────
      case "6": {
        const data = JSON.parse(fs.readFileSync(ANTITHEME_PATH, "utf8"));
        let theme = "";
        try { const tInfo = await Threads.getInfo(threadID); theme = tInfo.threadTheme?.id || ""; } catch(_) {}
        if (!data[threadID]) {
          data[threadID] = { themeid: theme, themeEnabled: true };
        } else {
          data[threadID].themeEnabled = !data[threadID].themeEnabled;
          if (data[threadID].themeEnabled) data[threadID].themeid = theme;
        }
        fs.writeFileSync(ANTITHEME_PATH, JSON.stringify(data, null, 2));
        api.sendMessage(`☑️ ${data[threadID].themeEnabled ? "Bật" : "Tắt"} anti theme`, threadID, messageID);
        break;
      }

      // ── 7. ANTI QTV ──────────────────────────────────────────────────────
      case "7": {
        const info = await api.getThreadInfo(threadID);
        if (!info.adminIDs.some(i => i.id == api.getCurrentUserID()))
          return api.sendMessage("❎ Bot cần quyền quản trị viên để thực thi", threadID, messageID);
        const data = JSON.parse(fs.readFileSync(ANTIQTV_PATH, "utf8"));
        data[threadID] = !data[threadID];
        api.sendMessage(`☑️ ${data[threadID] ? "Bật" : "Tắt"} anti qtv`, threadID, messageID);
        fs.writeFileSync(ANTIQTV_PATH, JSON.stringify(data, null, 2));
        break;
      }

      // ── 8. ANTI JOIN ─────────────────────────────────────────────────────
      case "8": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        dataAnti.antijoin = dataAnti.antijoin || {};
        dataAnti.antijoin[threadID] = !dataAnti.antijoin[threadID];
        api.sendMessage(`☑️ ${dataAnti.antijoin[threadID] ? "Bật" : "Tắt"} anti join\n${dataAnti.antijoin[threadID] ? "🚫 Thành viên mới sẽ bị kick tự động" : "✅ Cho phép thêm thành viên"}`, threadID, messageID);
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 9. CHECK TRẠNG THÁI ──────────────────────────────────────────────
      case "9": {
        const emojiData = JSON.parse(fs.readFileSync(ANTIEMOJI_PATH, "utf8"));
        const themeData = JSON.parse(fs.readFileSync(ANTITHEME_PATH, "utf8"));
        const qtvData = JSON.parse(fs.readFileSync(ANTIQTV_PATH, "utf8"));
        const st = (v) => v ? "🟢 bật" : "🔴 tắt";
        const msg =
          `[ 🛡️ TRẠNG THÁI ANTI ]\n` +
          `────────────────────\n` +
          `│ 1. Anti tên box : ${st(dataAnti.boxname?.some(i => i.threadID === threadID))}\n` +
          `│ 2. Anti ảnh box : ${st(dataAnti.boximage?.some(i => i.threadID === threadID))}\n` +
          `│ 3. Anti nickname: ${st(dataAnti.antiNickname?.some(i => i.threadID === threadID))}\n` +
          `│ 4. Anti out     : ${st(dataAnti.antiout?.[threadID])}\n` +
          `│ 5. Anti emoji   : ${st(emojiData?.[threadID]?.emojiEnabled)}\n` +
          `│ 6. Anti theme   : ${st(themeData?.[threadID]?.themeEnabled)}\n` +
          `│ 7. Anti qtv     : ${st(qtvData?.[threadID])}\n` +
          `│ 8. Anti join    : ${st(dataAnti.antijoin?.[threadID])}\n` +
          `│ 10. Anti tag    : ${st(dataAnti.antitag?.[threadID]?.enabled)}\n` +
          `│ 11. Anti link   : ${st(dataAnti.antilink?.[threadID])}\n` +
          `────────────────────`;
        return api.sendMessage(msg, threadID);
      }

      // ── 10. ANTI TAG ─────────────────────────────────────────────────────
      case "10": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        dataAnti.antitag = dataAnti.antitag || {};
        if (dataAnti.antitag[threadID]?.enabled) {
          dataAnti.antitag[threadID].enabled = false;
          api.sendMessage("☑️ Tắt anti tag", threadID, messageID);
        } else {
          dataAnti.antitag[threadID] = { enabled: true, maxMentions: 5 };
          api.sendMessage("☑️ Bật anti tag\n🏷️ Sẽ kick khi tag ≥ 5 người\n(Mặc định 5, có thể tùy chỉnh)", threadID, messageID);
        }
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      // ── 11. ANTI LINK ────────────────────────────────────────────────────
      case "11": {
        if (permssion < 1) return api.sendMessage("⚠️ Bạn không đủ quyền hạn", threadID, messageID);
        dataAnti.antilink = dataAnti.antilink || {};
        dataAnti.antilink[threadID] = !dataAnti.antilink[threadID];
        api.sendMessage(`☑️ ${dataAnti.antilink[threadID] ? "Bật" : "Tắt"} anti link\n${dataAnti.antilink[threadID] ? "🔗 Sẽ kick khi gửi link" : "✅ Cho phép gửi link"}`, threadID, messageID);
        writeFileSync(ANTI_PATH, JSON.stringify(dataAnti, null, 2));
        break;
      }

      default:
        api.sendMessage(`❎ Số ${num} không có trong danh sách`, threadID);
    }
  }
};
