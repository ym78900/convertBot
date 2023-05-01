const { exec: execution, spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const fs = require("fs");

const convertFile = async (fileName, chatId, subtitleTrackId, audioTrackId, bot) => {
    // Convert MKV to MP4 with selected tracks

    console.log(subtitleTrackId, audioTrackId, fileName)

    bot.sendMessage(chatId, 'converting...');
    // ffmpeg.setFfmpegPath(ffmpegPath);
    // extract the selected subtitle track
    const subtitleProcess = spawn(ffmpegPath, [
        '-i', `./${fileName}`,
        '-map', `0:${subtitleTrackId}`,
        `./${fileName}.srt`
    ]);

    subtitleProcess.on('close', (code) => {
        if(code === 0) {
            const videoConversion = spawn(ffmpegPath, [
                '-i', `./${fileName}`,
                '-map', '0:0',
                '-map', `0:${audioTrackId}`,
                '-vf', `subtitles=./${fileName}.srt:si=0`,
                '-c:v', 'libx264',
                '-c:a', 'copy',
                `./${fileName}.mp4`, // if you don't want to stream the data while converting, use this
            ]);

            // Get the video duration
            let videoDurationInSeconds = null;
            videoConversion.stderr.on('data', (data) => {
                const str = data.toString();
                const match = str.match(/Duration:\s*([\d:.]+)/);
                if (match) {
                    const timeString = match[1];
                    videoDurationInSeconds = convertTimeStringToSeconds(timeString);
                }
            });

            // Update progress percentage
            videoConversion.stderr.on('data', (data) => {
                const str = data.toString();
                const match = str.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (match && videoDurationInSeconds) {
                    const hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const seconds = parseInt(match[3], 10);
                    const currentTimeInSeconds = (hours * 60 * 60) + (minutes * 60) + seconds;
                    const percentage = Math.floor((currentTimeInSeconds / videoDurationInSeconds) * 100);
                    // bot.sendMessage(chatId, `File conversion progress: ${percentage}%`);
                    updateProgress(chatId, percentage, bot)
                }
            });

            videoConversion.on('close', (c) => {
                if(c === 0) {
                    bot.editMessageText('Sending video...', {chat_id: chatId, message_id: progressMessageId} );
                    bot.sendVideo(chatId, `./${fileName}.mp4`).then(() => {
                        deleteFile(`./${fileName}`);
                        deleteFile(`./${fileName}.mp4`);
                        deleteFile(`./${fileName}.srt`);
                    })
                }
            })
        }
    })

}

let progressMessageId; // variable to store the ID of the progress message
const updateProgress = (chatId, percentage, bot) => {
    const message = `File conversion progress: ${percentage}`;
    console.log(progressMessageId)
    if (progressMessageId) {
        // if progress message already sent, update it
        bot.editMessageText(message, { chat_id: chatId, message_id: progressMessageId }).then((editedMessage) => {
            console.log(editedMessage.text)
        });
    } else {
        // if progress message not sent, send new message and store the message ID
        bot.sendMessage(chatId, message, { parse_mode: 'HTML' }).then((sentMessage) => {
            progressMessageId = sentMessage.message_id;
        });
    }
};

const convertTimeStringToSeconds = (timeString) => {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2], 10);
    return (hours * 60 * 60) + (minutes * 60) + seconds;
}

const deleteFile = (filePath) => {
    // delete the file after sending it
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`File deleted successfully`);
    });
}

// Function to extract available audio and subtitle tracks
async function extractTracks(file) {
    let audioTracks = [];
    let subtitleTracks = [];
    console.log(file)
    const result =  await execPromise(`mkvmerge -i ${file}`)
    const tracks = result.match(/(Track ID \d+: (audio|subtitles) \(.*?\))/g);
    if (tracks.length > 0) {
        tracks.forEach((track, index) => {
            if(track.includes('audio')) {
                audioTracks.push({track, trackId: index + 1})
            }
            else if(track.includes('subtitles')) {
                subtitleTracks.push({track, trackId: index + 1})
            }
        });
    } else {
        console.log('No audio or subtitle tracks found.');
    }
    console.log(audioTracks, subtitleTracks);
    return {audioTracks, subtitleTracks}
}

const sendAudioSelection = async (chatId, audioTracks, bot) => {
    const options = {
        reply_markup: {
            inline_keyboard: audioTracks.map((track) => [
                {
                    text: `${track.trackId}`,
                    callback_data: `${track.trackId}`,
                },
            ]),
        },
    };
    bot.sendMessage(chatId, 'Please select an audio track:', options);
    return new Promise(resolve => {
        bot.on('callback_query', async (query) => {
            if (query.message.chat.id === chatId) {
                // process the user's response
                const response = query.data;

                // resolve the promise with the user's response
                resolve(response);
            }
        });
    });
}

const sendSubtitleSelection = async (chatId, subtitleTracks, bot) => {
    const options = {
        reply_markup: {
            inline_keyboard: subtitleTracks.map((track) => [
                {
                    text: `${track.trackId}`,
                    callback_data: `${track.trackId}`,
                },
            ]),
        },
    };
    bot.sendMessage(chatId, 'Please select a subtitle track:', options);
    return new Promise(resolve => {
        bot.on('callback_query', async (query) => {
            if (query.message.chat.id === chatId) {
                // process the user's response
                const response = query.data;

                // resolve the promise with the user's response
                resolve(response);
            }
        });
    });
}

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

module.exports = {convertFile, extractTracks, sendAudioSelection, sendSubtitleSelection}
