const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const YtDlpWrap = require("yt-dlp-wrap").default;
const binary = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpPath = path.join(__dirname, "yt-dlp", binary);
const ytdlp = new YtDlpWrap(ytDlpPath);

// ============================
//          UTILS
// ============================

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").substring(0, 100);
}

function hashVideoId(videoId) {
  return crypto.createHash("md5").update(videoId).digest("hex").substring(0, 8);
}

// ============================
//          YT-SEARCH
// ============================

async function searchYouTube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await axios.get(url);
  const html = response.data;

  const match = html.match(/var ytInitialData = (\{.*?\});/s);
  if (!match) throw new Error("No ytInitialData");

  const ytData = JSON.parse(match[1]);
  const videoItems =
    ytData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

  for (const item of videoItems) {
    if (item.videoRenderer) {
      const video = item.videoRenderer;
      return {
        title: video.title.runs[0].text,
        author: video.ownerText.runs[0].text,
        thumbnail: video.thumbnail.thumbnails.slice(-1)[0].url,
        videoId: video.videoId,
        duration: video.lengthText?.simpleText || "LIVE",
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
      };
    }
  }

  throw new Error("No video found");
}

// ============================
//           DOWNLOAD
// ============================

async function downloadAudio(videoUrl, videoId, title) {
  const musicDir = path.join(__dirname, "music");
  if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);

  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const outputFile = path.join(musicDir, `${hash}-${safeTitle}.mp3`);

  if (fs.existsSync(outputFile)) {
    return outputFile;
  }

  await new Promise((resolve, reject) => {
    ytdlp.exec([videoUrl, "-f", "bestaudio", "-o", outputFile, "--no-playlist", "--quiet"]).on("error", reject).on("close", resolve);
  });

  return outputFile;
}

// ============================
//           REMOVING
// ============================

function removeSong(videoId, title) {
  const musicDir = path.join(__dirname, "music");
  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const filePath = path.join(musicDir, `${hash}-${safeTitle}.mp3`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  } else {
    return false;
  }
}

function removeAllSongs() {
  const musicDir = path.join(__dirname, "music");
  if (fs.existsSync(musicDir)) fs.rmSync(musicDir, { recursive: true, force: true });
}

// ============================
//           QUEUING
// ============================

const queues = new Map();

function addToQueue(guildId, videoUrl, videoId, title) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      queue: [],
      isProcessing: false,
    });
  }

  const queueData = queues.get(guildId);

  return new Promise((resolve, reject) => {
    queueData.queue.push({ videoUrl, videoId, title, resolve, reject });
    processQueue(guildId);
  });
}

async function processQueue(guildId) {
  const queueData = queues.get(guildId);
  if (!queueData || queueData.isProcessing || queueData.queue.length === 0) return;

  queueData.isProcessing = true;
  const { videoUrl, videoId, title, resolve, reject } = queueData.queue.shift();

  try {
    const result = await downloadAudio(videoUrl, videoId, title);
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    queueData.isProcessing = false;
    processQueue(guildId);
  }
}

function getQueue(guildId) {
  return (
    queues.get(guildId)?.queue.map((item) => ({
      videoId: item.videoId,
      title: item.title,
    })) || []
  );
}

function clearQueue(guildId) {
  if (queues.has(guildId)) {
    queues.get(guildId).queue = [];
    return true;
  }
  return false;
}

// ============================
//           EXPORTS
// ============================

module.exports = {
  searchYouTube,
  downloadAudio,
  removeSong,
  removeAllSongs,
  addToQueue,
  getQueue,
  clearQueue,
};
