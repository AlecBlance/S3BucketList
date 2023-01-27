const requests = chrome.webRequest.onHeadersReceived;
const storage = chrome.storage.local;
let status = true;

listener();
chrome.runtime.onMessage.addListener(fromPopup);

async function listener() {
	requests.addListener(
		record,
		{
			urls: ["<all_urls>"],
		},
		["responseHeaders"]
	);
	if (await chrome.offscreen.hasDocument()) {
		console.debug("Offscreen doc already exists.");
	} else {
		console.debug("Creating a new offscreen document.");
		await chrome.offscreen.createDocument({
			url: "./offscreen/offscreen.html",
			reasons: [chrome.offscreen.Reason.DOM_PARSER],
			justification: "Parse xml",
		});
	}
}

function fromPopup(toRecord, sender, sendResponse) {
	if (toRecord) {
		if (requests.hasListener(record)) {
			requests.removeListener(record);
			status = false;
			chrome.action.setBadgeText({
				text: "!",
			});
			chrome.action.setBadgeBackgroundColor({
				color: "orange",
			});
		} else {
			listener();
			status = true;
			chrome.action.setBadgeText({
				text: "",
			});
		}
	} else {
		sendResponse({
			record: status,
		});
	}
}

async function getBuckets() {
	const stored = await storage.get();
	const buckets = Object.keys(stored);
	return buckets;
}

async function record(response) {
	const headers = response.responseHeaders;
	const s3 = headers.filter((header) => header.name == "x-amz-request-id")[0];
	if (headers.indexOf(s3) != -1) {
		let { hostname, pathname } = new URL(response.url);
		const buckets = await getBuckets();
		if (hostname == "s3.amazonaws.com") {
			hostname += "/" + pathname.split("/")[1];
		}
		let noFavicon = !hostname.includes("favicon.ico");
		if (!buckets.includes(hostname) && noFavicon) {
			storage.set({
				[hostname]: {},
			});
			await info(hostname);
			addNumber();
		}
	}
}

async function info(hostname) {
	let response = await chrome.runtime.sendMessage({ hostname: hostname });
	storage.set({
		[response.hostname]: response.permissions,
	});
}

async function addNumber() {
	const buckets = await getBuckets();
	chrome.action.setBadgeText({
		text: buckets.length.toString(),
	});
	chrome.action.setBadgeBackgroundColor({
		color: "green",
	});
}
