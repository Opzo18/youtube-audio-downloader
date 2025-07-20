# simple-audio-downloader

A lightweight utility library for searching and downloading YouTube audio using [`yt-dlp`](https://github.com/yt-dlp/yt-dlp). Includes built-in file caching, queue handling per guild (ideal for bots), and support for cleaning downloaded tracks.

---

## 📦 Installation

```bash
npm install simple-audio-downloader
```

---

## ⚠️ yt-dlp binary required

This package requires the [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) binary.

You must **download the yt-dlp binary** and place it in a folder called `yt-dlp` at the **root of your project** (not inside `node_modules`).

### Windows

[Download yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe)

### Linux/macOS

[Download yt-dlp](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp)

**Project structure:**

```
your-project/
├── yt-dlp/
│   └── yt-dlp or yt-dlp.exe
├── index.js
```

If the binary is not found, an error will be thrown with instructions.

---

## :cookie: YouTube Cookies (For age-restricted or login-required videos)

Some videos on YouTube (e.g., age-restricted or private content) require authentication to download. To support these, you must provide a valid `cookies.txt` file from your browser session.

### How to get cookies:

1. Install the browser extension **[Get cookies.txt](https://chrome.google.com/webstore/detail/get-cookiestxt/ieogpggnfcgoinimjfkfalnmchhbbdkk)** or similar.
2. Visit **youtube.com** while logged into your account.
3. Click the extension and choose `Export cookies for this domain`.
4. Save the file as `cookies.txt`.

### Where to place it:

Place `cookies.txt` in the **root of your project**:

```
your-project/
├── yt-dlp/
│   ├── yt-dlp or yt-dlp.exe
│   └── cookies.txt

```

If a video requires authentication and no cookies are found, an error will be thrown with instructions.

---

## 🔍 `searchYouTube(query)`

Searches YouTube and returns the first video result.

```js
const { searchYouTube } = require("simple-audio-downloader");

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
const { downloadAudio } = require("simple-audio-downloader");

const path = await downloadAudio("https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "Never Gonna Give You Up");
console.log("File saved at:", path);
```

---

## 🧹 File Management

### `removeSong(videoId, title)`

Deletes a specific downloaded song.

```js
const { removeSong } = require("simple-audio-downloader");

removeSong("dQw4w9WgXcQ", "Never Gonna Give You Up");
```

### `removeAllSongs()`

Deletes the entire `music/` folder and all downloaded songs.

```js
const { removeAllSongs } = require("simple-audio-downloader");

removeAllSongs();
```

---

## 📁 Queue Management (per guild/server)

### `addToQueue(guildId, videoUrl, videoId, title)`

Adds a song to a download queue for the given `guildId`. Automatically starts downloading in sequence.

```js
const { addToQueue } = require("simple-audio-downloader");

addToQueue("guild123", videoUrl, videoId, title).then((filePath) => {
  console.log("Downloaded:", filePath);
});
```

### `getQueue(guildId)`

Returns the current pending songs in the queue for a given guild.

```js
const { getQueue } = require("simple-audio-downloader");

console.log(getQueue("guild123"));
```

### `clearQueue(guildId)`

Clears the queue for the given guild/server.

```js
const { clearQueue } = require("simple-audio-downloader");

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
- yt-dlp binary in `yt-dlp/` folder (outside node_modules)

---

## 📝 License

MIT
