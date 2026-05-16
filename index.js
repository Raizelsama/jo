const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

// ====== إعدادات ======
const PHONE_NUMBER = "9647886281208"
const OWNER_NUMBER = "972527066516@s.whatsapp.net"
const OWNER_PHONE = "972527066516"

const dbFile = "./users.json"

// ====== قاعدة بيانات ======
if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

// ====== ذاكرة بسيطة ======
const memory = {}
const cooldown = new Map()

function canTalk(key, time = 30000) {
  const now = Date.now()
  const last = cooldown.get(key) || 0
  if (now - last < time) return false
  cooldown.set(key, now)
  return true
}

function getUser(sender, name) {
  if (!memory[sender]) {
    memory[sender] = {
      name: name || "شخص",
      msgs: 0,
      mood: "normal"
    }
  }

  memory[sender].msgs++

  if (memory[sender].msgs > 30) memory[sender].mood = "known"
  if (memory[sender].msgs > 80) memory[sender].mood = "familiar"

  return memory[sender]
}

// ====== تشغيل البوت ======
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

      console.log("PAIRING CODE:", code)
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

  // ====== الرسائل ======
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

    const isGroup = from.endsWith("@g.us")

    let db = loadDB()

    if (!db[sender]) {
      db[sender] = {
        money: 1000,
        bank: 0,
        lastSalary: 0
      }
    }

    const user = db[sender]
    const profile = getUser(sender, msg.pushName)

    const reply = async (t) => {
      await sock.sendMessage(from, { text: t }, { quoted: msg })
    }

    // ====== خاص للمطور فقط ======
    if (!isGroup && sender !== OWNER_NUMBER) {
      return
    }

    // ====== سؤال عن المطور ======
    if (
      lower.includes("المطور") ||
      lower.includes("من المطور") ||
      lower.includes("مين المطور")
    ) {
      return reply("رقم المطور: " + OWNER_PHONE)
    }

    // ====== اوامر ======
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
زرف`
      )
    }

    // ====== راتب ======
    if (command === "راتب") {

      const now = Date.now()
      const cooldownTime = 2 * 60 * 60 * 1000

      if (now - user.lastSalary < cooldownTime) {
        return reply("انتظر شوي")
      }

      const amount =
        Math.floor(Math.random() * 4000) + 1000

      user.money += amount
      user.lastSalary = now

      saveDB(db)

      return reply("استلمت " + amount)
    }

    // ====== فلوس ======
    if (command === "فلوسي" || command === "بنك") {
      return reply(
`💵 ${user.money}
🏦 ${user.bank}`
      )
    }

    // ====== ذكاء بسيط ======
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

    // ====== تفاعل ذكي (بدون عشوائية) ======
    if (isGroup) {

      const userMem = getUser(sender, msg.pushName)

      const botNames = ["بوت", "جو", "يا بوت", "جو يابوكي"]

      const mentionedBot =
        botNames.some(n => lower.includes(n))

      if (!mentionedBot) return

      if (!canTalk(from + "smart", 40000)) return

      if (lower.includes("كيفك")) return reply("تمام وانت؟")
      if (lower.includes("طفشان")) return reply("واضح القروب ممل")
      if (lower.includes("احبك")) return reply("الله يعينك 😂")
      if (lower.includes("وينك")) return reply("هنا موجود")

      return reply(`نعم يا ${userMem.name}`)
    }

  })
}

startBot()
