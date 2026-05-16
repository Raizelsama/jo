const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

const OWNER_NUMBER = "972527066516@s.whatsapp.net"
const PHONE_NUMBER = "9647886281208"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

// منع التكرار
const cooldown = new Map()
function canTalk(key, time = 40000) {
  const now = Date.now()
  const last = cooldown.get(key) || 0
  if (now - last < time) return false
  cooldown.set(key, now)
  return true
}

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  // pairing
  if (!state.creds.registered) {
    setTimeout(async () => {
      const code = await sock.requestPairingCode(PHONE_NUMBER)
      console.log("PAIRING CODE:", code)
    }, 3000)
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "open") {
      console.log("BOT ONLINE 🔥")
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

    // مهم: منع رد البوت على نفسه
    if (msg.key.fromMe) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from
    const isGroup = from.endsWith("@g.us")

    // خاص للمطور فقط
    if (!isGroup && sender !== OWNER_NUMBER) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    const lower = text.trim().toLowerCase()

    const args = text.trim().split(" ")
    const command = args.shift().toLowerCase()

    const reply = (t) =>
      sock.sendMessage(from, { text: t }, { quoted: msg })

    // قاعدة بيانات
    let db = loadDB()

    if (!db[sender]) {
      db[sender] = {
        money: 1000,
        bank: 0,
        lastSalary: 0
      }
    }

    const user = db[sender]

    // ================= القائمة =================
    if (command === "مساعدة" || command === "اوامر") {
      return reply(
`╭──〔 JO YABOKI 〕──╮

💰 الاقتصاد
• راتب
• فلوسي
• بنك
• ايداع
• سحب

🤖 الذكاء
• ذكاء

👤 عام
• بروفايل

👑 مطور
• مطور

╰────────────────╯`
      )
    }

    // ================= المطور =================
    if (lower.includes("المطور")) {
      return reply("المطور: " + OWNER_NUMBER.replace("@s.whatsapp.net", ""))
    }

    // ================= راتب =================
    if (command === "راتب") {

      const now = Date.now()
      const cooldownTime = 2 * 60 * 60 * 1000

      if (now - user.lastSalary < cooldownTime) {
        return reply("⏳ انتظر ساعتين")
      }

      const amount = Math.floor(Math.random() * 4000) + 1000
      user.money += amount
      user.lastSalary = now

      saveDB(db)
      return reply("💸 استلمت " + amount)
    }

    // ================= فلوس =================
    if (command === "فلوسي" || command === "بنك") {
      return reply(`💰 ${user.money}\n🏦 ${user.bank}`)
    }

    // ================= ايداع =================
    if (command === "ايداع") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")
      if (amount > user.money) return reply("ما معك كاش")

      user.money -= amount
      user.bank += amount

      saveDB(db)
      return reply("🏦 تم الايداع")
    }

    // ================= سحب =================
    if (command === "سحب") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")
      if (amount > user.bank) return reply("رصيد البنك قليل")

      user.bank -= amount
      user.money += amount

      saveDB(db)
      return reply("💵 تم السحب")
    }

    // ================= ذكاء =================
    if (command === "ذكاء") {
      let q = args.join(" ")
      if (!q) return reply("اكتب سؤال")

      try {
        const res = await axios.get("https://api.simsimi.vn/v2/simtalk", {
          params: { text: q, lc: "ar" }
        })

        return reply("🤖 " + res.data.message)

      } catch {
        return reply("الذكاء مشغول")
      }
    }

    // ================= بروفايل =================
    if (command === "بروفايل") {
      return reply(
`👤 الاسم: ${msg.pushName}
💰 المال: ${user.money}
🏦 البنك: ${user.bank}`
      )
    }

  })
}

startBot()
