const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

const PREFIX = "#"
const NUMBER = "+972527066516"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) fs.writeJsonSync(dbFile, {})

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  // Pairing Code (بدون QR)
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(NUMBER)
        console.log("====================")
        console.log("PAIRING CODE:", code)
        console.log("====================")
      } catch (e) {
        console.log("فشل توليد الكود")
      }
    }, 3000)
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

    if (!text.startsWith(PREFIX)) return

    const args = text.slice(1).trim().split(" ")
    const command = args.shift().toLowerCase()

    let db = loadDB()

    if (!db[sender]) {
      db[sender] = { money: 1000, bank: 0, lastSalary: 0 }
    }

    const user = db[sender]

    const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg })

    // راتب
    if (command === "راتب") {
      const now = Date.now()
      const cooldown = 12 * 60 * 60 * 1000

      if (now - user.lastSalary < cooldown)
        return reply("⏳ انتظر الراتب")

      user.money += 500
      user.lastSalary = now
      saveDB(db)

      return reply("💸 استلمت 500 ريال")
    }

    // فلوسي
    if (command === "فلوسي") {
      return reply(`💰 الكاش: ${user.money}\n🏦 البنك: ${user.bank}`)
    }

    // بنك
    if (command === "بنك") {
      return reply(`🏦 البنك\n💵 ${user.money}\n🏦 ${user.bank}`)
    }

    // ايداع
    if (command === "ايداع") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")
      if (amount > user.money) return reply("ما معك فلوس")

      user.money -= amount
      user.bank += amount
      saveDB(db)

      return reply("🏦 تم الايداع")
    }

    // سحب
    if (command === "سحب") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")
      if (amount > user.bank) return reply("رصيد البنك قليل")

      user.bank -= amount
      user.money += amount
      saveDB(db)

      return reply("💵 تم السحب")
    }

    // ذكاء
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

    // مساعدة
    if (command === "مساعدة") {
      return reply(`#راتب\n#فلوسي\n#بنك\n#ايداع\n#سحب\n#ذكاء`)
    }
  })

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    }

    if (connection === "open") {
      console.log("BOT RUNNING 🔥")
    }
  })
}

startBot()
