import "materialize-css/dist/css/materialize.min.css";
import "materialize-css/dist/js/materialize.min";
import spotifyWebApi from "spotify-web-api-js";
import { EventEmitter } from "events";

const BASE_URL = "https://api.spotycontrol.nirah.tech";
const main = document.querySelector("main");
const overlay = document.getElementById("overlay");

const handleLoginClick = () => {
	window.open(
		BASE_URL +
			"/connect?address=" +
			encodeURI(chrome?.extension?.getURL("/") || "http://localhost:8080")
	);
};

const trackEvent = new EventEmitter();

trackEvent.on("initialData", (data) => {
	generateSpotifyPage(data);
});

trackEvent.on("updateTrack", (data) => {
	updateSpotify(data);
});

const updateSpotify = async (currentlyPlaying) => {
	showOverlay();
	if (currentlyPlaying) {
		const albumImage = document.querySelector("img.albumImage");
		if (albumImage.src !== currentlyPlaying.item.album.images[0].url)
			albumImage.src = currentlyPlaying.item.album.images[0].url;

		const trackTitle = document.querySelector(".trackTitle");
		if (trackTitle.innerText !== currentlyPlaying.item.name)
			trackTitle.innerText = currentlyPlaying.item.name;

		const trackArtist = document.querySelector(".trackArtist");
		if (trackArtist.innerText !== currentlyPlaying.item.artists[0].name)
			trackArtist.innerText = currentlyPlaying.item.artists[0].name;

		const playPause = document.getElementById("playPause");
		playPause.src =
			currentlyPlaying.is_playing === true
				? "icons/controllers/button-pause.svg"
				: "icons/controllers/button-play.svg";

		const volumeButton = document.getElementById("volumeButton");
		volumeButton.src =
			currentlyPlaying.device.volume_percent === 0
				? "icons/controllers/volume-mute.svg"
				: "icons/controllers/sound.svg";

		const repeatButton = document.getElementById("repeatButton");
		switch (currentlyPlaying.repeat_state) {
			case "off":
				repeatButton.src = "icons/controllers/ic_repeat_48px.svg";
				break;
			case "track":
				repeatButton.src = "icons/controllers/ic_repeat_track.svg";
				break;
			case "context":
				repeatButton.src = "icons/controllers/ic_repeat_context.svg";
				break;
		}

		hideOverlay();
	} else {
		hideOverlay();
		displayWaitingTrack();
	}
};

const displayWaitingTrack = () => {
	main.innerHTML = "";
	const waitingContainer = document.createElement("div");
	waitingContainer.classList.add("waitingContainer");
	const waitingSpinner = document.createElement("div");
	waitingSpinner.innerHTML =
		'<div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
	const waitingText = document.createElement("h6");
	waitingText.innerText = "It doesn't look like you're playing music";
	const reloadButton = document.createElement("button");
	reloadButton.classList.add(
		"waves-effect",
		"waves-light",
		"btn",
		"reloadButton"
	);
	reloadButton.innerText = "Reload";
	reloadButton.onclick = generateSpotifyPage;
	waitingContainer.appendChild(waitingSpinner);
	waitingContainer.appendChild(waitingText);
	waitingContainer.appendChild(reloadButton);
	main.appendChild(waitingContainer);
};

const generateLoginPage = () => {
	const root = document.createElement("div");
	root.classList.add("container", "loginContainer");

	const welcomeContainer = document.createElement("div");
	const welcomeText = document.createElement("h6");
	welcomeText.innerText = "You do not appear to be logged in to Spotify";
	welcomeContainer.appendChild(welcomeText);

	const loginContainer = document.createElement("div");
	const loginButton = document.createElement("button");
	loginButton.classList.add("waves-effect", "waves-light", "btn");
	loginButton.innerText = "Sign in";
	loginButton.onclick = handleLoginClick;
	loginContainer.appendChild(loginButton);

	root.appendChild(welcomeContainer);
	root.appendChild(loginContainer);
	main.innerHTML = "";
	main.appendChild(root);
};

const generateSpotifyPage = async (currentlyPlaying) => {
	const container = document.createElement("div");
	container.classList.add("currentlyPlayingContainer");
	main.innerHTML = "";
	showOverlay();
	if (currentlyPlaying) {
		const imgContainer = document.createElement("div");
		imgContainer.classList.add("albumContainer");
		const albumImage = document.createElement("img");
		const reloadIcon = document.createElement("img");

		albumImage.classList.add("albumImage");
		albumImage.src = currentlyPlaying.item.album.images[0].url;

		reloadIcon.src = "icons/reload.svg";
		reloadIcon.classList.add("reload");

		reloadIcon.onclick = async () => {
			await updateSpotify();
		};
		imgContainer.appendChild(albumImage);
		imgContainer.appendChild(reloadIcon);
		const textContainer = document.createElement("div");
		textContainer.classList.add("textContainer");
		const trackTitle = document.createElement("h3");
		trackTitle.classList.add("trackTitle");
		trackTitle.innerText = `${currentlyPlaying.item.name}`;

		const trackArtist = document.createElement("h4");
		trackArtist.classList.add("trackArtist");
		trackArtist.innerText = `${currentlyPlaying.item.artists[0].name}`;

		const controllerContainer = document.createElement("div");
		controllerContainer.classList.add("controllerContainer");
		const playPauseButton = document.createElement("img");
		playPauseButton.src =
			currentlyPlaying.is_playing === true
				? "icons/controllers/button-pause.svg"
				: "icons/controllers/button-play.svg";
		playPauseButton.classList.add("tooltipped", "playPause");
		playPauseButton.id = "playPause";
		playPauseButton.setAttribute("data-position", "top");
		playPauseButton.setAttribute("data-tooltip", "Pause/Resume playback");
		playPauseButton.onclick = async () => {
			showOverlay();
			chrome.runtime.sendMessage({ type: "play_pause" });
		};

		const prevButton = document.createElement("img");
		prevButton.src = "icons/controllers/button-rewind.svg";
		prevButton.classList.add("controller", "tooltipped");
		prevButton.setAttribute("data-position", "top");
		prevButton.setAttribute("data-tooltip", "Previous track");
		prevButton.onclick = async () => {
			showOverlay();
			chrome.runtime.sendMessage({ type: "skip_prev" });
		};

		const nextButton = document.createElement("img");
		nextButton.src = "icons/controllers/button-skip.svg";
		nextButton.classList.add("controller", "tooltipped");
		nextButton.setAttribute("data-position", "top");
		nextButton.setAttribute("data-tooltip", "Next track");
		nextButton.onclick = async () => {
			showOverlay();
			chrome.runtime.sendMessage({ type: "skip_next" });
		};

		const repeatButton = document.createElement("img");
		repeatButton.id = "repeatButton";
		repeatButton.classList.add("controller", "tooltipped");
		repeatButton.setAttribute("data-position", "top");
		repeatButton.setAttribute(
			"data-tooltip",
			"Set repeat mode (off, track or context)"
		);
		switch (currentlyPlaying.repeat_state) {
			case "off":
				repeatButton.src = "icons/controllers/ic_repeat_48px.svg";
				break;
			case "track":
				repeatButton.src = "icons/controllers/ic_repeat_track.svg";
				break;
			case "context":
				repeatButton.src = "icons/controllers/ic_repeat_context.svg";
				break;
		}
		repeatButton.onclick = async () => {
			showOverlay();
			chrome.runtime.sendMessage({ type: "change_repeat" });
		};

		const volumeButton = document.createElement("img");
		volumeButton.id = "volumeButton";
		volumeButton.src =
			currentlyPlaying.device.volume_percent === 0
				? "icons/controllers/volume-mute.svg"
				: "icons/controllers/sound.svg";
		volumeButton.classList.add("controller", "tooltipped");
		volumeButton.setAttribute("data-position", "top");
		volumeButton.setAttribute("data-tooltip", "Mute/Unmute player");
		volumeButton.onclick = async () => {
			showOverlay();
			chrome.runtime.sendMessage({ type: "volume_change" });
		};
		controllerContainer.appendChild(repeatButton);
		controllerContainer.appendChild(prevButton);
		controllerContainer.appendChild(playPauseButton);
		controllerContainer.appendChild(nextButton);
		controllerContainer.appendChild(volumeButton);
		container.appendChild(imgContainer);
		textContainer.appendChild(trackTitle);
		textContainer.appendChild(trackArtist);
		container.appendChild(textContainer);
		container.appendChild(controllerContainer);
		main.appendChild(container);
		const tooltipped = document.querySelectorAll(".tooltipped");
		M.Tooltip.init(tooltipped);
		hideOverlay();
	} else {
		hideOverlay();
		displayWaitingTrack();
	}
};
const showOverlay = () => {
	overlay.style.display = "block";
	overlay.style.opacity = 1;
};

const hideOverlay = () => {
	overlay.style.opacity = 0;
	overlay.style.display = "none";
};

const token = localStorage.getItem("spotify-access");
const refresh = localStorage.getItem("spotify-refresh");
if (!token || !refresh) {
	generateLoginPage();
	window.addEventListener("storage", (ev) => {
		console.log(`${ev.key} has changed`);
		if (!ev.newValue) return;
		if (ev.key === "spotify-access") {
			if (localStorage.getItem("spotify-refresh")) generateSpotifyPage();
		} else if (ev.key === "spotify-refresh") {
			if (localStorage.getItem("spotify-access")) generateSpotifyPage();
		}
	});
} else {
	chrome.runtime.sendMessage({ type: "get_data" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	switch (msg.type) {
		case "initialData":
			trackEvent.emit("initialData", msg.data);
			break;
		case "updateTrack":
			trackEvent.emit("updateTrack", msg.data);
			break;
		case "errorMessage":
			M.toast({ html: `Error: ${msg.value}` });
			hideOverlay();
			break;
		default:
			break;
	}
	console.log(msg);
});
