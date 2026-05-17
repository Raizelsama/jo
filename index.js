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

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  // ===== pairing =====
  if (!state.creds.registered) {

    setTimeout(async () => {

      const code =
        await sock.requestPairingCode(PHONE_NUMBER)

      console.log("PAIRING CODE:", code)

    }, 3000)
  }

  // ===== connection =====
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

  // ===== messages =====
  sock.ev.on("messages.upsert", async ({ messages }) => {

    const msg = messages[0]

    if (!msg.message) return
    if (msg.key.fromMe) return

    const from = msg.key.remoteJid
    const sender = msg.key.participant || from
    const isGroup = from.endsWith("@g.us")

    // الخاص للمطور فقط
    if (!isGroup && sender !== OWNER_NUMBER) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    const args = text.trim().split(" ")
    const command = args.shift().toLowerCase()

    const reply = async (t) => {
      await sock.sendMessage(from, {
        text: t
      }, {
        quoted: msg
      })
    }

    // ===== database =====
    let db = loadDB()

    if (!db[sender]) {
      db[sender] = {
        money: 1000,
        bank: 0,
        lastSalary: 0,
        lastDaily: 0
      }
    }

    const user = db[sender]

    // ================= MENU =================
    if (command === "مساعدة" || command === "اوامر") {

      return reply(
`╭──〔 JO YABOKI 〕──╮

💰 الاقتصاد
• راتب
• يومية
• فلوسي
• بنك
• ايداع
• سحب
• توب
• زرف

🎮 الترفيه
• حب
• حظ
• ملصق

🤖 العامة
• جو [سؤال]
• بروفايل
• بنج

👑 المطور
• مطور
• تنصيب

╰────────────────╯`
      )
    }

    // ================= ping =================
    if (command === "بنج") {
      return reply("🏓 البوت شغال")
    }

    // ================= developer =================
    if (command === "مطور") {
      return reply("👑 المطور: 972527066516")
    }

    // ================= salary =================
    if (command === "راتب") {

      const now = Date.now()

      if (now - user.lastSalary < 7200000) {
        return reply("⏳ انتظر ساعتين")
      }

      const amount =
        Math.floor(Math.random() * 4000) + 1000

      user.money += amount
      user.lastSalary = now

      saveDB(db)

      return reply(`💸 استلمت ${amount}`)
    }

    // ================= daily =================
    if (command === "يومية") {

      const now = Date.now()

      if (now - user.lastDaily < 86400000) {
        return reply("📦 استلمت اليومية اليوم")
      }

      const amount =
        Math.floor(Math.random() * 3000) + 500

      user.money += amount
      user.lastDaily = now

      saveDB(db)

      return reply(`📦 استلمت اليومية: ${amount}`)
    }

    // ================= wallet =================
    if (command === "فلوسي" || command === "بنك") {

      return reply(
`💰 الكاش: ${user.money}
🏦 البنك: ${user.bank}`
      )
    }

    // ================= deposit =================
    if (command === "ايداع") {

      const amount = parseInt(args[0])

      if (!amount)
        return reply("اكتب مبلغ")

      if (amount > user.money)
        return reply("ما معك فلوس")

      user.money -= amount
      user.bank += amount

      saveDB(db)

      return reply("🏦 تم الايداع")
    }

    // ================= withdraw =================
    if (command === "سحب") {

      const amount = parseInt(args[0])

      if (!amount)
        return reply("اكتب مبلغ")

      if (amount > user.bank)
        return reply("رصيد البنك قليل")

      user.bank -= amount
      user.money += amount

      saveDB(db)

      return reply("💵 تم السحب")
    }

    // ================= steal =================
    if (command === "زرف") {

      const amount =
        Math.floor(Math.random() * 1000)

      user.money += amount

      saveDB(db)

      return reply(`🕶️ سرقت ${amount}`)
    }

    // ================= top =================
    if (command === "توب") {

      const users = Object.entries(db)

      const top = users
        .sort((a, b) => b[1].money - a[1].money)
        .slice(0, 5)

      let txt = "🏆 أغنى الناس:\n\n"

      top.forEach((u, i) => {
        txt += `${i + 1}. ${u[1].money}\n`
      })

      return reply(txt)
    }

    // ================= love =================
    if (command === "حب") {

      const love =
        Math.floor(Math.random() * 101)

      return reply(`❤️ نسبة الحب: ${love}%`)
    }

    // ================= luck =================
    if (command === "حظ") {

      const luck =
        Math.floor(Math.random() * 101)

      return reply(`🍀 حظك اليوم: ${luck}%`)
    }

    // ================= JO AI =================
    if (command === "جو") {

      const q = args.join(" ")

      if (!q)
        return reply("اكتب كلام بعد كلمة جو")

      try {

        const res = await axios.get(
          `https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(q)}&owner=Raizel&botname=JO`
        )

        return reply(res.data.response)

      } catch (e) {

        console.log(e)

        return reply("تعذر الاتصال بالذكاء")
      }
    }

    // ================= profile =================
    if (command === "بروفايل") {

      try {

        const pp =
          await sock.profilePictureUrl(sender, "image")

        await sock.sendMessage(from, {
          image: { url: pp },
          caption:
`╭──〔 PROFILE 〕──╮

👤 الاسم: ${msg.pushName}

💰 المال: ${user.money}

🏦 البنك: ${user.bank}

╰────────────────╯`
        }, { quoted: msg })

      } catch {

        await reply(
`👤 الاسم: ${msg.pushName}

💰 المال: ${user.money}

🏦 البنك: ${user.bank}`
        )
      }
    }

    // ================= sticker =================
    if (command === "ملصق") {

      try {

        const quoted =
          msg.message?.extendedTextMessage?.contextInfo

        if (!quoted)
          return reply("رد على صورة واكتب ملصق")

        const media =
          await sock.downloadMediaMessage({
            key: {
              remoteJid: from,
              id: quoted.stanzaId,
              participant: quoted.participant
            },
            message: quoted.quotedMessage
          })

        await sock.sendMessage(from, {
          sticker: media
        }, {
          quoted: msg
        })

      } catch (e) {

        console.log(e)

        reply("فشل صنع الملصق")
      }
    }

    // ================= install =================
    if (command === "تنصيب") {

      return reply(
`📥 تنصيب بوت فرعي

1- ارفع الملفات
2- npm install
3- npm start
4- اربط الرقم

⚡ جاهز`
      )
    }

  })
}

startBot()
