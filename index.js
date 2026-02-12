const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

/**
 * Dynamically finds the FFmpeg binary path.
 * @returns {string} The path to FFmpeg or "ffmpeg" as fallback.
 */
function getFfmpegPath() {
  try {
    const command =
      process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const result = execSync(command, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    // In case 'where' returns multiple lines, take the first one
    return result.split("\r\n")[0].split("\n")[0] || "ffmpeg";
  } catch (e) {
    return "ffmpeg";
  }
}

const ffmpegPath = getFfmpegPath();
console.log(`🎬 FFmpeg path: ${ffmpegPath}`);

const YtDlpWrap = require("yt-dlp-wrap").default;
const binary = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpDir = path.join(process.cwd(), "yt-dlp");
const ytDlpPath = path.join(ytDlpDir, binary);
const cookiesPath = path.join(ytDlpDir, "cookies.txt");

const ytdlp = new YtDlpWrap(ytDlpPath);

// ============================
//       FOLDERS
// ============================
const mediaDir = path.join(__dirname, "media");
const videoDir = path.join(mediaDir, "videos");
const audioDir = path.join(mediaDir, "audio");
const metadataDir = path.join(mediaDir, "metadata");
[videoDir, audioDir, metadataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================
//          UTILS
// ============================

// Function to download the latest yt-dlp binary from GitHub
async function downloadYtDlp(retries = 2) {
  console.log("🔄 Fetching latest yt-dlp release info...");

  const apiUrl = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
  let response;
  try {
    response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
  } catch (err) {
    throw new Error(
      `Failed to fetch latest release: ${err.message}. Try manual download from https://github.com/yt-dlp/yt-dlp/releases/latest`,
    );
  }

  const { tag_name } = response.data;
  const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${tag_name}/${binaryName}`;

  console.log(`📥 Downloading yt-dlp ${tag_name} from ${downloadUrl}...`);

  fs.mkdirSync(ytDlpDir, { recursive: true });

  try {
    const fileResponse = await axios({
      method: "get",
      url: downloadUrl,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: "application/octet-stream",
      },
    });

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(ytDlpPath);
      fileResponse.data.pipe(file);

      file.on("finish", () => {
        file.close(() => {
          if (process.platform !== "win32") {
            fs.chmodSync(ytDlpPath, 0o755);
          }
          console.log(`✅ yt-dlp ${tag_name} downloaded successfully!`);
          resolve();
        });
      });

      file.on("error", reject);
    });
  } catch (err) {
    if (retries > 0) {
      console.log(`🔄 Retry ${3 - retries}/2...`);
      return downloadYtDlp(retries - 1);
    }
    throw new Error(
      `Download failed after retries: ${err.message}. Try manual download from ${downloadUrl}`,
    );
  }
}

// Create yt-dlp folder if it doesn't exist
if (!fs.existsSync(ytDlpDir)) {
  fs.mkdirSync(ytDlpDir, { recursive: true });
}

// Download yt-dlp if binary is missing
async function ensureYtDlp() {
  if (!fs.existsSync(ytDlpPath)) {
    console.warn(
      `yt-dlp binary not found at ${ytDlpPath}. Downloading the latest version...`,
    );
    try {
      await downloadYtDlp();
    } catch (err) {
      console.error("Failed to download yt-dlp:", err.message);
      process.exit(1);
    }
  }
  if (process.platform !== "win32") {
    fs.chmodSync(ytDlpPath, 0o755);
  }
}

// Sanitize filename
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").substring(0, 100);
}

// Hash video ID
function hashVideoId(videoId) {
  return crypto.createHash("md5").update(videoId).digest("hex").substring(0, 8);
}

// ============================
//           YT-SEARCH
// ============================
async function searchYouTube(query) {
  await ensureYtDlp();
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await axios.get(url, {
    timeout: 5000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const match = response.data.match(/var ytInitialData = (\{.*?\});/s);
  if (!match) return [];

  const ytData = JSON.parse(match[1]);
  const items =
    ytData.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

  const results = [];
  for (const item of items) {
    if (item.videoRenderer) {
      const video = item.videoRenderer;
      results.push({
        title: video.title.runs[0].text,
        author: video.ownerText.runs[0].text,
        thumbnail: video.thumbnail.thumbnails.slice(-1)[0].url,
        videoId: video.videoId,
        duration: video.lengthText?.simpleText || "LIVE",
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
      });
    }
  }
  return results;
}

// ============================
//           DOWNLOAD
// ============================
async function downloadMedia(videoUrl, videoId, title, options = {}) {
  await ensureYtDlp();
  const { type = "video", quality = "1080p" } = options;
  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const outputDir = type === "audio" ? audioDir : videoDir;
  const extension = type === "audio" ? "mp3" : "mp4";
  const outputFile = path.join(outputDir, `${hash}-${safeTitle}.${extension}`);
  const metadataFile = path.join(metadataDir, `${hash}-${safeTitle}.json`);

  if (fs.existsSync(outputFile)) {
    return {
      file: outputFile,
      metadata: fs.existsSync(metadataFile)
        ? JSON.parse(fs.readFileSync(metadataFile))
        : {},
    };
  }

  const format =
    type === "audio"
      ? "bestaudio/best"
      : `bestvideo[height<=${quality.replace("p", "")}]+bestaudio/best`;
  const args = [
    videoUrl,
    "-f",
    format,
    "-o",
    outputFile,
    "--no-playlist",
    "--write-info-json",
    "--quiet",
  ];

  if (type === "audio")
    args.push(
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--ffmpeg-location",
      ffmpegPath,
    );
  else args.push("--merge-output-format", "mp4", "--remux-video", "mp4");

  if (fs.existsSync(cookiesPath)) args.push("--cookies", cookiesPath);

  return new Promise((resolve, reject) => {
    ytdlp
      .exec(args)
      .on("error", reject)
      .on("close", (code) => {
        if (code !== 0)
          return reject(new Error(`YT-DLP exited with code ${code}`));

        const jsonPath = outputFile.replace(/\.(mp3|mp4)$/, ".info.json");
        let metadata = {};
        if (fs.existsSync(jsonPath)) {
          metadata = JSON.parse(fs.readFileSync(jsonPath));
          fs.renameSync(jsonPath, metadataFile);
        }
        resolve({ file: outputFile, metadata });
      });
  });
}

// ============================
//       BATCH DOWNLOAD
// ============================
async function batchDownloadMedia(query, options = {}) {
  const { maxVideos = 10 } = options;
  const videos = await searchYouTube(query);
  if (!videos.length) return [];

  const results = [];
  for (const video of videos.slice(0, maxVideos)) {
    try {
      const res = await downloadMedia(
        video.url,
        video.videoId,
        video.title,
        options,
      );
      results.push(res);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`Failed: ${video.title} -> ${err.message}`);
    }
  }
  return results;
}

// ============================
//           REMOVE
// ============================
function removeMedia(videoId, title, type = "video") {
  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const outputDir = type === "audio" ? audioDir : videoDir;
  const extension = type === "audio" ? "mp3" : "mp4";
  const filePath = path.join(outputDir, `${hash}-${safeTitle}.${extension}`);
  const metadataFile = path.join(metadataDir, `${hash}-${safeTitle}.json`);
  [filePath, metadataFile].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
  return true;
}

function removeAllMedia(type = "all") {
  if (type === "all" || type === "video") {
    fs.rmSync(videoDir, { recursive: true, force: true });
    fs.mkdirSync(videoDir, { recursive: true });
  }
  if (type === "all" || type === "audio") {
    fs.rmSync(audioDir, { recursive: true, force: true });
    fs.mkdirSync(audioDir, { recursive: true });
  }
  fs.rmSync(metadataDir, { recursive: true, force: true });
  fs.mkdirSync(metadataDir, { recursive: true });
}

// ============================
//           QUEUE
// ============================
const queues = new Map();

function addToQueue(guildId, videoUrl, videoId, title, options = {}) {
  if (!queues.has(guildId))
    queues.set(guildId, { queue: [], isProcessing: false });
  const queueData = queues.get(guildId);
  return new Promise((resolve, reject) => {
    queueData.queue.push({
      videoUrl,
      videoId,
      title,
      options,
      resolve,
      reject,
    });
    processQueue(guildId);
  });
}

async function processQueue(guildId) {
  const queueData = queues.get(guildId);
  if (!queueData || queueData.isProcessing || queueData.queue.length === 0)
    return;

  queueData.isProcessing = true;
  const { videoUrl, videoId, title, options, resolve, reject } =
    queueData.queue.shift();

  try {
    const result = await downloadMedia(videoUrl, videoId, title, options);
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
    queues.get(guildId)?.queue.map((i) => ({
      videoId: i.videoId,
      title: i.title,
      type: i.options.type || "video",
      quality: i.options.quality || "1080p",
    })) || []
  );
}

function clearQueue(guildId) {
  if (!queues.has(guildId)) return false;
  queues.get(guildId).queue = [];
  return true;
}

// ============================
//           EXPORTS
// ============================
module.exports = {
  searchYouTube,
  downloadMedia,
  batchDownloadMedia,
  removeMedia,
  removeAllMedia,
  addToQueue,
  getQueue,
  clearQueue,
};
