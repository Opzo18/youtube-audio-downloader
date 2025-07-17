# youtube-audio-downloader

A lightweight utility library for searching and downloading YouTube audio using [`yt-dlp`](https://github.com/yt-dlp/yt-dlp). Includes built-in file caching, queue handling per guild (ideal for bots), and support for cleaning downloaded tracks.

---

## 📦 Installation

```bash
npm install youtube-audio-downloader
```

### ⚠️ yt-dlp binary required

You must place the `yt-dlp` binary in a `yt-dlp/` folder inside your project root:

- **Windows**: [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)
- **Linux/macOS**: [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp)

Directory structure:

```
your-project/
├── yt-dlp/
│   └── yt-dlp or yt-dlp.exe
```

---

## 🔍 `searchYouTube(query)`

Searches YouTube and returns the first video result.

```js
const { searchYouTube } = require("youtube-audio-downloader");

const result = await searchYouTube("Never Gonna Give You Up");
console.log(result);
/*
{
  title: "Rick Astley - Never Gonna Give You Up (Video)",
  author: "Rick Astley",
  thumbnail: "https://...",
  videoId: "dQw4w9WgXcQ",
  duration: "3:33",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
*/
```

---

## 🎵 `downloadAudio(videoUrl, videoId, title)`

Downloads the audio (MP3) of a YouTube video to the `music/` directory. Returns the path to the downloaded file.

```js
const { downloadAudio } = require("youtube-audio-downloader");

const path = await downloadAudio("https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "Never Gonna Give You Up");
console.log("File saved at:", path);
```

---

## 🧹 File Management

### `removeSong(videoId, title)`

Deletes a specific downloaded song.

```js
const { removeSong } = require("youtube-audio-downloader");

removeSong("dQw4w9WgXcQ", "Never Gonna Give You Up");
```

---

### `removeAllSongs()`

Deletes the entire `music/` folder and all downloaded songs.

```js
const { removeAllSongs } = require("youtube-audio-downloader");

removeAllSongs();
```

---

## 📁 Queue Management (per guild/server)

### `addToQueue(guildId, videoUrl, videoId, title)`

Adds a song to a download queue for the given `guildId`. Automatically starts downloading in sequence.

```js
const { addToQueue } = require("youtube-audio-downloader");

addToQueue("guild123", videoUrl, videoId, title).then((filePath) => {
  console.log("Downloaded:", filePath);
});
```

---

### `getQueue(guildId)`

Returns the current pending songs in the queue for a given guild.

```js
const { getQueue } = require("youtube-audio-downloader");

console.log(getQueue("guild123"));
```

---

### `clearQueue(guildId)`

Clears the queue for the given guild/server.

```js
const { clearQueue } = require("youtube-audio-downloader");

clearQueue("guild123");
```

---

## 🧾 File Structure

```
your-project/
├── yt-dlp/
│   └── yt-dlp (or yt-dlp.exe)
├── music/
│   └── <downloaded audio files>
```

---

## ✅ Requirements

- Node.js v14 or higher
- yt-dlp binary in `yt-dlp/` folder

---

## 📝 License

MIT
