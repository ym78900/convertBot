const {
  convertFile,
  sendSubtitleSelection,
  sendAudioSelection,
  extractTracks,
  downloadFile,
} = require("./utils/utils");
// const AWS = require("aws-sdk");

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// AWS.config.update({
//   accessKeyId: process.env.ACCESS_KEY_ID,
//   secretAccessKey: process.env.SECRET_ACCESS_KEY,
//   region: process.env.REGION,
// });
//
// const s3 = new AWS.S3();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  try {
    if (msg.document && msg.document.mime_type === "video/x-matroska") {
      const chatId = msg.chat.id;
      const fileName = msg.document.file_name;
      const fileInfo = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
      // Download the file using axios
      await downloadFile(fileUrl, fileName);
      // Get the  available subtitle and audio tracks for the file
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
