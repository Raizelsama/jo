const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

const PREFIX = "#"

// رقم البوت
const PHONE_NUMBER = "9647886281208"

// رقم المطور
const OWNER_NUMBER = "972527066516@s.whatsapp.net"

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

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
        await sock.requestPairingCode(
          PHONE_NUMBER
        )

      console.log(`
====================
PAIRING CODE: ${code}
====================
`)

    }, 5000)
  }

  sock.ev.on("connection.update", async (update) => {

    const { connection, lastDisconnect } = update

    // عند الاتصال
    if (connection === "open") {

      console.log("BOT RUNNING 🔥")

      await sock.sendMessage(OWNER_NUMBER, {
        text: "👋 مرحبا بالمطور"
      })
    }

    // إعادة الاتصال
    if (connection === "close") {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) {
        startBot()
      }
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

    if (!text.startsWith(PREFIX)) return

    const args =
      text.slice(1).trim().split(" ")

    const command =
      args.shift().toLowerCase()

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
      await sock.sendMessage(
        from,
        { text: t },
        { quoted: msg }
      )
    }

    // راتب
    if (command === "راتب") {

      const now = Date.now()
      const cooldown =
        12 * 60 * 60 * 1000

      if (
        now - user.lastSalary <
        cooldown
      ) {
        return reply("⏳ انتظر الراتب")
      }

      user.money += 500
      user.lastSalary = now

      saveDB(db)

      return reply("💸 استلمت 500 ريال")
    }

    // فلوسي
    if (command === "فلوسي") {

      return reply(
        `💰 الكاش: ${user.money}\n🏦 البنك: ${user.bank}`
      )
    }

    // بنك
    if (command === "بنك") {

      return reply(
        `🏦 البنك\n💵 ${user.money}\n🏦 ${user.bank}`
      )
    }

    // ذكاء
    if (command === "ذكاء") {

      const q = args.join(" ")

      if (!q)
        return reply("اكتب سؤال")

      try {

        const res =
          await axios.get(
            "https://api.simsimi.vn/v2/simtalk",
            {
              params: {
                text: q,
                lc: "ar"
              }
            }
          )

        return reply(
          "🤖 " + res.data.message
        )

      } catch {

        return reply(
          "الذكاء مشغول"
        )
      }
    }

    // مساعدة
    if (command === "مساعدة") {

      return reply(
`#راتب
#فلوسي
#بنك
#ذكاء`
      )
    }

  })
}

startBot()
