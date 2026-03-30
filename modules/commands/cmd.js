// FIX: global.utils.throwError → fallback vì utils có thể chưa sẵn; nâng cấp UI thông báo
module.exports.config = {
  name: "cmd",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "MTAT STUDIO",
  description: "Quản lý module – load/unload/reload lệnh",
  commandCategory: "Admin",
  usages: "[load | unload | loadAll | unloadAll | info] [tên module]",
  cooldowns: 5,
  prefix: false
};

const { writeFileSync } = require('fs-extra');
const logger = require('../../utils/log');

function loadModules({ moduleList, threadID, messageID }) {
  const { api } = global.client;
  const configValue = (() => {
    delete require.cache[require.resolve(process.cwd() + '/config.json')];
    return require(process.cwd() + '/config.json');
  })();
  const errors = [];

  for (const name of moduleList) {
    if (!name) { errors.push(`• Tên module rỗng`); continue; }
    try {
      const dir = __dirname + '/' + name + '.js';
      delete require.cache[require.resolve(dir)];
      const cmd = require(dir);
      global.client.commands.delete(name);

      if (!cmd.config || !cmd.run || !cmd.config.commandCategory)
        throw new Error('Module không đúng định dạng!');

      global.client.eventRegistered = global.client.eventRegistered.filter(n => n !== cmd.config.name);

      if (cmd.config.envConfig) {
        for (const [k, v] of Object.entries(cmd.config.envConfig)) {
          if (!global.configModule[cmd.config.name]) global.configModule[cmd.config.name] = {};
          if (!configValue[cmd.config.name]) configValue[cmd.config.name] = {};
          global.configModule[cmd.config.name][k] = configValue[cmd.config.name][k] || v || '';
          configValue[cmd.config.name][k] = global.configModule[cmd.config.name][k];
        }
      }

      if (cmd.onLoad) cmd.onLoad({ configValue });
      if (cmd.handleEvent) global.client.eventRegistered.push(cmd.config.name);

      // Bỏ khỏi disabled list nếu có
      ['commandDisabled'].forEach(key => {
        const entry = name + '.js';
        if (configValue[key]?.includes(entry)) configValue[key].splice(configValue[key].indexOf(entry), 1);
        if (global.config[key]?.includes(entry)) global.config[key].splice(global.config[key].indexOf(entry), 1);
      });

      global.client.commands.set(cmd.config.name, cmd);
      logger.loader(`Loaded: ${cmd.config.name}`);
    } catch(e) {
      errors.push(`• ${name}: ${e.message}`);
    }
  }

  writeFileSync(process.cwd() + '/config.json', JSON.stringify(configValue, null, 4), 'utf8');

  const ok = moduleList.length - errors.length;
  let msg = `╭──── ⚙️ LOAD MODULE ────⭓\n│ ✅ Thành công: ${ok}/${moduleList.length}\n`;
  if (errors.length) msg += `│ ❌ Lỗi:\n${errors.map(e => `│   ${e}`).join('\n')}\n`;
  msg += `╰──────────────────────────⭓`;
  api.sendMessage(msg, threadID, messageID);
}

function unloadModules({ moduleList, threadID, messageID }) {
  const { api } = global.client;
  const configValue = (() => {
    delete require.cache[require.resolve(process.cwd() + '/config.json')];
    return require(process.cwd() + '/config.json');
  })();

  for (const name of moduleList) {
    global.client.commands.delete(name);
    global.client.eventRegistered = global.client.eventRegistered.filter(n => n !== name);
    if (!configValue.commandDisabled.includes(name + '.js')) configValue.commandDisabled.push(name + '.js');
    if (!global.config.commandDisabled.includes(name + '.js')) global.config.commandDisabled.push(name + '.js');
    logger.loader(`Unloaded: ${name}`);
  }

  writeFileSync(process.cwd() + '/config.json', JSON.stringify(configValue, null, 4), 'utf8');
  api.sendMessage(
    `╭──── ⚙️ UNLOAD MODULE ────⭓\n│ ✅ Đã unload ${moduleList.length} module\n╰──────────────────────────────⭓`,
    threadID, messageID
  );
}

module.exports.run = function({ event, args, api }) {
  const { readdirSync } = require('fs-extra');
  const { threadID, messageID } = event;
  const sub = (args[0] || '').toLowerCase();
  const list = args.slice(1).map(m => m.trim()).filter(Boolean);

  switch (sub) {
    case 'load':
      if (!list.length) return api.sendMessage('❎ Vui lòng cung cấp tên module!', threadID, messageID);
      return loadModules({ moduleList: list, threadID, messageID });

    case 'unload':
      if (!list.length) return api.sendMessage('❎ Vui lòng cung cấp tên module!', threadID, messageID);
      return unloadModules({ moduleList: list, threadID, messageID });

    case 'loadall': {
      const all = readdirSync(__dirname).filter(f => f.endsWith('.js') && !f.includes('example')).map(f => f.replace('.js', ''));
      return loadModules({ moduleList: all, threadID, messageID });
    }
    case 'unloadall': {
      const all = readdirSync(__dirname).filter(f => f.endsWith('.js') && !f.includes('example') && !f.includes('cmd')).map(f => f.replace('.js', ''));
      return unloadModules({ moduleList: all, threadID, messageID });
    }
    case 'info': {
      const name = list.join('') || '';
      const cmd  = global.client.commands.get(name);
      if (!cmd) return api.sendMessage(`❎ Không tìm thấy module: ${name}`, threadID, messageID);
      const { config } = cmd;
      const permText = config.hasPermssion === 0 ? '👤 Thành viên' : config.hasPermssion === 1 ? '🛡️ QTV' : config.hasPermssion === 2 ? '⚙️ Admin' : '👑 NDH';
      return api.sendMessage(
        `╭──── 📖 ${config.name.toUpperCase()} ────⭓\n` +
        `│ 👤 Tác giả: ${config.credits}\n` +
        `│ 🔖 Phiên bản: ${config.version}\n` +
        `│ 🔐 Quyền: ${permText}\n` +
        `│ ⏳ Cooldown: ${config.cooldowns}s\n` +
        `│ 📦 Nhóm: ${config.commandCategory}\n` +
        `│ 📌 Deps: ${Object.keys(config.dependencies || {}).join(', ') || 'Không có'}\n` +
        `╰──────────────────────────────⭓`,
        threadID, messageID
      );
    }
    default:
      return api.sendMessage(
        `╭──── ⚙️ CMD ────⭓\n` +
        `│ load [tên]    – tải module\n` +
        `│ unload [tên]  – gỡ module\n` +
        `│ loadAll       – tải tất cả\n` +
        `│ unloadAll     – gỡ tất cả\n` +
        `│ info [tên]    – thông tin\n` +
        `╰────────────────────⭓`,
        threadID, messageID
      );
  }
};
