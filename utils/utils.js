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
            videoConversion.on('close', (c) => {
                if(c === 0) {
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
