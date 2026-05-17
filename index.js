import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys"

import P from "pino"
import { Boom } from "@hapi/boom"

const number = "972527066516"

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    browser: ["Jo Yaboki", "Chrome", "1.0.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : 0) !== DisconnectReason.loggedOut

      console.log("connection closed")

      if (shouldReconnect) {
        startBot()
      }
    } else if (connection === "open") {
      console.log("BOT CONNECTED")
    }
  })

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(number)
        console.log(`PAIR CODE: ${code}`)
      } catch (err) {
        console.log("PAIR ERROR:", err)
      }
    }, 5000)
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]

    if (!msg.message || msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    const from = msg.key.remoteJid

    if (text.toLowerCase() === "ping") {
      await sock.sendMessage(from, {
        text: "pong 🐐"
      })
    }

    if (text.toLowerCase() === "بوت") {
      await sock.sendMessage(from, {
        text: "هلا انا بوت جو يابوكي 🔥"
      })
    }
  })
}

startBot()
