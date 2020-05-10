const record = document.getElementById("record"),
clear = document.getElementById("clear"),
save = document.getElementById("save"),
content = document.getElementById("content");
storage = browser.storage.local;

record.addEventListener("change", recordBucket);
clear.addEventListener("click", clearBucket);

(async function () {
	let status = await getRecordStatus();
	await generateSave();
	await displayBucket();
	displayContent();
	if (status) {
		record.checked = true;
	} else {
		record.checked = false;
	}
})();

async function recordBucket() {
	await browser.runtime.sendMessage(true);
}

async function clearBucket() {
	await browser.storage.local.clear();
	browser.browserAction.setBadgeText({
        text: null
    });
}

async function getRecordStatus() {
	let response = await browser.runtime.sendMessage(false);
	return response.record;
}

async function generateSave() {
	const buckets = await storage.get(),
	noOfBuckets = Object.keys(buckets);
	if (noOfBuckets.length != 0) {
		let blob = new Blob(
			[JSON.stringify(buckets, null, 2)],
			 {type: 'text/plain'}
		);
		blob = window.URL.createObjectURL(blob);
		save.download = "buckets.txt";
		save.href = blob; 
	} else {
		save.removeAttribute("download");
	}
}

async function displayBucket() {
	const buckets = await storage.get(),
	noOfBuckets = Object.keys(buckets),
	parser = new DOMParser;
	if (noOfBuckets.length != 0) {
		for (let bucket of noOfBuckets) {
			let html = `<div class="bucket" style="cursor: pointer;">
			<i class="down"></i><div class="bucketName"><p>`+bucket+`</p></div>
			<a href="" class="bucketDelete"><div>Delete</div></a></div>
			<div class="bucketContent">`;
			let perms = buckets[bucket],
			permsName = Object.keys(perms);
			for (let perm of permsName) {
				html += "<p><b>"+perm+"</b><br>"+perms[perm]+"</p>";
			}
			html += "</div>";
			let parsed = parser.parseFromString(html, "text/html"),
			tags = parsed.getElementsByTagName("body")[0];
			document.getElementById("content").appendChild(tags); 
		}
	}

}

async function displayContent() {
	const bucket = document.getElementsByClassName("bucket"),
	bucketDelete = document.getElementsByClassName("bucketDelete"),
	bucketName = document.getElementsByClassName("bucketName");
	for (var i = 0; i < bucketDelete.length; i++) {
		bucketDelete[i].addEventListener('click', deleteBucket);
		bucketDelete[i].bucket = bucketName[i];
		bucket[i].onmouseover = function () {
			bucketDelete[this.num].style.visibility = "visible";
		}
		bucket[i].onmouseout = function () {
			bucketDelete[this.num].style.visibility = "hidden";
		}
		bucket[i].num = i;
		bucket[i].addEventListener('click', openContent);
	}
}

async function deleteBucket() {
	let buckets = await storage.get();
    buckets = Object.keys(buckets);
    buckets = buckets.length-1;
    if (buckets != 0) {
    	browser.browserAction.setBadgeText({
	        text: buckets.toString()
	    });
	    browser.browserAction.setBadgeBackgroundColor({
	        color: "green"
	    });
    } else {
    	browser.browserAction.setBadgeText({
	        text: null
	    });
    }
	await storage.remove(this.bucket.textContent);
}

function openContent() {
	var content = this.nextElementSibling;
	this.classList.toggle("active");
 	if (content.style.maxHeight){
      	content.style.maxHeight = null;
      	this.childNodes[1].className = "down";
    } else {
    	this.childNodes[1].className = "up";
      	content.style.maxHeight = content.scrollHeight + "px";
    } 
}