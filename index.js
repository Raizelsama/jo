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

const dbFile = "./users.json"

if (!fs.existsSync(dbFile)) {
  fs.writeJsonSync(dbFile, {})
}

const loadDB = () => fs.readJsonSync(dbFile)
const saveDB = (d) => fs.writeJsonSync(dbFile, d)

function formatTime(ms) {

  let h = Math.floor(ms / 3600000)
  let m = Math.floor((ms % 3600000) / 60000)

  return `${h} ساعة و ${m} دقيقة`
}

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

    // تشغيل
    if (connection === "open") {

      console.log("BOT RUNNING 🔥")

      await sock.sendMessage(OWNER_NUMBER, {
        text: "👋 مرحبا بالمطور"
      })
    }

    // إعادة تشغيل
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

    if (!text) return

    const args =
      text.trim().split(" ")

    const command =
      args.shift().toLowerCase()

    let db = loadDB()

    if (!db[sender]) {

      db[sender] = {
        money: 1000,
        bank: 0,
        level: 1,
        xp: 0,
        lastSalary: 0,
        lastDaily: 0
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

    // =================
    // قائمة الاوامر
    // =================

    if (
      command === "مساعدة" ||
      command === "اوامر"
    ) {

      return reply(
`╭──〔 JO YABOKI 〕──╮

💰 الاقتصاد
• راتب
• يومية
• فلوسي
• بنك
• ايداع
• سحب
• تحويل
• توب
• زرف

🤖 العامة
• ذكاء
• بروفايل

👑 المطور
• مطور

╰────────────────╯`
      )
    }

    // =================
    // اوامر المطور
    // =================

    if (command === "مطور") {

      if (sender !== OWNER_NUMBER)
        return reply("❌ للمطور فقط")

      return reply(
`👑 اوامر المطور

• بان
• فك
• تصفير
• اعطاء
• اعلان`
      )
    }

    // =================
    // راتب
    // =================

    if (command === "راتب") {

      const cooldown =
        6 * 60 * 60 * 1000

      const now = Date.now()

      if (
        now - user.lastSalary <
        cooldown
      ) {

        const left =
          cooldown -
          (now - user.lastSalary)

        return reply(
`⏳ لم يحن وقت الراتب

⌛ المتبقي:
${formatTime(left)}`
        )
      }

      const amount =
        Math.floor(
          Math.random() * 4000
        ) + 1000

      user.money += amount
      user.lastSalary = now

      saveDB(db)

      return reply(
`💸 استلمت راتبك

💵 +${amount}`
      )
    }

    // =================
    // يومية
    // =================

    if (command === "يومية") {

      const cooldown =
        24 * 60 * 60 * 1000

      const now = Date.now()

      if (
        now - user.lastDaily <
        cooldown
      ) {

        const left =
          cooldown -
          (now - user.lastDaily)

        return reply(
`⏳ استلمت اليومية بالفعل

⌛ المتبقي:
${formatTime(left)}`
        )
      }

      const amount =
        Math.floor(
          Math.random() * 9000
        ) + 2000

      user.money += amount
      user.lastDaily = now

      saveDB(db)

      return reply(
`🎁 استلمت اليومية

💵 +${amount}`
      )
    }

    // =================
    // فلوسي
    // =================

    if (
      command === "فلوسي" ||
      command === "بنك"
    ) {

      return reply(
`🏦 حسابك البنكي

💵 الكاش: ${user.money}
🏛 البنك: ${user.bank}

⭐ المستوى: ${user.level}
📈 الخبرة: ${user.xp}`
      )
    }

    // =================
    // ايداع
    // =================

    if (command === "ايداع") {

      const amount =
        parseInt(args[0])

      if (!amount)
        return reply("اكتب مبلغ")

      if (amount > user.money)
        return reply("❌ فلوسك قليلة")

      user.money -= amount
      user.bank += amount

      saveDB(db)

      return reply(
`🏦 تم ايداع ${amount}`
      )
    }

    // =================
    // سحب
    // =================

    if (command === "سحب") {

      const amount =
        parseInt(args[0])

      if (!amount)
        return reply("اكتب مبلغ")

      if (amount > user.bank)
        return reply("❌ رصيد البنك قليل")

      user.bank -= amount
      user.money += amount

      saveDB(db)

      return reply(
`💵 تم سحب ${amount}`
      )
    }

    // =================
    // تحويل
    // =================

    if (command === "تحويل") {

      const mention =
        msg.message.extendedTextMessage
        ?.contextInfo
        ?.mentionedJid?.[0]

      const amount =
        parseInt(args[1])

      if (!mention)
        return reply("منشن الشخص")

      if (!amount)
        return reply("اكتب مبلغ")

      if (amount > user.money)
        return reply("❌ فلوسك قليلة")

      if (!db[mention]) {

        db[mention] = {
          money: 1000,
          bank: 0,
          level: 1,
          xp: 0,
          lastSalary: 0,
          lastDaily: 0
        }
      }

      user.money -= amount
      db[mention].money += amount

      saveDB(db)

      return reply(
`💸 تم تحويل ${amount}`
      )
    }

    // =================
    // زرف
    // =================

    if (command === "زرف") {

      const amount =
        Math.floor(
          Math.random() * 3000
        )

      const success =
        Math.random() < 0.5

      if (!success) {

        user.money -= amount

        if (user.money < 0)
          user.money = 0

        saveDB(db)

        return reply(
`🚔 انقفطت وانت تزرف

💸 خسرت ${amount}`
        )
      }

      user.money += amount

      saveDB(db)

      return reply(
`🕶 نجحت السرقة

💰 ربحت ${amount}`
      )
    }

    // =================
    // توب
    // =================

    if (command === "توب") {

      const sorted =
        Object.entries(db)
        .sort(
          (a, b) =>
          (b[1].money + b[1].bank) -
          (a[1].money + a[1].bank)
        )
        .slice(0, 10)

      let txt =
`🏆 اغنى اللاعبين\n\n`

      sorted.forEach((x, i) => {

        txt +=
`${i + 1}. 💰 ${
x[1].money + x[1].bank
}\n`
      })

      return reply(txt)
    }

    // =================
    // بروفايل
    // =================

    if (command === "بروفايل") {

      return reply(
`👤 بروفايلك

💵 الكاش: ${user.money}
🏦 البنك: ${user.bank}

⭐ المستوى: ${user.level}
📈 الخبرة: ${user.xp}`
      )
    }

    // =================
    // ذكاء
    // =================

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
          "🤖 " +
          res.data.message
        )

      } catch {

        return reply(
          "❌ الذكاء مشغول"
        )
      }
    }

  })
}

startBot()
