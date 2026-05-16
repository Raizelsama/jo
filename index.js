const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

// ===== الإعدادات =====
const PHONE_NUMBER = "9647886281208"
const OWNER_NUMBER = "972527066516@s.whatsapp.net"
const OWNER_PHONE = "972527066516"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

// ===== منع التكرار =====
const cooldown = new Map()

function canTalk(key, time = 40000) {
  const now = Date.now()
  const last = cooldown.get(key) || 0
  if (now - last < time) return false
  cooldown.set(key, now)
  return true
}

// ===== تشغيل =====
async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  // Pairing
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
        text: "البوت شغال الآن"
      })
    }

    if (connection === "close") {

      const reconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (reconnect) startBot()
    }
  })

  // ===== الرسائل =====
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]
    if (!msg.message) return

    // 🔴 منع رد البوت على نفسه
    if (msg.key.fromMe) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from

    const isGroup = from.endsWith("@g.us")

    // 🔴 الخاص للمطور فقط
    if (!isGroup && sender !== OWNER_NUMBER) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    const lower = text.toLowerCase()

    const reply = async (t) => {
      await sock.sendMessage(from, { text: t }, { quoted: msg })
    }

    let db = loadDB()

    if (!db[sender]) {
      db[sender] = {
        money: 1000,
        bank: 0,
        lastSalary: 0
      }
    }

    const user = db[sender]

    // ===== المطور =====
    if (
      lower.includes("المطور") ||
      lower.includes("من المطور") ||
      lower.includes("مين المطور")
    ) {
      return reply("رقم المطور: " + OWNER_PHONE)
    }

    // ===== فهم الكلام (ذكاء بسيط) =====
    const contains = (words) =>
      words.some(w => lower.includes(w))

    // ردود طبيعية حسب المعنى
    if (contains(["كيفك", "كيف حالك", "شخبارك"])) {
      return reply("تمام وانت؟")
    }

    if (contains(["طفشان", "ملل", "زهقان"])) {
      return reply("واضح القروب ممل شوي")
    }

    if (contains(["هلا", "مرحبا", "السلام"])) {
      return reply("هلا فيك")
    }

    if (contains(["احبك"])) {
      return reply("الله يعينك 😂")
    }

    if (contains(["وينك"])) {
      return reply("هنا موجود")
    }

    // ===== أوامر =====
    const args = text.trim().split(" ")
    const command = args.shift().toLowerCase()

    if (command === "مساعدة" || command === "اوامر") {
      return reply(
`💰 راتب
💰 فلوسي
💰 بنك
🤖 ذكاء`
      )
    }

    // ===== راتب =====
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

    // ===== فلوس =====
    if (command === "فلوسي" || command === "بنك") {
      return reply(`💵 ${user.money}\n🏦 ${user.bank}`)
    }

    // ===== ذكاء =====
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

  })
}

startBot()
