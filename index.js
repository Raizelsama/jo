const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")

const PREFIX = "#"

// رقم المطور
const OWNER_NUMBER = "972527066516@s.whatsapp.net"

const dbFile = "./users.json"
if (!fs.existsSync(dbFile)) fs.writeJsonSync(dbFile, {})

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: true
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
      db[sender] = { money: 1000, bank: 0, lastSalary: 0 }
    }

    const user = db[sender]

    const reply = (t) =>
      sock.sendMessage(from, { text: t }, { quoted: msg })

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
    if (command === "
