const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const axios = require("axios")
const P = require("pino")
const { createCanvas, loadImage } = require("canvas")

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

// ====== شخصية البوت ======

const botReplies = [
  "القروب شكله فوضى اليوم",
  "ركزوا شوي يا جماعة",
  "واضح مافي أحد فاهم",
  "يا ساتر على الكلام",
  "الصلاة على النبي",
  "استغفروا ربكم",
  "واضح ملل عندكم",
  "كمية هبد غير طبيعية"
]

const azkar = [
  "الصلاة على النبي",
  "استغفر الله",
  "سبحان الله",
  "لا اله الا الله",
  "سبحان الله وبحمده",
  "اذكروا الله"
]

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

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

    const reply = async (t) => {
      await sock.sendMessage(from, { text: t }, { quoted: msg })
    }

    const args = text.trim().split(" ")
    const command = args.shift().toLowerCase()

    // ================= تفاعل عشوائي =================

    if (from.endsWith("@g.us")) {
      if (Math.random() < 0.06) {
        return reply(rand(botReplies))
      }
    }

    // ================= ردود طبيعية =================

    if (lower.includes("السلام")) return reply("وعليكم السلام")
    if (lower.includes("هلا")) return reply("هلا وغلا")
    if (lower.includes("مرحبا")) return reply("أهلا")
    if (lower.includes("طفشان")) return reply("واضح من كلامك")
    if (lower.includes("كيفك")) return reply("تمام وانت؟")
    if (lower.includes("احبك")) return reply("الله يعينك")
    if (lower.includes("وينك")) return reply("هنا")

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

    // ================= يومية =================

    if (command === "يومية") {

      const cooldown = 24 * 60 * 60 * 1000
      const now = Date.now()

      if (now - user.lastDaily < cooldown) {
        return reply(
          "انتظر: " +
          formatTime(cooldown - (now - user.lastDaily))
        )
      }

      const amount =
        Math.floor(Math.random() * 9000) + 2000

      user.money += amount
      user.lastDaily = now

      saveDB(db)

      return reply("استلمت يومية " + amount)
    }

    // ================= فلوس =================

    if (command === "فلوسي" || command === "بنك") {

      return reply(
`💵 ${user.money}
🏦 ${user.bank}`
      )
    }

    // ================= ايداع =================

    if (command === "ايداع") {

      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")

      if (amount > user.money)
        return reply("فلوسك قليلة")

      user.money -= amount
      user.bank += amount

      saveDB(db)

      return reply("تم الايداع")
    }

    // ================= سحب =================

    if (command === "سحب") {

      let amount = parseInt(args[0])
      if (!amount) return reply("اكتب مبلغ")

      if (amount > user.bank)
        return reply("رصيد البنك قليل")

      user.bank -= amount
      user.money += amount

      saveDB(db)

      return reply("تم السحب")
    }

    // ================= تحويل =================

    if (command === "تحويل") {

      const mention =
        msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

      let amount = parseInt(args[1])

      if (!mention) return reply("منشن شخص")
      if (!amount) return reply("اكتب مبلغ")

      if (amount > user.money)
        return reply("فلوسك قليلة")

      if (!db[mention]) {
        db[mention] = {
          money: 1000,
          bank: 0,
          lastSalary: 0,
          lastDaily: 0
        }
      }

      user.money -= amount
      db[mention].money += amount

      saveDB(db)

      return reply("تم التحويل")
    }

    // ================= زرف =================

    if (command === "زرف") {

      let amount =
        Math.floor(Math.random() * 3000)

      if (Math.random() < 0.5) {

        user.money -= amount
        if (user.money < 0) user.money = 0

        saveDB(db)

        return reply("انقفطت وخسرت " + amount)
      }

      user.money += amount

      saveDB(db)

      return reply("نجحت السرقة " + amount)
    }

    // ================= توب =================

    if (command === "توب") {

      let sorted =
        Object.entries(db)
          .sort((a, b) =>
            (b[1].money + b[1].bank) -
            (a[1].money + a[1].bank)
          )
          .slice(0, 10)

      let txt = "🏆 التوب\n\n"

      sorted.forEach((x, i) => {
        txt += `${i + 1}. ${x[1].money + x[1].bank}\n`
      })

      return reply(txt)
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

    // ================= ملصق =================

    if (command === "ملصق") {

      let media =
        msg.message.imageMessage ||
        msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

      if (!media)
        return reply("ارسل صورة")

      let buffer =
        await sock.downloadMediaMessage(msg)

      const img = await loadImage(buffer)

      const canvas = createCanvas(512, 512)
      const ctx = canvas.getContext("2d")

      ctx.drawImage(img, 0, 0, 512, 512)

      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.fillRect(0, 430, 512, 82)

      ctx.fillStyle = "white"
      ctx.font = "bold 18px Sans"
      ctx.fillText("جو يابوكي | المطور : رايزل", 10, 460)

      const userName =
        msg.pushName || sender.split("@")[0]

      ctx.font = "16px Sans"
      ctx.fillText(userName, 10, 490)

      const sticker = canvas.toBuffer("image/png")

      await sock.sendMessage(from, {
        sticker
      }, { quoted: msg })
    }

    // ================= اذكار =================

    if (Math.random() < 0.03) {
      return reply(rand(azkar))
    }

  })
}

startBot()
