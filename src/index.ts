import { ChatGPTAPI } from "chatgpt";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import JSONdb from "simple-json-db";
import { Telegraf } from "telegraf";
//import JSONdb from "simple-json-db";
import { dynamicImport } from "tsimportlib";
import { message } from "telegraf/filters";


const db = new JSONdb("./storage.json");
// const queue = new Queue("chatgpt");
dotenv.config();

// let bot: Telegraf;
let bot: Telegraf;
let api: ChatGPTAPI;

init();
async function init() {
  const chatGPT = (await dynamicImport(
    "chatgpt",
    module
  )) as typeof import("chatgpt");
  api = new chatGPT.ChatGPTAPI({
    apiKey: process.env.OPENAI_KEY,
  });

  bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
    handlerTimeout: 900_000,
  });
  bot.start((ctx) => ctx.reply("Send me a YouTube Video Link"));
  bot.help((ctx) => ctx.reply("Send me a YouTube Video Link"));

  bot.on(message("text"), async (ctx) => {
    const chatText = ctx.message.text;
    const chatId = ctx.message.chat.id;
    if (chatText.startsWith("/")) {
      let splitText = chatText.split(" ", 1);
      if (chatText == "/newchat") {
        db.delete(chatId.toString());
        await ctx.reply("Your old chat has been deleted.");
      }
      if (chatText == "/start") {
        const text =
          "Hello, This bot gives you AI-powered answers using ChatGPT. \nAvailable commands are:\n\n/newchat - Start a new chat";
        await ctx.reply(text);
      }
    } else {
      await ctx.sendChatAction("typing");
      const message = await ctx.sendMessage("typing..");
      console.log("message", message);
      handleMessage(message, ctx);
    }
  });
  bot.hears("hi", (ctx) => ctx.reply("Hi Ho"));
  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

async function handleMessage(message, ctx) {
  const chatId = message.chat.id;
  const chatText = message.text;
  const messageId = message.message_id;
  let textMessage = '';

  const chatInfo = db.has(chatId.toString()) ? db.get(chatId.toString()) : {};
  const chatSettings = {
    conversationId: chatInfo.conversationId ?? undefined,
    parentMessageId: chatInfo.lastMessage ?? undefined,
    onProgress: (progress) => {
      // console.log(progress);
      // console.log('message', message);
      const newMessage = progress.text.replace(/\n/g, "");
      if (newMessage != textMessage) {
        if (textMessage == "") {
          textMessage = "typing...";
        }
        textMessage = newMessage;
        ctx.telegram.editMessageText(chatId, messageId, undefined, textMessage);
      }
      
      
    },
  };

  const result = await api.sendMessage(chatText, chatSettings);
  console.log("result", result);

  db.set(chatId.toString(), {
    conversationId: result.conversationId,
    lastMessage: result.parentMessageId,
  });
  await Promise.all([
    ctx.telegram.deleteMessage(message.chat.id, message.message_id),
    ctx.reply(result.text),
  ]);
}
