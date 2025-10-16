# 🎥 simple-audio-downloader 🐱

A super lightweight Node.js library to search and download **YouTube audio and video** using [`yt-dlp`](https://github.com/yt-dlp/yt-dlp). Perfect for grabbing **funny animal clips** or meme-worthy tracks for your next YouTube montage! 🌟 Features include audio (MP3) and video (MP4) downloads, customizable quality (480p, 720p, 1080p), batch downloading for queries like "funny cat fails," Creative Commons filtering for YouTube-safe content, metadata storage, and queue handling for bots. All free, all local, no hassle! 🚀

---

## 📦 Installation

Get started in a snap:

```bash
npm install simple-audio-downloader
```

---

## ⚙️ yt-dlp Binary Setup

This package uses the awesome [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) binary to do the heavy lifting.

**Step 1**: Download the binary and place it in a `yt-dlp/` folder at your project’s root (not in `node_modules`).

- **Windows**: [Grab yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)
- **Linux/macOS**: [Grab yt-dlp](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp)

**Project structure**:

```
your-project/
├── yt-dlp/
│   └── yt-dlp or yt-dlp.exe
├── index.js
```

**No binary? No problem!** The package auto-downloads it if missing. 😎

---

## 🍪 YouTube Cookies (Optional)

Some videos (age-restricted or private) need a `cookies.txt` file for access.

### How to get cookies:

1. Install the **[Get cookies.txt](https://chromewebstore.google.com/detail/cclelndahbckbenkjhflpdbgdldlbecc?utm_source=item-share-cb)** browser extension.
2. Log into **youtube.com**.
3. Export cookies for the domain using the extension.
4. Save as `cookies.txt` in your `yt-dlp/` folder:

```
your-project/
├── yt-dlp/
│   ├── yt-dlp or yt-dlp.exe
│   └── cookies.txt
```

If a video needs cookies and they’re missing, you’ll get a clear error with instructions. 🛠️

---

## 🔍 `searchYouTube(query)`

Search YouTube for videos like "funny animal fails" and get a list of results with titles, authors, and more.

```js
const { searchYouTube } = require("simple-audio-downloader");

const results = await searchYouTube("funny cat fails");
console.log(results);
/*
[
  {
    title: "Funny Cat Fails Compilation",
    author: "PetLovers",
    thumbnail: "https://...",
    videoId: "abc123",
    duration: "3:45",
    url: "https://www.youtube.com/watch?v=abc123"
  },
  ...
]
*/
```

---

## 🎬 `downloadMedia(videoUrl, videoId, title, options)`

Download audio (MP3) or video (MP4) to `media/audio/` or `media/videos/`. Saves metadata (title, tags, duration) to `media/metadata/`. Perfect for snagging that viral cat clip! 🐾

**Options**:

- `type`: `"audio"` or `"video"` (default: `"video"`)
- `quality`: For video: `"480p"`, `"720p"`, `"1080p"` (default: `"720p"`); for audio: ignored (best MP3)
- `retries`: Retry attempts for network issues (default: 2)

```js
const { downloadMedia } = require("simple-audio-downloader");

const result = await downloadMedia("https://youtube.com/watch?v=abc123", "abc123", "Funny Cat Fails Compilation", { type: "video", quality: "720p" });
console.log("Saved:", result.file, "Metadata:", result.metadata);
```

**Pro Tip**: Downloads prioritize Creative Commons-licensed videos to keep your YouTube montages safe! ✅

---

## 📚 `batchDownloadMedia(query, options)`

Download multiple videos from a single search query (e.g., "funny dog zoomies"). Ideal for batch-grabbing clips for your next montage! 🎉

**Options**:

- `maxVideos`: Max videos to download (default: 10)
- `type`: `"audio"` or `"video"` (default: `"video"`)
- `quality`: `"480p"`, `"720p"`, `"1080p"` (default: `"720p"`)

```js
const { batchDownloadMedia } = require("simple-audio-downloader");

const results = await batchDownloadMedia("funny animal fails", { maxVideos: 5, type: "video", quality: "720p" });
console.log("Downloaded:", results);
```

---

## 🧹 File Cleanup

### `removeMedia(videoId, title, type)`

Delete a specific audio or video file and its metadata.

```js
const { removeMedia } = require("simple-audio-downloader");

removeMedia("abc123", "Funny Cat Fails Compilation", "video");
```

### `removeAllMedia(type)`

Wipe all files in `"audio"`, `"video"`, or `"all"` directories.

```js
const { removeAllMedia } = require("simple-audio-downloader");

removeAllMedia("video"); // Clears media/videos/ and media/metadata/
```

---

## 📋 Queue Management (Bot-Friendly)

### `addToQueue(guildId, videoUrl, videoId, title, options)`

Add a download to a guild’s queue. Downloads process one-by-one, perfect for bot servers.

```js
const { addToQueue } = require("simple-audio-downloader");

addToQueue("guild123", videoUrl, videoId, title, { type: "video", quality: "720p" }).then((result) => {
  console.log("Downloaded:", result.file, result.metadata);
});
```

### `getQueue(guildId)`

Check pending downloads for a guild.

```js
const { getQueue } = require("simple-audio-downloader");

console.log(getQueue("guild123"));
/*
[
  { videoId: "abc123", title: "Funny Cat Fails Compilation", type: "video", quality: "720p" },
  ...
]
*/
```

### `clearQueue(guildId)`

Clear a guild’s download queue.

```js
const { clearQueue } = require("simple-audio-downloader");

clearQueue("guild123");
```

---

## 📂 File Structure

Your downloads and metadata are neatly organized:

```
your-project/
├── yt-dlp/
│   ├── yt-dlp or yt-dlp.exe
│   └── cookies.txt (optional)
├── media/
│   ├── audio/
│   │   └── <MP3 files>
│   ├── videos/
│   │   └── <MP4 files>
│   ├── metadata/
│   │   └── <JSON metadata files>
├── index.js
```

---

## 🛠️ Requirements

- Node.js v14 or higher
- `yt-dlp` binary in `yt-dlp/` folder (auto-downloads if missing)
- Optional: `cookies.txt` for restricted content

---

## 📜 License

MIT - Free to use, remix, and share! 😺

---

**Made for creators who love funny animal montages and chill coding vibes!** 🐶🎶
