const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const ffmpegPath = require("ffmpeg-static");

const YtDlpWrap = require("yt-dlp-wrap").default;
const binary = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpDir = path.join(process.cwd(), "yt-dlp");
const ytDlpPath = path.join(process.cwd(), "yt-dlp", binary);
const cookiesPath = path.join(process.cwd(), "yt-dlp", "cookies.txt");

const ytdlp = new YtDlpWrap(ytDlpPath);

// Separate folders for audio and video
const mediaDir = path.join(__dirname, "media");
const videoDir = path.join(mediaDir, "videos");
const audioDir = path.join(mediaDir, "audio");
const metadataDir = path.join(mediaDir, "metadata");
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });

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
    throw new Error(`Failed to fetch latest release: ${err.message}. Try manual download from https://github.com/yt-dlp/yt-dlp/releases/latest`);
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
    throw new Error(`Download failed after retries: ${err.message}. Try manual download from ${downloadUrl}`);
  }
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

  const results = [];
  for (const item of videoItems) {
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

  return results.length > 0 ? results : [];
}

// ============================
//           DOWNLOAD
// ============================

async function downloadMedia(videoUrl, videoId, title, options = {}) {
  const { type = "video", quality = "1080p", retries = 2 } = options;
  const safeTitle = sanitizeFilename(title);
  const hash = hashVideoId(videoId);
  const outputDir = type === "audio" ? audioDir : videoDir;
  const extension = type === "audio" ? "mp3" : "mp4";
  const outputFile = path.join(outputDir, `${hash}-${safeTitle}.${extension}`);
  const metadataFile = path.join(metadataDir, `${hash}-${safeTitle}.json`);

  if (fs.existsSync(outputFile)) {
    console.log(`File already exists: ${outputFile}`);
    return { file: outputFile, metadata: fs.existsSync(metadataFile) ? JSON.parse(fs.readFileSync(metadataFile)) : {} };
  }

  async function runYtdlp(useCookies, attempt = 1) {
    let format = type === "audio" ? "bestaudio/best" : `bestvideo[height<=${quality.replace("p", "")}]+bestaudio/best`;

    const args = [videoUrl, "-f", format, "-o", outputFile, "--no-playlist", "--write-info-json", "--quiet"];

    if (type === "audio") {
      args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "0", "--ffmpeg-location", ffmpegPath);
    } else {
      args.push("--merge-output-format", "mp4", "--remux-video", "mp4");
    }

    if (useCookies) args.push("--cookies", cookiesPath);

    return new Promise((resolve, reject) => {
      ytdlp
        .exec(args)
        .on("error", reject)
        .on("close", (code) => {
          if (code !== 0) return reject(new Error(`YT-DLP exited with code ${code}`));
          const jsonPath = outputFile.replace(/\.(mp3|mp4)$/, ".info.json");
          const metadata = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath)) : {};
          if (fs.existsSync(jsonPath)) fs.renameSync(jsonPath, metadataFile);
          resolve({ file: outputFile, metadata });
        });
    });
  }

  const cookiesExist = fs.existsSync(cookiesPath);

  try {
    const result = await runYtdlp(cookiesExist);
    return result;
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (
      !cookiesExist &&
      (msg.includes("sign in to confirm") || msg.includes("use --cookies") || msg.includes("cookie") || msg.includes("authentication"))
    ) {
      throw new Error(
        `Cookies are required to download this media.\n` +
          `Please install a browser extension like "Get cookies.txt",\n` +
          `export your YouTube cookies as cookies.txt, and place it at:\n` +
          `${cookiesPath}`
      );
    } else {
      throw err;
    }
  }
}

// Batch download multiple videos from a search query
async function batchDownloadMedia(query, options = {}) {
  const { maxVideos = 10, type = "video", quality = "1080p" } = options;
  const videos = await searchYouTube(query);
  if (!videos.length) throw new Error(`No videos found for query: ${query}`);

  const results = [];
  for (const video of videos.slice(0, maxVideos)) {
    try {
      const result = await downloadMedia(video.url, video.videoId, video.title, { type, quality });
      results.push(result);
    } catch (err) {
      console.error(`Failed to download ${video.title}: ${err.message}`);
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

  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  if (fs.existsSync(metadataFile)) {
    fs.unlinkSync(metadataFile);
  }
  return deleted;
}

function removeAllMedia(type = "all") {
  if (type === "all" || type === "video") {
    if (fs.existsSync(videoDir)) fs.rmSync(videoDir, { recursive: true, force: true });
    fs.mkdirSync(videoDir, { recursive: true });
  }
  if (type === "all" || type === "audio") {
    if (fs.existsSync(audioDir)) fs.rmSync(audioDir, { recursive: true, force: true });
    fs.mkdirSync(audioDir, { recursive: true });
  }
  if (fs.existsSync(metadataDir)) fs.rmSync(metadataDir, { recursive: true, force: true });
  fs.mkdirSync(metadataDir, { recursive: true });
}

// ============================
//           QUEUE
// ============================

const queues = new Map();

function addToQueue(guildId, videoUrl, videoId, title, options = {}) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { queue: [], isProcessing: false });
  }

  const queueData = queues.get(guildId);
  return new Promise((resolve, reject) => {
    queueData.queue.push({ videoUrl, videoId, title, options, resolve, reject });
    processQueue(guildId);
  });
}

async function processQueue(guildId) {
  const queueData = queues.get(guildId);
  if (!queueData || queueData.isProcessing || queueData.queue.length === 0) return;

  queueData.isProcessing = true;
  const { videoUrl, videoId, title, options, resolve, reject } = queueData.queue.shift();

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
    queues.get(guildId)?.queue.map((item) => ({
      videoId: item.videoId,
      title: item.title,
      type: item.options.type || "video",
      quality: item.options.quality || "1080p",
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
  downloadMedia,
  batchDownloadMedia,
  removeMedia,
  removeAllMedia,
  addToQueue,
  getQueue,
  clearQueue,
};
