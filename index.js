const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

// رقم البوت
const PHONE_NUMBER = "9647886281208"

// رقم المطور
const OWNER_NUMBER = "972527066516@s.whatsapp.net"
const OWNER_PHONE = "972527066516"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatTime(ms) {
  let h = Math.floor(ms / 3600000)
  let m = Math.floor((ms % 3600000) / 60000)
  return `${h} ساعة و ${m} دقيقة`
}

// شخصيات البوت
const botReplies = [
  "واضح القروب فوضى",
  "ركزوا شوي",
  "يا ساتر على الكلام",
  "الصلاة على النبي",
  "استغفروا الله",
  "القروب هادئ اليوم",
  "وش السالفة هنا"
]

const azkar = [
  "الصلاة على النبي",
  "استغفر الله",
  "سبحان الله",
  "لا اله الا الله",
  "سبحان الله وبحمده"
]

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  // Pairing Code
  if (!state.creds.registered) {

    setTimeout(async () => {

      const code =
        await sock.requestPairingCode(PHONE_NUMBER)

      console.log(`
====================
PAIRING CODE: ${code}
====================
`)

    }, 5000)
  }

  sock.ev.on("connection.update", async (update) => {

    const { connection, lastDisconnect } = update

    if (connection === "open") {

      console.log("BOT RUNNING 🔥")

      await sock.sendMessage(OWNER_NUMBER, {
        text: "مرحبا بالمطور"
      })
    }

    if (connection === "close") {

      const reconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (reconnect) startBot()
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    const lower = text.toLowerCase()

    const args = text.trim().split(" ")
    const command = args.shift().toLowerCase()

    let db = loadDB()

    if (!db[sender]) {
      db[sender] = {
        money: 1000,
        bank: 0,
        lastSalary: 0
      }
    }

    const user = db[sender]

    const reply = async (t) => {
      await sock.sendMessage(from, { text: t }, { quoted: msg })
    }

    // ================= سؤال عن المطور =================

    if (
      lower.includes("المطور") ||
      lower.includes("من المطور") ||
      lower.includes("مين المطور")
    ) {
      return reply("رقم المطور: " + OWNER_PHONE)
    }

    // ================= اوامر =================

    if (command === "مساعدة" || command === "اوامر") {

      return reply(
`💰 اقتصاد:
راتب
يومية
فلوسي
بنك
ايداع
سحب
تحويل
توب
زرف

🤖 ذكاء:
ذكاء

👑 مطور:
مطور`
      )
    }

    if (command === "مطور") {

      if (sender !== OWNER_NUMBER)
        return reply("هذا الأمر للمطور فقط")

      return reply("لوحة المطور")
    }

    // ================= راتب =================

    if (command === "راتب") {

      const cooldown = 2 * 60 * 60 * 1000
      const now = Date.now()

      if (now - user.lastSalary < cooldown) {
        return reply(
          "انتظر: " +
          formatTime(cooldown - (now - user.lastSalary))
        )
      }

      const amount =
        Math.floor(Math.random() * 4000) + 1000

      user.money += amount
      user.lastSalary = now

      saveDB(db)

      return reply("استلمت " + amount)
    }

    // ================= فلوس =================

    if (command === "فلوسي" || command === "بنك") {

      return reply(
`💵 ${user.money}
🏦 ${user.bank}`
      )
    }

    // ================= ذكاء =================

    if (command === "ذكاء") {

      const q = args.join(" ")
      if (!q) return reply("اكتب سؤال")

      try {

        const res =
          await axios.get("https://api.simsimi.vn/v2/simtalk", {
            params: { text: q, lc: "ar" }
          })

        return reply(res.data.message)

      } catch {
        return reply("الذكاء مشغول")
      }
    }

    // ================= تفاعل بسيط =================

    if (from.endsWith("@g.us")) {

      if (Math.random() < 0.05) {
        return reply(rand(botReplies))
      }

      if (Math.random() < 0.02) {
        return reply(rand(azkar))
      }
    }

  })
}

startBot()
