import spotifyWebApi from "spotify-web-api-js";

const BASE_URL = "https://api.spotycontrol.nirah.tech";
const spotyClient = new spotifyWebApi();
import * as qs from "qs";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const isLiked = async (id) => {
	await refreshTokens();

	const saved = await spotyClient.containsMySavedTracks([id]);
	return saved[0];
};

const refreshTokens = async () => {
	if (!localStorage.getItem("spotify-access")) return false;
	const res = await fetch(BASE_URL + "/refresh", {
		method: "POST",
		body: JSON.stringify({
			access: localStorage.getItem("spotify-access"),
			refresh: localStorage.getItem("spotify-refresh"),
		}),
		headers: {
			"Content-Type": "application/json",
		},
	});
	if (res.status < 400) {
		const newData = await res.json();
		if (!newData) {
			window.open(
				BASE_URL +
					"/connect?address=" +
					encodeURI(chrome.extension.getURL("/"))
			);
			return false;
		}
		spotyClient.setAccessToken(newData.access);
		localStorage.setItem("spotify-access", newData.access);
		return true;
	} else {
		window.open(
			BASE_URL +
				"/connect?address=" +
				encodeURI(chrome.extension.getURL("/"))
		);
		return false;
	}
};

const skip_next = async () => {
	await refreshTokens();
	const track = await spotyClient.getMyCurrentPlaybackState();
	try {
		await spotyClient.skipToNext();
		await sleep(500);
		return { type: "success", msg: "Skipped to next track" };
	} catch (error) {
		return { type: "fail", msg: "Could not skip track" };
	}
};

const skip_prev = async () => {
	await refreshTokens();
	try {
		await spotyClient.skipToPrevious();
		await sleep(500);
	} catch (error) {
		return { type: "fail", msg: "Could not skip track" };
	}
};

const playPause = async () => {
	await refreshTokens();
	const track = await spotyClient.getMyCurrentPlaybackState();
	if (!track) {
		return { type: "fail", msg: "could not resume playback" };
	} else {
		if (track.is_playing) {
			try {
				await spotyClient.pause();
			} catch (error) {}
			await sleep(500);
			const newTrack = await spotyClient.getMyCurrentPlaybackState();
			if (!newTrack || newTrack.is_playing) return playPause();
			else return { type: "success", msg: "Paused playback" };
		} else {
			try {
				await spotyClient.play();
			} catch (error) {}
			await sleep(500);
			const newTrack = await spotyClient.getMyCurrentPlaybackState();
			if (newTrack.is_playing === false) return playPause();
			else return { type: "success", msg: "Resumed playback" };
		}
	}
};

const changeRepeat = async () => {
	await refreshTokens();

	const track = await spotyClient.getMyCurrentPlaybackState();
	try {
		switch (track.repeat_state) {
			case "off":
				await spotyClient.setRepeat("track");
				return { type: "success", msg: "changed repeat to track" };
				break;
			case "context":
				await spotyClient.setRepeat("off");
				return { type: "success", msg: "changed repeat to off" };
				break;
			case "track":
				await spotyClient.setRepeat("context");
				return { type: "success", msg: "changed repeat to context" };
				break;
			default:
				break;
		}
	} catch (error) {
		return { type: "fail", msg: "could not change repeat setting" };
	}
};

const changeVolume = async () => {
	await refreshTokens();

	const track = await spotyClient.getMyCurrentPlaybackState();

	if (track.device.is_restricted)
		return { type: "fail", msg: "cannot modify this device" };

	if (track.device.volume_percent === 0) {
		const oldVolume = localStorage.getItem(`${track.device.id}-volume`);
		try {
			await spotyClient.setVolume(oldVolume || 100);
		} catch (error) {
			return { type: "fail", msg: "cannot set volume on this device" };
		}
		await sleep(500);
		const updatedTrack = await spotyClient.getMyCurrentPlaybackState();
		if (updatedTrack.device.volume_percent !== 0)
			return { type: "success", msg: "Unmuted device" };
		else return changeVolume();
	} else {
		localStorage.setItem(
			`${track.device.id}-volume`,
			track.device.volume_percent
		);
		try {
			await spotyClient.setVolume(0);
			await sleep(500);
			const updatedTrack = await spotyClient.getMyCurrentPlaybackState();
			if (updatedTrack.device.volume_percent === 0)
				return { type: "success", msg: "Muted device" };
			else return changeVolume();
		} catch (error) {
			return { type: "fail", msg: "cannot set volume on this device" };
		}
	}
};

const changeShuffle = async () => {
	await refreshTokens();

	const track = await spotyClient.getMyCurrentPlaybackState();

	await spotyClient.setShuffle(!track.shuffle_state);
	return { type: "success", msg: "changed repeat state" };
};

const likeSong = async (currentSong) => {
	await refreshTokens();

	const saved = await spotyClient.containsMySavedTracks([
		currentSong.item.id,
	]);
	if (saved[0] && saved[0] === true) {
		await spotyClient.removeFromMySavedTracks([currentSong.item.id]);
		await sleep(500);
		const updated = await spotyClient.containsMySavedTracks([
			currentSong.item.id,
		]);
		if (updated[0] === false)
			return { type: "success", msg: "removed from saved tracks" };
		else return likeSong(currentSong);
	} else {
		await spotyClient.addToMySavedTracks([currentSong.item.id]);
		await sleep(500);
		const updated = await spotyClient.containsMySavedTracks([
			currentSong.item.id,
		]);
		if (updated[0] === true)
			return { type: "success", msg: "added to saved tracks" };
		else return likeSong(currentSong);
	}
};

chrome.runtime.onInstalled.addListener((details) => {
	if (localStorage.getItem("spotify-access")) {
		spotyClient.setAccessToken(localStorage.getItem("spotify-access"));
		chrome.browserAction.setPopup({
			popup: "player/player.html",
		});
	}
	console.log("initializing context menus");
	chrome.contextMenus.create({
		title: "Search on Spotify",
		id: "laify_search",
		contexts: ["selection"],
	});
	console.log("init");
});

chrome.commands.onCommand.addListener(async (command) => {
	let res;
	switch (command) {
		case "toggle_play_pause":
			res = await playPause();
			chrome.notifications.create("playPause", {
				type: "basic",
				iconUrl: "icons/icons/128.png",
				title: "Toggle Playback",
				message: res.msg,
			});
			break;
		case "skip_to_next":
			res = await skip_next();
			chrome.notifications.create("next", {
				type: "basic",
				iconUrl: "icons/icons/128.png",
				title: "Skip to next",
				message: res.msg,
			});
			break;
		case "skip_to_prev":
			res = await skip_prev();
			chrome.notifications.create("prev", {
				type: "basic",
				iconUrl: "icons/icons/128.png",
				title: "Skip to previous",
				message: res.msg,
			});
	}
});

window.addEventListener("storage", (ev) => {
	console.log(ev);
	console.log(`${ev.key} has changed`);
	if (!ev.newValue) return;
	if (ev.key === "spotify-access") {
		if (ev.newValue) spotyClient.setAccessToken(ev.newValue);
	} else if (ev.key === "spotify-refresh") {
	}
});

const login = () => {
	chrome.notifications.create("login", {
		type: "progress",
		progress: 30,
		title: "Connecting Extension",
		message: "Connecting extension with Spotify",
		iconUrl: "icons/icons/128.png",
	});
	chrome.identity.launchWebAuthFlow(
		{
			interactive: true,
			url: `${BASE_URL}/connect?id=${chrome.runtime.id}`,
		},
		(responseUrl) => {
			const query = qs.parse(new URL(responseUrl).search);
			if (query["?access"]) {
				chrome.notifications.create("login", {
					type: "progress",
					progress: 70,
					title: "Connecting Extension",
					message: "Connecting extension with Spotify",
					iconUrl: "icons/icons/128.png",
				});
				localStorage.setItem("spotify-access", query["?access"]);
				localStorage.setItem("spotify-refresh", query["refresh"]);
				spotyClient.setAccessToken(query["?access"]);
				chrome.browserAction.setPopup(
					{
						popup: "/player/player.html",
					},
					() => {
						chrome.notifications.create("login", {
							type: "progress",
							progress: 100,
							title: "Connecting Extension",
							message: "Connecting extension with Spotify",
							iconUrl: "icons/icons/128.png",
						});
						chrome.notifications.create("loginSuccess", {
							type: "basic",
							iconUrl: "icons/icons/128.png",
							message:
								"Connection succesfull. Enjoy using Layfy 🤘🤘!",
							title: "Connection Successfull",
						});
					}
				);
			}
		}
	);
};

let track;
let error;
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
	if (msg.type !== "login") {
		const updated = await refreshTokens();
		if (!updated) {
			chrome.runtime.sendMessage({ type: "close_window" });
			chrome.notifications.create("loginFail", {
				type: "basic",
				iconUrl: "/icons/icons/128.png",
				message:
					"Could not retrieve token from storage, please login again",
				title: "Authentification Error",
			});
			login();
			return;
		}
	}
	console.info(`received:`, msg);
	switch (msg.type) {
		case "login":
			login();
			break;
		case "get_data":
			await refreshTokens();
			track = await spotyClient.getMyCurrentPlaybackState();
			if (!track) chrome.runtime.sendMessage({ type: "display_waiting" });
			else {
				if (!track.item) {
					chrome.runtime.sendMessage({
						type: "errorMessage",
						value:
							"Could not get playing item. Are you listening a podcast?",
					});
					break;
				}
				chrome.runtime.sendMessage({
					type: "initialData",
					data: track,
				});
			}
			break;
		case "update_data":
			track = await spotyClient.getMyCurrentPlaybackState();
			if (!track) chrome.runtime.sendMessage({ type: "display_waiting" });
			else {
				if (!track.item) {
					chrome.runtime.sendMessage({
						type: "errorMessage",
						value:
							"Could not get playing item. Are you listening a podcast?",
					});
					break;
				}
				chrome.runtime.sendMessage({
					type: "updateTrack",
					data: track,
				});
			}
			break;
		case "play_pause":
			error = await playPause();
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "skip_prev":
			error = await skip_prev();
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "skip_next":
			error = await skip_next();
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "volume_change":
			error = await changeVolume();
			if (error.type === "fail") {
				chrome.runtime.sendMessage({
					type: "errorMessage",
					value: error.msg,
				});
				break;
			}
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "change_repeat":
			await refreshTokens();
			error = await changeRepeat();
			if (error.type == "fail") {
				chrome.runtime.sendMessage({
					type: "errorMessage",
					value: error.msg,
				});
				break;
			}
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "shuffle_change":
			error = await changeShuffle();
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "like_song":
			track = await spotyClient.getMyCurrentPlaybackState();
			error = await likeSong(track);
			track = await spotyClient.getMyCurrentPlaybackState();
			chrome.runtime.sendMessage({ type: "updateTrack", data: track });
			break;
		case "check_liked":
			const saved = await isLiked(msg.id);
			chrome.runtime.sendMessage({ type: "liked_song_value", saved });
			break;
	}
});

chrome.contextMenus.onClicked.addListener((info) => {
	if (info.menuItemId == "laify_search") {
		chrome.tabs.create({
			url: `https://open.spotify.com/search/${encodeURIComponent(
				info.selectionText
			)}`,
		});
	}
});
