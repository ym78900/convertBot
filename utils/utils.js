const { exec: execution, spawn } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs");
const axios = require("axios");

const convertFile = async (
  fileName,
  chatId,
  subtitleTrackId,
  audioTrackId,
  bot
) => {
  // Convert MKV to MP4 with selected tracks
  bot.sendMessage(chatId, "converting...");
  // ffmpeg.setFfmpegPath(ffmpegPath);
  // extract the selected subtitle track
  spawn(ffmpegPath, [
    "-i",
    `./${fileName}`,
    "-map",
    `0:${subtitleTrackId}`,
    `./${fileName}.srt`,
  ]);

  const conversion = spawn(ffmpegPath, [
    "-i",
    `./${fileName}`,
    "-map",
    "0:0",
    "-map",
    `0:${audioTrackId}`,
    "-vf",
    `subtitles=./${fileName}.srt:si=0`,
    "-c:v",
    "libx264",
    "-c:a",
    "copy",
    `./${fileName}.mp4`, // if you don't want to stream the data while converting, use this
  ]);

  conversion.on("close", (c) => {
    console.log("show me", c);
    bot.sendVideo(chatId, `./${fileName}.mp4`).then(() => {
      deleteFile(`./${fileName}`);
      deleteFile(`./${fileName}.mp4`);
      deleteFile(`./${fileName}.srt`);
    });
  });
};

const deleteFile = (filePath) => {
  // delete the file after sending it
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`File deleted successfully`);
  });
};

// Function to extract available audio and subtitle tracks
async function extractTracks(file) {
  const command = `mkvmerge --identification-format json --identify ${file}`;
  const result = await execPromise(command);
  // Process the output to extract track IDs and languages
  const allTracks = JSON.parse(result).tracks;
  const subtitleTracks = allTracks
    .filter((tr) => tr.type === "subtitles")
    .map((item) => ({
      trackId: item.id,
      language: item.properties.language,
      name: item.properties.track_name,
    }));
  const audioTracks = allTracks
    .filter((tr) => tr.type === "audio")
    .map((item) => ({ trackId: item.id, language: item.properties.language }));

  return { audioTracks, subtitleTracks };
}

const sendAudioSelection = async (chatId, audioTracks, bot) => {
  const options = {
    reply_markup: {
      inline_keyboard: audioTracks.map((track) => [
        {
          text: `${track.language} ${track.name || ""}`,
          callback_data: `${track.trackId}`,
        },
      ]),
    },
  };
  bot.sendMessage(chatId, "Please select an audio track:", options);
  return new Promise((resolve) => {
    bot.on("callback_query", async (query) => {
      if (query.message.chat.id === chatId) {
        // process the user's response
        const response = query.data;

        // resolve the promise with the user's response
        resolve(response);
      }
    });
  });
};

const sendSubtitleSelection = async (chatId, subtitleTracks, bot) => {
  const options = {
    reply_markup: {
      inline_keyboard: subtitleTracks.map((track) => [
        {
          text: `${track.language} ${track.name || ""}`,
          callback_data: `${track.trackId}`,
        },
      ]),
    },
  };
  bot.sendMessage(chatId, "Please select a subtitle track:", options);
  return new Promise((resolve) => {
    bot.on("callback_query", async (query) => {
      if (query.message.chat.id === chatId) {
        // process the user's response
        const response = query.data;

        // resolve the promise with the user's response
        resolve(response);
      }
    });
  });
};

function execPromise(command) {
  return new Promise((resolve, reject) => {
    execution(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

const downloadFile = async (fileUrl, fileName) => {
  try {
    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream",
    });
    // Save the file to disk
    response.data.pipe(fs.createWriteStream(`${fileName}`));
  } catch (error) {
    console.error("Error downloading file:", error);
    // Handle the error and notify your Telegram bot here
  }
};

const downloadFileAndUploadToS3 = async (
  fileUrl,
  fileName,
  chatId,
  bot,
  s3
) => {
  return new Promise(async (resolve, reject) => {
    let url = `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
    try {
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
      };
      // Get the URL of the file in S3
      await bot.sendMessage(chatId, "Downloading file ...");
      s3.headObject(params, async (err, data) => {
        if (err && err.code === "NotFound") {
          // Movie file does not exist, proceed with uploading
          // Upload the movie file to your S3 bucket
          const response = await axios({
            method: "GET",
            url: fileUrl,
            responseType: "stream",
          });
          const uploadParams = {
            Bucket: process.env.BUCKET_NAME,
            Key: fileName,
            Body: response.data, // Buffer or stream of the movie file
          };
          s3.upload(uploadParams, (err, data) => {
            if (err) {
              console.log("Error uploading file to S3:", err);
              url = null;
            } else {
              bot.sendMessage(chatId, "File uploaded successfully!");
              console.log("File uploaded successfully:", data.Location);
              url = data.Location;
            }
          });
        } else if (err) {
          // An error occurred while checking the object
          console.log("Error checking object:", err);
          url = null;
        } else {
          // Movie file already exists in the bucket
          bot.sendMessage(chatId, "File already exist in our storage!");
        }
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      // Handle the error and notify your Telegram bot here
    }
    resolve(url);
  });
};

module.exports = {
  convertFile,
  extractTracks,
  sendAudioSelection,
  sendSubtitleSelection,
  downloadFile,
};
