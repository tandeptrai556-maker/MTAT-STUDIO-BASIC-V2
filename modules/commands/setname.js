module.exports.config = {
	name: "setname",
	version: "2.0.0",
	hasPermssion: 0,
	credits: "TrúcCute mod by Niio-team (Cthinh)",
	description: "Đổi biệt danh trong nhóm của bạn hoặc của người bạn tag",
	commandCategory: "Nhóm",
	usages: "trống/tag/check/all/del/call + name",
	cooldowns: 5
}

module.exports.run = async ({ api, event, args, Users }) => {
	let { threadID, messageReply, senderID, mentions, type, participantIDs } = event;
	switch(args[0]){
        case 'call':
            case 'Call': {
                const dataNickName = (await api.getThreadInfo(threadID)).nicknames;
                const objKeys = Object.keys(dataNickName);
                const notFoundIds = participantIDs.filter(id => !objKeys.includes(id));
                const mentions = [];
                
                let tag = '';
                for (let i = 0; i < notFoundIds.length; i++) {
                    const id = notFoundIds[i];
                    const name = await Users.getNameUser(id);
                    mentions.push({ tag: name, id });
                    
                    tag += `${i + 1}. @${name}\n`;
                }
            
                const bd = '📣 Vui lòng setname để mọi người nhận biết bạn dễ dàng hơn';
                
                const message = {
                    body: `${bd}\n\n${tag}`,
                    mentions: mentions
                };
                api.sendMessage(message, threadID);
                return;
            }                          
                       
		case 'del':
		case 'Del': {
			const threadInfo = await api.getThreadInfo(threadID);
			if (!threadInfo.adminIDs.some(admin => admin.id === senderID)) {
				return api.sendMessage(`⚠️ Chỉ quản trị viên mới có thể sử dụng`, threadID);
			}
			const dataNickName = threadInfo.nicknames
			var dataNotNN = []
			const objKeys = Object.keys(dataNickName);
			const notFoundIds = participantIDs.filter(id => !objKeys.includes(id));
			await notFoundIds.map(async (id)=> {
				try{
					api.removeUserFromGroup(id, threadID)
				}catch(e){
					console.log(e)
				}
			});
			return api.sendMessage(`✅ Đã xóa thành công những thành viên không setname`,threadID)
		}
		case 'check':
		case 'Check': {
			const dataNickName = (await api.getThreadInfo(threadID)).nicknames
			var dataNotNN = []
			const objKeys = Object.keys(dataNickName);
			const notFoundIds = participantIDs.filter(id => !objKeys.includes(id));
			var msg = '📝 Danh sách các người dùng chưa setname\n',
				num = 1;
			await notFoundIds.map(async (id)=> {
				const name = await Users.getNameUser(id)
				msg += `\n${num++}. ${name}`
			});
                msg += `\n\n📌 Thả cảm xúc vào tin nhắn này để kick những người không setname ra khỏi nhóm`
			return api.sendMessage(msg,threadID,(error, info) => {
                global.client.handleReaction.push({
                    name: module.exports.config.name,
                    messageID: info.messageID,
                    author: event.senderID,
                    abc: notFoundIds
                })
            })
		}
		break;
		case 'help':
            return api.sendMessage(
                `1. "setname + name" -> Đổi biệt danh của bạn\n` +
                `2. "setname @tag + name" -> Đổi biệt danh của người dùng được đề cập\n` +
                `3. "setname all + name" -> Đổi biệt danh của tất cả thành viên\n` +
                `4. "setname check" -> Hiển thị danh sách người dùng chưa đặt biệt danh\n` +
                `5. "setname del" -> Xóa người dùng chưa setname (chỉ dành cho quản trị viên)\n` +
                `6. "setname call" -> Yêu cầu người dùng chưa đặt biệt danh đặt biệt danh`, threadID);

		case 'all':
		case 'All': {
			try{
				const name = (event.body).split('all')[1]
				var num = 1;
				for(const i of participantIDs){
					num++
					try{
						api.changeNickname(name, threadID, i)
					}catch(e){
						console.log(num + " " + e)
					}
				}
				return api.sendMessage(`✅ Đã đổi biệt danh thành công cho tất cả thành viên`,threadID)
			}catch(e) {
				return console.log(e,threadID)
			}
		}
		break;
	}
	const delayUnsend = 60;// tính theo giây
	if (type == "message_reply") {
		let name2 = await Users.getNameUser(messageReply.senderID)
		const name = args.join(" ")
		return api.changeNickname(`${name}`, threadID, messageReply.senderID),
			api.sendMessage(`✅ Đã đổi tên của ${name2} thành ${name || "tên gốc"}`, threadID, (err, info) =>
			setTimeout(() => {api.unsendMessage(info.messageID) }, delayUnsend * 1000))
	}
	else {
		const mention = Object.keys(mentions)[0];
		const name2 = await Users.getNameUser(mention || senderID)
		if (args.join().indexOf('@') !== -1 ) {
			const name = args.join(' ')
			return api.changeNickname(`${name.replace(mentions[mention],"")}`, threadID, mention),
				api.sendMessage(`✅ Đã đổi tên của ${name2} thành ${name.replace(mentions[mention],"") || "tên gốc"}`, threadID, (err, info) =>
				setTimeout(() => {api.unsendMessage(info.messageID) } , delayUnsend * 1000))
		} else {
			const name = args.join(" ")
			return api.changeNickname(`${name}`, threadID, senderID),
				api.sendMessage(`✅ Đã đổi tên của bạn thành ${name || "tên gốc"}`, threadID, (err, info) =>
				setTimeout(() => {api.unsendMessage(info.messageID) } , delayUnsend * 1000))
		}
	}
}

module.exports.handleReaction = async function({ api, event, Threads, handleReaction, getText }) {
    if (event.userID != handleReaction.author) return;
    if (Array.isArray(handleReaction.abc) && handleReaction.abc.length > 0) {
        let errorMessage = '';
        let successMessage = `✅ Đã xóa thành công ${handleReaction.abc.length} thành viên không set name`;
        let errorOccurred = false;

        for (let i = 0; i < handleReaction.abc.length; i++) {
            const userID = handleReaction.abc[i];
            try {
                await api.removeUserFromGroup(userID, event.threadID);
            } catch (error) {
                errorOccurred = true;
                errorMessage += `⚠️ Lỗi khi xóa ${userID} từ nhóm`;
            }
        }
        api.sendMessage(errorOccurred ? errorMessage : successMessage, event.threadID);
    } else {
        api.sendMessage(`Không có ai!`, event.threadID);
    }
}


