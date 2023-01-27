const record = document.getElementById("record");
const clear = document.getElementById("clear");
const save = document.getElementById("save");
const content = document.getElementById("content");
const storage = chrome.storage.local;
let buckets, noOfBuckets;

record.addEventListener("change", recordBucket);
clear.addEventListener("click", clearBucket);

(async function () {
	let status = await getRecordStatus();
	await getBuckets();
	console.log("bucket", buckets);
	await generateSave();
	await displayBucket();
	displayContent();
	if (status) {
		record.checked = true;
	} else {
		record.checked = false;
	}
})();

async function getBuckets() {
	buckets = await storage.get();
	noOfBuckets = Object.keys(buckets);
}

async function recordBucket() {
	await chrome.runtime.sendMessage(true);
}

async function clearBucket() {
	await chrome.storage.local.clear();
	chrome.action.setBadgeText({
		text: "",
	});
}

async function getRecordStatus() {
	let response = await chrome.runtime.sendMessage(false);
	return response.record;
}

async function generateSave() {
	if (noOfBuckets.length != 0) {
		let blob = new Blob([JSON.stringify(buckets, null, 2)], {
			type: "text/plain",
		});
		blob = window.URL.createObjectURL(blob);
		save.download = "buckets.txt";
		save.href = blob;
	} else {
		save.removeAttribute("download");
	}
}

async function displayBucket() {
	if (noOfBuckets.length == 0) return;
	for (let bucket of noOfBuckets) {
		const divElement = document.createElement("div");
		divElement.classList.add("bucket");
		const iElement = document.createElement("i");
		iElement.classList.add("down");
		const div2Element = document.createElement("div");
		div2Element.classList.add("bucketName");
		const pElement = document.createElement("p");
		const pTextElement = document.createTextNode(bucket);
		pElement.appendChild(pTextElement);
		div2Element.appendChild(pElement);
		const aElement = document.createElement("a");
		aElement.href = "";
		aElement.classList.add("bucketDelete");
		const div3Element = document.createElement("div");
		const divTextElement = document.createTextNode("Delete");
		div3Element.appendChild(divTextElement);
		aElement.appendChild(div3Element);
		divElement.append(iElement, div2Element, aElement);
		const div4Element = document.createElement("div");
		div4Element.classList.add("bucketContent");

		let perms = buckets[bucket],
			permsName = Object.keys(perms);
		for (let perm of permsName) {
			const p2Element = document.createElement("p");
			const bElement = document.createElement("b");
			const bTextElement = document.createTextNode(perm);
			bElement.appendChild(bTextElement);
			const brElement = document.createElement("br");
			const p2TextElement = document.createTextNode(perms[perm]);
			p2Element.append(bElement, brElement, p2TextElement);
			div4Element.appendChild(p2Element);
		}
		const finalDiv = document.createElement("div");
		finalDiv.append(divElement, div4Element);
		document.getElementById("content").appendChild(finalDiv);
	}
}

async function displayContent() {
	const bucket = document.getElementsByClassName("bucket");
	const bucketDelete = document.getElementsByClassName("bucketDelete");
	const bucketName = document.getElementsByClassName("bucketName");
	for (var i = 0; i < bucketDelete.length; i++) {
		bucketDelete[i].addEventListener("click", deleteBucket);
		bucketDelete[i].bucket = bucketName[i];
		bucket[i].onmouseover = function () {
			bucketDelete[this.num].style.visibility = "visible";
		};
		bucket[i].onmouseout = function () {
			bucketDelete[this.num].style.visibility = "hidden";
		};
		bucket[i].num = i;
		bucket[i].addEventListener("click", openContent);
	}
}

async function deleteBucket() {
	let buckets = noOfBuckets.length - 1;
	if (buckets != 0) {
		chrome.action.setBadgeText({
			text: buckets.toString(),
		});
		chrome.action.setBadgeBackgroundColor({
			color: "green",
		});
	} else {
		chrome.action.setBadgeText({
			text: "",
		});
	}
	await storage.remove(this.bucket.textContent);
}

function openContent() {
	var content = this.nextElementSibling;
	this.classList.toggle("active");
	if (content.style.maxHeight) {
		content.style.maxHeight = null;
		this.childNodes[0].className = "down";
	} else {
		this.childNodes[0].className = "up";
		content.style.maxHeight = content.scrollHeight + "px";
	}
}
