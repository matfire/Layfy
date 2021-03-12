import { EventEmitter } from "events";
import ColorThief from "colorthief";
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const playButton = document.getElementById("playButton");
const repeatButton = document.getElementById("repeatButton");
const volumeButton = document.getElementById("volumeButton");
const reloadButton = document.getElementById("reloadButton");
const shuffleButton = document.getElementById("shuffleButton");
const likeButton = document.getElementById("likeButton");
const r = document.querySelector(":root");
import tinycolor from "tinycolor2";

const snackbar = document.getElementById("snackbar");

const albumCover = document.getElementById("albumCover");
const trackTitle = document.querySelector(".trackTitle");
const trackArtist = document.querySelector(".trackArtist");
const overlay = document.getElementById("overlay");
const waiting = document.getElementById("waiting");
const trackEvent = new EventEmitter();
const colorThief = new ColorThief();

const rgbToHex = (r, g, b) =>
	"#" +
	[r, g, b]
		.map((x) => {
			const hex = x.toString(16);
			return hex.length === 1 ? "0" + hex : hex;
		})
		.join("");

prevButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "skip_prev" });
};
nextButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "skip_next" });
};
playButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "play_pause" });
};
repeatButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "change_repeat" });
};
volumeButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "volume_change" });
};

reloadButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "update_data" });
};
shuffleButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "shuffle_change" });
};
likeButton.onclick = () => {
	showOverlay();
	chrome.runtime.sendMessage({ type: "like_song" });
};

/**
 *
 * @param {SpotifyApi.CurrentPlaybackResponse} song
 */
const isLiked = (song) => {
	chrome.runtime.sendMessage({ type: "check_liked", id: song.item.id });
};

const showOverlay = () => {
	overlay.style.display = "flex";
	overlay.style.opacity = 1;
};

const hideOverlay = () => {
	overlay.style.display = "none";
	overlay.style.opacity = 0;
};

const showWaiting = () => {
	hideOverlay();
	waiting.style.display = "flex";
};

const hideWaiting = () => {
	waiting.style.display = "none";
};

/**
 *
 * @param {SpotifyApi.CurrentPlaybackResponse} currentlyPlaying
 */
const updateSpotify = async (currentlyPlaying) => {
	if (currentlyPlaying) {
		isLiked(currentlyPlaying);
		if (albumCover.src !== currentlyPlaying.item.album.images[0].url)
			albumCover.src = currentlyPlaying.item.album.images[0].url;

		if (trackTitle.innerText !== currentlyPlaying.item.name)
			trackTitle.innerText = currentlyPlaying.item.name;

		if (trackArtist.innerText !== currentlyPlaying.item.artists[0].name)
			trackArtist.innerText = currentlyPlaying.item.artists[0].name;

		playButton.src =
			currentlyPlaying.is_playing === true
				? "/icons/controllers/button-pause.svg"
				: "/icons/controllers/button-play.svg";

		volumeButton.src =
			currentlyPlaying.device.volume_percent === 0
				? "/icons/controllers/volume-mute.svg"
				: "/icons/controllers/sound.svg";

		switch (currentlyPlaying.repeat_state) {
			case "off":
				repeatButton.src = "/icons/controllers/ic_repeat_48px.svg";
				break;
			case "track":
				repeatButton.src = "/icons/controllers/ic_repeat_track.svg";
				break;
			case "context":
				repeatButton.src = "/icons/controllers/ic_repeat_context.svg";
				break;
		}
		shuffleButton.src = currentlyPlaying.shuffle_state
			? "/icons/controllers/shuffle-on.svg"
			: "/icons/controllers/shuffle-off.svg";
		hideOverlay();

		if (albumCover.complete) {
			const color = await colorThief.getColor(albumCover);
			const hexColor = rgbToHex(...color);
			const tc = new tinycolor(hexColor);
			console.log("color is " + color);
			console.log(tc.complement().toHexString());

			r.style.setProperty("--backgroundColor", hexColor);
			r.style.setProperty(
				"--textColor",
				tinycolor
					.mostReadable(tc, tinycolor.names, {
						includeFallbackColors: true,
					})
					?.toHexString() || "black"
			);
		} else {
			albumCover.addEventListener("load", async () => {
				const color = await colorThief.getColor(albumCover);
				const hexColor = rgbToHex(...color);
				const tc = new tinycolor(hexColor);
				console.log("color is " + color);
				console.log(tc.complement().toHexString());
				r.style.setProperty("--backgroundColor", hexColor);
				r.style.setProperty(
					"--textColor",
					tinycolor
						.mostReadable(tc, tinycolor.names, {
							includeFallbackColors: true,
						})
						?.toHexString() || "black"
				);
			});
		}
	} else {
		showWaiting();
	}
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	switch (msg.type) {
		case "initialData":
			hideWaiting();
			trackEvent.emit("updateTrack", msg.data);
			break;
		case "updateTrack":
			hideWaiting();
			trackEvent.emit("updateTrack", msg.data);
			break;
		case "liked_song_value":
			trackEvent.emit("liked_song_value", msg.saved);
			break;
		case "errorMessage":
			document.getElementById("snackbar-text").innerText = `${msg.value}`;
			snackbar.style.display = "flex";
			hideOverlay();
			snackbar.classList.add("show");
			setTimeout(() => {
				snackbar.classList.remove("show");
				snackbar.style.display = "none";
			}, 3000);
			break;
		case "close_window":
			window.close();
			break;
		case "display_waiting":
			showWaiting();
			break;
		default:
			break;
	}
	console.log(msg);
});

trackEvent.on("updateTrack", (data) => {
	updateSpotify(data);
});

trackEvent.on("liked_song_value", (value) => {
	likeButton.src = value
		? "/icons/controllers/heart-2.svg"
		: "/icons/controllers/heart.svg";
});

showOverlay();
chrome.runtime.sendMessage({ type: "get_data" });
