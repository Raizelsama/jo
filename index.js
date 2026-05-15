const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

const PREFIX = "#"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) fs.writeJsonSync(dbFile, {})

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (data) => fs.writeJsonSync(dbFile, data)

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    if (!text.startsWith(PREFIX)) return

    const args = text.slice(1).trim().split(" ")
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

    const reply = (t) => {
      sock.sendMessage(from, { text: t }, { quoted: msg })
    }

    // راتب
    if (command === "راتب") {
      const now = Date.now()
      const cooldown = 12 * 60 * 60 * 1000

      if (now - user.lastSalary < cooldown) {
        return reply("⏳ انتظر لين يجيك الراتب")
      }

      user.money += 500
      user.lastSalary = now
      saveDB(db)

      return reply("💸 استلمت 500 ريال راتب")
    }

    // فلوسي
    if (command === "فلوسي") {
      return reply(
`💰 حسابك:
💵 الكاش: ${user.money}
🏦 البنك: ${user.bank}`
      )
    }

    // بنك
    if (command === "بنك") {
      return reply(
`🏦 البنك:
💵 الكاش: ${user.money}
🏦 الرصيد: ${user.bank}`
      )
    }

    // ايداع
    if (command === "ايداع") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")

      if (amount > user.money) return reply("فلوسك ما تكفي")

      user.money -= amount
      user.bank += amount
      saveDB(db)

      return reply("🏦 تم الايداع")
    }

    // سحب
    if (command === "سحب") {
      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")

      if (amount > user.bank) return reply("رصيدك بالبنك قليل")

      user.bank -= amount
      user.money += amount
      saveDB(db)

      return reply("💵 تم السحب")
    }

    // ذكاء اصطناعي
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
      return reply(
`🤖 بوت جو يابوكي

الأوامر:
#راتب
#فلوسي
#بنك
#ايداع
#سحب
#ذكاء`
      )
    }

  })

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) startBot()
    }

    if (connection === "open") {
      console.log("البوت شغال 🔥")
    }
  })
}

startBot()
