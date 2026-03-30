const { spawn }  = require("child_process");
const logger      = require("./utils/log");

// ─── CẤU HÌNH RESTART ──────────────────────────────────────────────────────
const RESTART_DELAY_MS  = 4000;   // Chờ 4s trước khi restart
const MAX_CRASH_STREAK  = 10;     // Cảnh báo nếu crash quá nhiều lần liên tiếp
const CRASH_RESET_MS    = 60000;  // Nếu bot sống > 60s thì reset bộ đếm crash
// ───────────────────────────────────────────────────────────────────────────

// EXIT CODES:
//   0  = tắt bình thường  → KHÔNG restart
//   1  = crash / lỗi      → restart bot
//   2  = cookie die        → đã switch account trong mirai.js → restart nhanh

let crashStreak   = 0;
let lastStartTime = null;

// ─── BANNER ────────────────────────────────────────────────────────────────
function printBanner() {
    try {
        const chalk = require("chalk");
        const lines = [
            "╔══════════════════════════════════════════════╗",
            "║                                              ║",
            "║   ███╗   ███╗████████╗ █████╗ ████████╗     ║",
            "║   ████╗ ████║╚══██╔══╝██╔══██╗╚══██╔══╝     ║",
            "║   ██╔████╔██║   ██║   ███████║   ██║         ║",
            "║   ██║╚██╔╝██║   ██║   ██╔══██║   ██║         ║",
            "║   ██║ ╚═╝ ██║   ██║   ██║  ██║   ██║         ║",
            "║   ╚═╝     ╚═╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝         ║",
            "║                                              ║",
            "║        🤖  MTAT STUDIO BOT  V3.0.0           ║",
            "║        Messenger Chatbot Framework           ║",
            "║                                              ║",
            "╚══════════════════════════════════════════════╝",
        ];
        const colors = [
            chalk.cyan, chalk.cyan,
            chalk.magentaBright, chalk.magentaBright, chalk.magentaBright,
            chalk.magentaBright, chalk.magentaBright, chalk.magentaBright,
            chalk.cyan,
            chalk.yellowBright,
            chalk.whiteBright,
            chalk.cyan, chalk.cyan,
        ];
        console.log("");
        lines.forEach((line, i) => console.log((colors[i] || chalk.cyan)(line)));
        console.log("");
    } catch (_) {
        // chalk chưa cài → in plain text
        console.log("\n=== MTAT STUDIO BOT V3.0.0 ===\n");
    }
}

// ─── KHỞI ĐỘNG BOT ─────────────────────────────────────────────────────────
function startBot(reason) {
    if (reason) logger(reason, "[ RESTART ]");
    lastStartTime = Date.now();

    const child = spawn(
        "node",
        ["--trace-warnings", "--async-stack-traces", "mirai.js"],
        { cwd: __dirname, stdio: "inherit", shell: true }
    );

    child.on("close", (exitCode) => {
        const uptime = Date.now() - lastStartTime;

        // Bot sống lâu → reset streak
        if (uptime > CRASH_RESET_MS) crashStreak = 0;

        // Tắt chủ động → không restart
        if (exitCode === 0) {
            logger("Bot đã dừng bình thường. Không restart.", "[ EXIT ]");
            return;
        }

        crashStreak++;
        const isCookieDie = (exitCode === 2);
        const delay = isCookieDie
            ? 2000
            : Math.min(RESTART_DELAY_MS * Math.ceil(crashStreak / 3), 30_000);

        const msg = isCookieDie
            ? `⚠️  Cookie die! Đang chuyển tài khoản... (lần ${crashStreak})`
            : `❌ Bot crash (exit ${exitCode}), restart sau ${delay / 1000}s... (lần ${crashStreak})`;

        logger(msg, "[ RESTART ]");

        if (crashStreak >= MAX_CRASH_STREAK) {
            logger(
                `⚠️  Đã crash ${crashStreak} lần liên tiếp – hãy kiểm tra log!`,
                "[ WARN ]"
            );
        }

        setTimeout(() => startBot("🔄 Đang khởi động lại bot..."), delay);
    });

    child.on("error", (err) => {
        logger("Không thể khởi chạy tiến trình: " + err.message, "[ ERROR ]");
        setTimeout(() => startBot("🔄 Thử lại sau lỗi spawn..."), RESTART_DELAY_MS);
    });
}

// ─── SIGNAL HANDLERS ───────────────────────────────────────────────────────
process.on("SIGINT",  () => { logger("Nhận SIGINT, dừng bot.", "[ EXIT ]"); process.exit(0); });
process.on("SIGTERM", () => { logger("Nhận SIGTERM, dừng bot.", "[ EXIT ]"); process.exit(0); });

// ─── MAIN ──────────────────────────────────────────────────────────────────
printBanner();
startBot("🚀 Khởi động MTAT STUDIO Bot...");
