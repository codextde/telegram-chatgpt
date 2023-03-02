import * as dotenv from "dotenv";
import JSONdb from "simple-json-db";
import { Telegraf } from "telegraf";
import axios from "axios";
import { message } from "telegraf/filters";

const db = new JSONdb("./storage.json");
dotenv.config();
let bot: Telegraf;

init();
async function init() {
  bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
    handlerTimeout: 900_000,
  });
  bot.start((ctx) => ctx.reply("Send me a message"));
  bot.help((ctx) => ctx.reply("Send me a message"));

  bot.on(message("text"), async (ctx) => {
    const chatText = ctx.message.text;
    const chatId = ctx.message.chat.id;
    if (chatText.startsWith("/")) {
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
      const message = await ctx.sendMessage("typing...");
      handleMessage(message, ctx);
    }
  });
  bot.hears("hi", (ctx) => ctx.reply("Hi Ho"));
  bot.launch();

  bot.catch(() => {
    bot.stop();
    bot.launch();
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

async function handleMessage(message, ctx) {
  const chatId = message.chat.id;
  const chatText = ctx.message.text;

  try {
    const chatInfo = db.has(chatId.toString()) ? db.get(chatId.toString()) : {};
    console.log("chatText", chatText);
    const result = await askQuestion(
      chatText,
      chatInfo.parentMessageId,
      chatInfo.conversationId
    );
    console.log("result", result);

    db.set(chatId.toString(), {
      conversationId: result.conversationId,
      parentMessageId: result.parentMessageId,
    });
    await Promise.all([
      ctx.telegram.deleteMessage(message.chat.id, message.message_id),
      ctx.reply(result.text),
    ]);
  } catch (error) {
    ctx.reply("Error");
  }
}

async function askQuestion(
  text: string,
  parentMessageId?: string,
  conversationId?: string
) {
  try {
    const response: any = await axios.post(
      `${process.env.CHATGPT_API}/message?authKey=${process.env.AUTH_KEY}`,
      {
        text,
        parentMessageId,
        conversationId,
      }
    );
    return response.data;
  } catch (error) {
    console.log("error", error);
  }
}