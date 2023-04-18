// bot.ts
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { Input, Telegraf } from "telegraf";
import { promisify } from "util";
import { Configuration, OpenAIApi } from "openai";
import axios from "axios";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from 'uuid';

ffmpeg.setFfmpegPath(ffmpegPath);
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

interface UserData {
  language: string | null;
  apiKey: string | null;
  email: string | null;
}

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const userDataFilePath = "userData.json";

const token = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(token);

let userDataMap: Map<number, UserData> = new Map();

bot.start((ctx) =>
  ctx.reply(
    "Welcome! Please set your language using /setlanguage <language> and API key using /setapikey <apikey>."
  )
);

bot.command("setlanguage", async (ctx) => {
  const userId = ctx.from?.id;
  const language = ctx.message?.text?.split(" ")[1];

  if (!userId || !language) {
    ctx.reply("Please provide a valid language.");
    return;
  }

  const userData = userDataMap.get(userId) || {
    language: null,
    apiKey: null,
    email: null,
  };
  userData.language = language;
  userDataMap.set(userId, userData);
  await saveUserData(userDataMap);

  ctx.reply(`Language set to: ${language}`);
});

bot.command("setapikey", async (ctx) => {
  const userId = ctx.from?.id;
  const apiKey = ctx.message?.text?.split(" ")[1];

  if (!userId || !apiKey) {
    ctx.reply("Please provide a valid API key.");
    return;
  }

  const userData = userDataMap.get(userId) || {
    language: null,
    apiKey: null,
    email: null,
  };
  userData.apiKey = apiKey;
  userDataMap.set(userId, userData);
  await saveUserData(userDataMap);

  ctx.reply("API key saved successfully.");
});

bot.command("setemail", async (ctx) => {
  const userId = ctx.from?.id;
  const emailText = ctx.message?.text?.split(" ")[1];

  if (!userId || !emailText) {
    ctx.reply("Please provide a valid email.");
    return;
  }

  // Simple email validation
  const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
  if (!emailRegex.test(emailText)) {
    ctx.reply("Please provide a valid email address.");
    return;
  }

  const userData = userDataMap.get(userId) || {
    language: null,
    apiKey: null,
    email: null,
  };
  userData.email = emailText;
  userDataMap.set(userId, userData);
  await saveUserData(userDataMap);

  ctx.reply(`Email set to: ${emailText}`);
});

bot.on("text", async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId) {
    ctx.reply("Error: User ID not found.");
    return;
  }

  const userData = userDataMap.get(userId);

  // if (!userData || !userData.language || !userData.apiKey) {
  //   ctx.reply("Please set your language and API key first.");
  //   return;
  // }

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 4000,
    messages: [{role: "user", content: ctx.message?.text}],
  });

  const answer = completion.data.choices[0].message?.content;

  if(answer) {
    ctx.reply(answer);
    const audioFile = await microsoftTts(answer);
    await ctx.replyWithVoice(Input.fromBuffer(audioFile));
  } else {
    ctx.reply("Error: Unable to generate a response.");
  }
});

bot.on("voice", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.reply("Error: User ID not found.");
    return;
  }

  const userData = userDataMap.get(userId);
  // if (!userData || !userData.apiKey) {
  // //   ctx.reply("Please set your API key first.");
  //   return;
  // }

  const fileId = ctx.message?.voice?.file_id;
  if (!fileId) {
    ctx.reply("Error: Voice message file ID not found.");
    return;
  }

  await ctx.sendChatAction("typing");
  const url = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
  const transcription = await transcribeVoiceMessage(url.href, userData.apiKey);
  if (!transcription) {
    ctx.reply("Error: Unable to transcribe your voice message.");
    return;
  }
  console.log('Transcription: ', transcription);
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    max_tokens: 4000,
    messages: [{role: "user", content: transcription}],
  });

  const answer = completion.data.choices[0].message?.content;

  if(answer) {
    ctx.reply(answer);
    const audioFile = await microsoftTts(answer);
    await ctx.replyWithVoice(Input.fromBuffer(audioFile));
  } else {
    ctx.reply("Error: Unable to generate a response.");
  }
});

(async () => {
  userDataMap = await loadUserData();
  bot.launch();
  bot.catch(() => {
    bot.stop();
    bot.launch();
  });
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
})();

async function loadUserData(): Promise<Map<number, UserData>> {
  try {
    const fileContent = await readFileAsync(userDataFilePath, "utf-8");
    const userDataObject = JSON.parse(fileContent);
    const userDataMap = new Map<number, UserData>();

    for (const [key, value] of Object.entries(userDataObject)) {
      userDataMap.set(Number(key), value as UserData);
    }

    return userDataMap;
  } catch (error) {
    console.error("Error reading user data file:", error);
    return new Map();
  }
}

async function saveUserData(userDataMap: Map<number, UserData>): Promise<void> {
  try {
    const userData = JSON.stringify(Object.fromEntries(userDataMap));
    await writeFileAsync(userDataFilePath, userData, "utf-8");
  } catch (error) {
    console.error("Error saving user data file:", error);
  }
}

async function transcribeVoiceMessage(
  url: string,
  apiKey: string
): Promise<string | null> {
  try {
    console.log("url", url);
    const uuid = uuidv4();
    const response: any = await axios.get(url, { responseType: "arraybuffer" });
    await writeFileAsync(`${uuid}.ogg`, response.data);
    await convertAudio(uuid);
    const data: any = await openai.createTranscription(
      fs.createReadStream(`${uuid}.mp3`) as any,
      "whisper-1"
    );
    unlinkAsync(`${uuid}.ogg`);
    unlinkAsync(`${uuid}.mp3`);
    return data?.data?.text;
  } catch (error) {
    console.error("Error transcribing voice message:", error);
    return null;
  }
}


async function convertAudio(uuid) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${uuid}.ogg`)
      .audioQuality(96)
      .toFormat("mp3")
      .on("error", (error) => console.log(`Encoding Error: ${error.message}`))
      .on("exit", () => console.log("Audio recorder exited"))
      .on("close", () => console.log("Audio recorder closed"))
      .on("end", async () => {
        console.log("Audio Transcoding succeeded!");
        resolve(true);
      })
      .save(`${uuid}.mp3`)
  }
  )
}

async function microsoftTts(query: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.SPEECH_KEY,
      process.env.SPEECH_REGION
    );
    speechConfig.speechSynthesisVoiceName = "de-DE-ChristophNeural";
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    let ssml = `<speak version='1.0' xml:lang='en-US' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts'><voice name='de-DE-ChristophNeural'>`;
    ssml += `<prosody rate="1.2">${query}</prosody>`;
    ssml += `</voice></speak>`;
    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          synthesizer.close();
          resolve(Buffer.from(result.audioData));
        } else {
          reject(result.errorDetails);
        }
      },
      (err) => {
        synthesizer.close();
        reject(err);
      }
    );
  });
}