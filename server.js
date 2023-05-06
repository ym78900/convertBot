const {
  convertFile,
  sendSubtitleSelection,
  sendAudioSelection,
  extractTracks,
} = require("./utils/utils");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  try {
    if (msg.document && msg.document.mime_type === "video/x-matroska") {
      const chatId = msg.chat.id;
      const fileName = msg.document.file_name;
      const fileInfo = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
      // Download the file using axios
      const response = await axios({
        method: "GET",
        url: fileUrl,
        responseType: "stream",
      });
      // Save the file to disk
      response.data.pipe(fs.createWriteStream(`${fileName}`));

      // Get the available subtitle and audio tracks for the file
      const { audioTracks, subtitleTracks } = await extractTracks(
        `./${fileName}`
      );
      const selectedSubtitleId = await sendSubtitleSelection(
        chatId,
        subtitleTracks,
        bot
      );
      const selectedAudioId = await sendAudioSelection(
        chatId,
        audioTracks,
        bot
      );

      convertFile(fileName, chatId, selectedSubtitleId, selectedAudioId, bot);
    }
  } catch (e) {
    console.log("show me error", e);
  }
});
