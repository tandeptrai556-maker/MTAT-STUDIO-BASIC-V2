// FIX: dùng module.exports thay vì this.config / this.run (invalid pattern ngoài class)
module.exports.config = {
  name: "autodown",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "MTAT STUDIO",
  description: "Tự động tải video/ảnh từ Facebook, TikTok, YouTube, Instagram...",
  commandCategory: "Tiện ích",
  usages: "[link]",
  cooldowns: 5,
  prefix: true
};

const axios = require('axios');
const BASE_URL = 'http://dongdev.click/api/down/media';

const stream = (url, ext = 'jpg') =>
  axios.get(url, { responseType: 'stream', timeout: 15000 })
    .then(res => (res.data.path = `tmp.${ext}`, res.data))
    .catch(() => null);

const platformName = (url) => {
  if (/facebook|fb\.com/.test(url))  return 'FACEBOOK';
  if (/tiktok/.test(url))            return 'TIKTOK';
  if (/twitter|x\.com/.test(url))    return 'TWITTER';
  if (/youtube|youtu\.be/.test(url)) return 'YOUTUBE';
  if (/instagram/.test(url))         return 'INSTAGRAM';
  if (/bilibili/.test(url))          return 'BILIBILI';
  if (/douyin/.test(url))            return 'DOUYIN';
  if (/capcut/.test(url))            return 'CAPCUT';
  if (/threads/.test(url))           return 'THREADS';
  return 'MEDIA';
};

const head = app =>
  `╭──── 📥 AUTO DOWN – ${app} ────⭓`;

module.exports.handleEvent = async function({ api, event }) {
  if (event.senderID == api.getCurrentUserID()) return;
  const body = event.body || '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = body.match(urlRegex) || [];
  if (!urls.length) return;

  const supportedRegex = /(facebook|fb\.com|tiktok\.com|t\.co|twitter\.com|youtube\.com|youtu\.be|instagram\.com|bilibili\.com|douyin\.com|capcut\.com|threads\.net)/i;

  for (const url of urls) {
    if (!supportedRegex.test(url)) continue;
    try {
      const res = (await axios.get(`${BASE_URL}?url=${encodeURIComponent(url)}`, { timeout: 20000 })).data;
      if (!res?.attachments?.length) continue;

      const platform = platformName(url);
      let attachments = [];

      if (res.queryStorieID) {
        const match = res.attachments.find(i => i.id == res.queryStorieID);
        if (match?.type === 'Video')  attachments.push(await stream(match.url.hd || match.url.sd, 'mp4'));
        else if (match?.type === 'Photo') attachments.push(await stream(match.url, 'jpg'));
      } else {
        for (const at of res.attachments) {
          if (at.type === 'Video')  attachments.push(await stream(at.url.hd || at.url.sd || at.url, 'mp4'));
          else if (at.type === 'Photo') attachments.push(await stream(at.url, 'jpg'));
          else if (at.type === 'Audio') attachments.push(await stream(at.url, 'mp3'));
        }
      }
      attachments = attachments.filter(Boolean);
      if (!attachments.length) continue;

      const info = [
        head(platform),
        res.message ? `│ 📝 ${res.message.slice(0, 100)}${res.message.length > 100 ? '...' : ''}` : null,
        res.author  ? `│ 👤 Tác giả: ${res.author}` : null,
        res.like    ? `│ ❤️  Like: ${res.like}` : null,
        `╰─────────────────────────────⭓`
      ].filter(Boolean).join('\n');

      api.sendMessage({ body: info, attachment: attachments }, event.threadID, event.messageID);
    } catch (_) {}
  }
};

module.exports.run = async function({ api, event }) {
  return api.sendMessage(
    `╭──── 📥 AUTO DOWN ────⭓\n` +
    `│ Tính năng tự động!\n` +
    `│ Chỉ cần gửi link vào nhóm:\n` +
    `│ • Facebook, TikTok, YouTube\n` +
    `│ • Instagram, Twitter, Bilibili\n` +
    `│ • Douyin, CapCut, Threads\n` +
    `╰───────────────────────⭓`,
    event.threadID, event.messageID
  );
};
