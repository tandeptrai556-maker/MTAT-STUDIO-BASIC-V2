const axios = require('axios');

module.exports.config = {
    name: "weather",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "MTAT STUDIO",
    description: "Xem thời tiết theo thành phố",
    commandCategory: "Tiện ích",
    usages: "[tên thành phố]",
    cooldowns: 10
};

module.exports.run = async function ({ api, event, args }) {
    try {
        const city = args.join(" ");
        if (!city) {
            return api.sendMessage(
                "🌤️ Vui lòng nhập tên thành phố!\n\n📌 Ví dụ: /weather Hà Nội",
                event.threadID, event.messageID
            );
        }

        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=vi`;
        const res = await axios.get(url, { timeout: 10000 });
        const d = res.data;

        const current = d.current_condition[0];
        const area = d.nearest_area[0];
        const areaName = area.areaName[0].value;
        const country = area.country[0].value;

        const tempC = current.temp_C;
        const feelsLike = current.FeelsLikeC;
        const humidity = current.humidity;
        const windKmph = current.windspeedKmph;
        const desc = current.lang_vi?.[0]?.value || current.weatherDesc[0].value;
        const uvIndex = current.uvIndex;
        const visibility = current.visibility;
        const pressure = current.pressure;

        const weatherEmoji = (desc) => {
            const d = desc.toLowerCase();
            if (d.includes("mưa") || d.includes("rain")) return "🌧️";
            if (d.includes("nắng") || d.includes("sunny") || d.includes("clear")) return "☀️";
            if (d.includes("mây") || d.includes("cloud")) return "⛅";
            if (d.includes("sương") || d.includes("fog") || d.includes("mist")) return "🌫️";
            if (d.includes("bão") || d.includes("storm") || d.includes("thunder")) return "⛈️";
            if (d.includes("tuyết") || d.includes("snow")) return "❄️";
            return "🌡️";
        };

        const today = d.weather[0];
        const tomorrow = d.weather[1];
        const formatDay = (w) => {
            const max = w.maxtempC, min = w.mintempC;
            const desc = w.hourly[4]?.lang_vi?.[0]?.value || w.hourly[4]?.weatherDesc[0]?.value || "";
            return `${weatherEmoji(desc)} ${desc} | 🔺${max}°C 🔻${min}°C`;
        };

        const msg =
            `╔══════════════════════╗\n` +
            `║  🌤️  DỰ BÁO THỜI TIẾT  ║\n` +
            `╚══════════════════════╝\n\n` +
            `📍 Địa điểm: ${areaName}, ${country}\n\n` +
            `🌡️ Hiện tại:\n` +
            `   ${weatherEmoji(desc)} ${desc}\n` +
            `   • Nhiệt độ: ${tempC}°C (cảm giác ${feelsLike}°C)\n` +
            `   • Độ ẩm: ${humidity}%\n` +
            `   • Gió: ${windKmph} km/h\n` +
            `   • Tầm nhìn: ${visibility} km\n` +
            `   • Áp suất: ${pressure} hPa\n` +
            `   • Chỉ số UV: ${uvIndex}\n\n` +
            `📅 Dự báo:\n` +
            `   Hôm nay:  ${formatDay(today)}\n` +
            `   Ngày mai: ${formatDay(tomorrow)}\n\n` +
            `🤖 MTAT STUDIO Bot`;

        return api.sendMessage(msg, event.threadID, event.messageID);
    } catch (e) {
        console.log(e);
        return api.sendMessage(
            "❌ Không tìm thấy thông tin thời tiết!\nVui lòng kiểm tra lại tên thành phố.",
            event.threadID, event.messageID
        );
    }
};
