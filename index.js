const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const YtDlpWrap = require("yt-dlp-wrap").default;
const binary = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpDir = path.join(process.cwd(), "yt-dlp");
const ytDlpPath = path.join(process.cwd(), "yt-dlp", binary);
const cookiesPath = path.join(process.cwd(), "yt-dlp", "cookies.txt");

const ytdlp = new YtDlpWrap(ytDlpPath);

const musicDir = path.join(__dirname, "music");
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);

// ============================
//          UTILS
// ============================

// Function to download the latest yt-dlp binary from GitHub
async function downloadYtDlp() {
  const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/" + (process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

  console.log(`Downloading yt-dlp from ${url}...`);

  fs.mkdirSync(ytDlpDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(ytDlpPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status code: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            if (process.platform !== "win32") {
              fs.chmodSync(ytDlpPath, 0o755); // make executable on Linux/macOS
            }
            console.log("yt-dlp downloaded successfully!");
            resolve();
          });
        });
      })
      .on("error", reject);
  });
}

// Create yt-dlp folder if it doesn't exist
if (!fs.existsSync(ytDlpDir)) {
  fs.mkdirSync(ytDlpDir, { recursive: true });
}

// Download yt-dlp if binary is missing
if (!fs.existsSync(ytDlpPath)) {
  console.warn(`yt-dlp binary not found at ${ytDlpPath}. Downloading the latest version...`);
  (async () => {
    try {
      await downloadYtDlp();
    } catch (err) {
      console.error("Failed to download yt-dlp:", err.message);
      process.exit(1);
    }
  })();
}

// Sanitize filename for saving
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").substring(0, 100);
}

// Create short hash for video ID
function hashVideoId(videoId) {
  return crypto.createHash("md5").update(videoId).digest("hex").substring(0, 8);
}

// ============================
//           YT-SEARCH
// ============================

async function searchYouTube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  let response;

  try {
    response = await axios.get(url, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
  } catch (err) {
    throw new Error(`Failed to fetch YouTube search results: ${err.message}`);
  }

  const html = response.data;
  const match = html.match(/var ytInitialData = (\{.*?\});/s);
  if (!match) throw new Error("No ytInitialData found");

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
  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const outputFile = path.join(musicDir, `${hash}-${safeTitle}.mp3`);

  if (fs.existsSync(outputFile)) {
    return outputFile;
  }

  async function runYtdlp(useCookies) {
    const args = [videoUrl, "-f", "bestaudio", "-o", outputFile, "--no-playlist", "--quiet"];
    if (useCookies) args.push("--cookies", cookiesPath);

    return new Promise((resolve, reject) => {
      ytdlp
        .exec(args)
        .on("error", (err) => {
          console.error(`YT-DLP Error: ${err.message}`);
          reject(err);
        })
        .on("close", (code) => {
          if (code !== 0) return reject(new Error(`YT-DLP exited with code ${code}`));
          resolve();
        });
    });
  }

  const cookiesExist = fs.existsSync(cookiesPath);

  try {
    await runYtdlp(cookiesExist);
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (
      !cookiesExist &&
      (msg.includes("sign in to confirm") || msg.includes("use --cookies") || msg.includes("cookie") || msg.includes("authentication"))
    ) {
      throw new Error(
        `Cookies are required to download this audio.\n` +
          `Please install a browser extension like "Get cookies.txt",\n` +
          `export your YouTube cookies as cookies.txt, and place it at:\n` +
          `${cookiesPath}`
      );
    } else {
      throw err;
    }
  }

  return outputFile;
}

// ============================
//           REMOVE
// ============================

function removeSong(videoId, title) {
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
  if (fs.existsSync(musicDir)) fs.rmSync(musicDir, { recursive: true, force: true });
}

// ============================
//           QUEUE
// ============================

const queues = new Map();

function addToQueue(guildId, videoUrl, videoId, title) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { queue: [], isProcessing: false });
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
  return queues.get(guildId)?.queue.map((item) => ({ videoId: item.videoId, title: item.title })) || [];
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
