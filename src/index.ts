import { ChatGPTAPI } from "chatgpt";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import JSONdb from "simple-json-db";
import { Telegraf } from "telegraf";
//import JSONdb from "simple-json-db";
import { dynamicImport } from "tsimportlib";
import { message } from "telegraf/filters";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
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
    bot.telegram.sendChatAction(ctx.chat.id, "typing");
    handleMessage(ctx);
  });
  bot.hears("hi", (ctx) => ctx.reply("Hi Ho"));
  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}


async function handleMessage(ctx) {
  const chatId = ctx.message.chat.id;
    const chatText = ctx.message.text;

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
    }


    try {
      const chatInfo = db.has(chatId.toString())
        ? db.get(chatId.toString())
        : {};
      const chatSettings = {
        conversationId: chatInfo.conversationId ?? undefined,
        parentMessageId: chatInfo.lastMessage ?? undefined,
      };

      const oraPromise = (await dynamicImport(
        "ora",
        module
      )) as typeof import("ora");

      let result: any = await oraPromise.oraPromise(
        api.sendMessage(chatText, chatSettings),
        {
          text: "Processing Message: " + chatText,
        }
      );
      console.log(result);

      db.set(chatId.toString(), {
        conversationId: result.conversationId,
        lastMessage: result.parentMessageId,
      });
      await ctx.reply(result.text)
      return Promise.resolve();
    } catch (e) {
      throw new Error("Error");
    }
}