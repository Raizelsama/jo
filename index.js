const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadContentFromMessage
} = require('@whiskeysockets/baileys')

const fs = require('fs-extra')
const P = require('pino')
const axios = require('axios')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')

ffmpeg.setFfmpegPath(ffmpegPath)

const OWNER = '972527066516@s.whatsapp.net'
const PHONE_NUMBER = '9647886281208'

async function startBot() {

const { state, saveCreds } = await useMultiFileAuthState('session')

const sock = makeWASocket({
  auth: state,
  logger: P({ level: 'silent' })
})

sock.ev.on('creds.update', saveCreds)

if (!state.creds.registered) {
setTimeout(async () => {
const code = await sock.requestPairingCode(PHONE_NUMBER)
console.log('PAIR CODE:', code)
}, 3000)
}

sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {

if (connection === 'open') {
console.log('JO BOT ONLINE 🔥')
}

if (connection === 'close') {
const reconnect =
lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

if (reconnect) startBot()
}
})

sock.ev.on('messages.upsert', async ({ messages }) => {

try {

const m = messages[0]
if (!m.message) return
if (m.key.fromMe) return

const from = m.key.remoteJid

const text =
m.message.conversation ||
m.message.extendedTextMessage?.text ||
''

const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: m })

// ===== اوامر =====

if (text === '.menu') {
return reply(`
╭── JO YABOKI BOT
│
├ .ai
├ .sticker
├ .ping
├ .owner
│
╰──────────
`)
}

// ===== ping =====

if (text === '.ping') {
return reply('pong 🟢')
}

// ===== owner =====

if (text === '.owner') {
return reply('مالك البوت: JO YABOKI')
}

// ===== AI =====

if (text.startsWith('.ai ')) {

const q = text.slice(4)

try {

const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(q)}&lc=ar`)

return reply(res.data.message)

} catch {
return reply('الذكاء الاصطناعي خربان حالياً')
}
}

// ===== sticker =====

if (text === '.sticker') {

const quoted =
m.message.extendedTextMessage?.contextInfo?.quotedMessage

if (!quoted?.imageMessage) {
return reply('رد على صورة واكتب .sticker')
}

const stream = await downloadContentFromMessage(
quoted.imageMessage,
'image'
)

let buffer = Buffer.from([])

for await (const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])
}

const input = path.join(__dirname, 'input.jpg')
const output = path.join(__dirname, 'output.webp')

fs.writeFileSync(input, buffer)

await new Promise((resolve, reject) => {
ffmpeg(input)
.outputOptions([
'-vcodec', 'libwebp',
'-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
'-lossless', '1',
'-compression_level', '6',
'-q:v', '80'
])
.save(output)
.on('end', resolve)
.on('error', reject)
})

await sock.sendMessage(from, {
sticker: fs.readFileSync(output)
}, { quoted: m })

fs.unlinkSync(input)
fs.unlinkSync(output)
}

// ===== رد تلقائي =====

if (text === 'السلام عليكم') {
reply('وعليكم السلام ورحمة الله 🌸')
}

if (text === 'هلا') {
reply('ياهلا والله 🔥')
}

} catch (e) {
console.log(e)
}
})
}

startBot()
