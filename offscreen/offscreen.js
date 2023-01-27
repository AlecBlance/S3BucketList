chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
	xmlParser(message, sender, sendResponse);
	return true;
});
async function xmlParser(message, sender, sendResponse) {
	let hostname = message.hostname;
	if (hostname === undefined) return;
	let response = await fetch("http://" + hostname + "/?acl");
	let text = await response.text();
	let parser = new DOMParser();
	let xml = parser.parseFromString(text, "text/xml");
	sendResponse(getPerms(xml, hostname));
}

function getPerms(xml, hostname) {
	const hasUri = xml.getElementsByTagName("URI");
	const hasCode = xml.getElementsByTagName("Code");
	const permissions = {};
	if (hasCode[0]) {
		let title = hasCode[0].childNodes[0].nodeValue,
			perm = hasCode[0].nextElementSibling.childNodes[0].nodeValue;
		permissions[title] = [perm];
	} else if (hasUri[0]) {
		for (let i = 0; i < hasUri.length; i++) {
			let permName,
				text = hasUri[i].childNodes[0].nodeValue,
				perm = hasUri[i].parentNode.nextElementSibling.childNodes[0].nodeValue;
			if (text.includes("AllUsers")) {
				permName = "All Users";
			} else if (text.includes("AuthenticatedUsers")) {
				permName = "Authenticated";
			} else if (text.includes("LogDelivery")) {
				permName = "Log Delivery";
			}
			if (permissions[permName]) {
				permissions[permName].push(perm);
			} else {
				permissions[permName] = [perm];
			}
		}
	} else {
		permissions.Error = ["Error getting permissions"];
	}
	return { hostname: hostname, permissions: permissions };
}
