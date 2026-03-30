module.exports = function ({ api, models, Users, Threads, Currencies }) {
   const stringSimilarity = require('string-similarity');
   const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
   const logger = require("../../utils/log.js");
   const moment = require("moment-timezone");
   const path = require("path");
   const fs = require("fs");

   return async function ({ event }) {
    const dateNow = Date.now();
    const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
    const { allowInbox, PREFIX, ADMINBOT, NDH, DeveloperMode } = global.config;
    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands, cooldowns } = global.client;
    var { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);
    const threadSetting = threadData.get(threadID) || {};
    const currentPrefix = threadSetting.hasOwnProperty("PREFIX") ? threadSetting.PREFIX : PREFIX;
    const botID = String(api.getCurrentUserID());

    // ── ANTI TAG / ANTI LINK enforcement ──────────────────────────────────────
    const antiDataPath = path.join(__dirname, '../../modules/commands/data/anti.json');
    if (fs.existsSync(antiDataPath) && body && event.isGroup) {
      try {
        const antiData = JSON.parse(fs.readFileSync(antiDataPath, 'utf8'));
        // Anti Link: kick nếu gửi link (bỏ qua admin)
        if (antiData.antilink && antiData.antilink[threadID] === true) {
          const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|fb\.com[^\s]*|bit\.ly[^\s]*|t\.me[^\s]*|youtu\.be[^\s]*)/i;
          if (linkRegex.test(body) && !ADMINBOT.includes(senderID) && !NDH.includes(senderID)) {
            try {
              const tInfo = await api.getThreadInfo(threadID);
              const isAdmin = tInfo.adminIDs.some(a => a.id == senderID);
              if (!isAdmin) {
                await api.removeUserFromGroup(senderID, threadID);
                return api.sendMessage(`🔗 Anti Link đã kick thành viên vì gửi link!\n👤 UID: ${senderID}`, threadID);
              }
            } catch(_) {}
          }
        }
        // Anti Tag: kick nếu tag quá nhiều người
        if (antiData.antitag && antiData.antitag[threadID]) {
          const cfg = antiData.antitag[threadID];
          const maxMentions = cfg.maxMentions || 5;
          if (cfg.enabled !== false && event.mentions && Object.keys(event.mentions).length >= maxMentions) {
            if (!ADMINBOT.includes(senderID) && !NDH.includes(senderID)) {
              try {
                const tInfo = await api.getThreadInfo(threadID);
                const isAdmin = tInfo.adminIDs.some(a => a.id == senderID);
                if (!isAdmin) {
                  await api.removeUserFromGroup(senderID, threadID);
                  return api.sendMessage(`🏷️ Anti Tag đã kick vì tag quá nhiều người! (${Object.keys(event.mentions).length} tag)\n👤 UID: ${senderID}`, threadID);
                }
              } catch(_) {}
            }
          }
        }
      } catch (_) {}
    }
    // ──────────────────────────────────────────────────────────────────────────

    const prefixRegex = new RegExp(`^(${escapeRegex(currentPrefix)})\\s*`);

    // ── @ MENTION support ─────────────────────────────────────────────────────
    let bodyToProcess = body;
    let isMentionTrigger = false;
    if (event.mentions && event.mentions[botID] && body) {
      const mentionTag = event.mentions[botID]; // vd: "@MTAT STUDIO"
      bodyToProcess = body.replace(mentionTag, '').replace(/<@!?\d+>/g, '').trim();
      if (bodyToProcess.length > 0) isMentionTrigger = true;
    }
    // ──────────────────────────────────────────────────────────────────────────

    if (userBanned.has(senderID) || threadBanned.has(threadID) || (allowInbox == false && senderID == threadID)) {
      if (!ADMINBOT.includes(senderID.toString())) {
        if (userBanned.has(senderID)) {
          const { reason, dateAdded } = userBanned.get(senderID) || {};
          return api.sendMessage(global.getText("handleCommand", "userBanned", reason, dateAdded), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        } else if (threadBanned.has(threadID)) {
          const { reason, dateAdded } = threadBanned.get(threadID) || {};
          return api.sendMessage(global.getText("handleCommand", "threadBanned", reason, dateAdded), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        }
      }
    }

    bodyToProcess = bodyToProcess !== undefined ? bodyToProcess : 'x';
    body = body !== undefined ? body : 'x';

    let args, commandName, command;

    if (isMentionTrigger) {
      // Lệnh từ @ mention – không cần prefix
      args = bodyToProcess.trim().split(/ +/);
      commandName = args.shift().toLowerCase();
      command = commands.get(commandName);
    } else {
      const [matchedPrefix] = body.match(prefixRegex) || [''];
      args = body.slice(matchedPrefix.length).trim().split(/ +/);
      commandName = args.shift().toLowerCase();
      command = commands.get(commandName);
      if (!prefixRegex.test(body)) {
        args = (body || '').trim().split(/ +/);
        commandName = args.shift()?.toLowerCase();
        command = commands.get(commandName);
        if (command && command.config) {
          if (command.config.prefix === false && commandName.toLowerCase() !== command.config.name.toLowerCase()) return;
          if (command.config.prefix === true && !body.startsWith(PREFIX)) return;
          if (typeof command.config.prefix === 'undefined') return;
        }
      }
    }

    if (!command) {
      if (!isMentionTrigger && !body.startsWith(currentPrefix)) return;
      var allCommandName = [];
      const commandValues = commands['keys']();
      for (const cmd of commandValues) allCommandName.push(cmd);
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) command = global.client.commands.get(checker.bestMatch.target);
      else return api.sendMessage(`❎ Lệnh không tồn tại, lệnh gần giống là: ${checker.bestMatch.target}`, threadID, messageID);
    }

    if (commandBanned.get(threadID) || commandBanned.get(senderID)) {
      if (!ADMINBOT.includes(senderID)) {
        const banThreads = commandBanned.get(threadID) || [], banUsers = commandBanned.get(senderID) || [];
        if (banThreads.includes(command.config.name))
          return api.sendMessage(global.getText("handleCommand", "commandThreadBanned", command.config.name), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        if (banUsers.includes(command.config.name))
          return api.sendMessage(global.getText("handleCommand", "commandUserBanned", command.config.name), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return api.unsendMessage(info.messageID);
          }, messageID);
      }
    }

    if (command.config.commandCategory.toLowerCase() == 'nsfw' && !global.data.threadAllowNSFW.includes(threadID) && !ADMINBOT.includes(senderID))
      return api.sendMessage(global.getText("handleCommand", "threadNotAllowNSFW"), threadID, async (err, info) => {
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));
        return api.unsendMessage(info.messageID);
      }, messageID);

    var threadInfo2;
    if (event.isGroup == true)
      try {
        threadInfo2 = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
        if (Object.keys(threadInfo2).length == 0) throw new Error();
      } catch (err) {
        logger(global.getText("handleCommand", "cantGetInfoThread", "error"));
      }

    var permssion = 0;
    const threadInfoo = (await Threads.getData(threadID)).threadInfo;
    const find = threadInfoo.adminIDs.find(el => el.id == senderID);
    if (ADMINBOT.includes(senderID.toString())) permssion = 2;
    else if (NDH.includes(senderID.toString())) permssion = 3;
    else if (find) permssion = 1;

    const rolePermissions = { 1: "Quản Trị Viên", 2: "ADMIN BOT", 3: "Người Hỗ Trợ" };
    const requiredPermission = rolePermissions[command.config.hasPermssion] || "";
    if (command.config.hasPermssion > permssion) {
      return api.sendMessage(`📌 Lệnh ${command.config.name} có quyền hạn là ${requiredPermission}`, threadID, async (err, info) => {
        await new Promise(resolve => setTimeout(resolve, 15 * 1000));
        return api.unsendMessage(info.messageID);
      }, messageID);
    }

    if (!global.client.cooldowns.has(command.config.name)) client.cooldowns.set(command.config.name, new Map());
    const timestamps = global.client.cooldowns.get(command.config.name);
    const expirationTime = (command.config.cooldowns || 1) * 1000;
    if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime)
      return api.setMessageReaction('😼', event.messageID, err => (err) ? logger('Đã có lỗi xảy ra khi thực thi setMessageReaction', 2) : '', true);

    var getText2;
    if (command.languages && typeof command.languages == 'object' && command.languages.hasOwnProperty(global.config.language))
      getText2 = (...values) => {
        var lang = command.languages[global.config.language][values[0]] || '';
        for (var i = values.length; i > 1; i--) {
          const expReg = RegExp('%' + i, 'g');
          lang = lang.replace(expReg, values[i]);
        }
        return lang;
      };
    else getText2 = () => {};

    try {
      const Obj = { api, event, args, models, Users, Threads, Currencies, permssion, getText: getText2 };
      command.run(Obj);
      timestamps.set(senderID, dateNow);
      if (DeveloperMode == true)
        logger(global.getText("handleCommand", "executeCommand", time, commandName, senderID, threadID, args.join(" "), (Date.now()) - dateNow), "[ DEV MODE ]");
      return;
    } catch (e) {
      console.log(e);
      return api.sendMessage(global.getText("handleCommand", "commandError", commandName, e), threadID);
    }
  };
};
