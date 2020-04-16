document.getElementById("record").addEventListener("change", () => {
	var sending = browser.runtime.sendMessage({
    	"action" : "change"
  	});
});

document.getElementById("clear").addEventListener("click", () => {
	var sending = browser.runtime.sendMessage({
    	"action" : "clear"
  	});
});

(() => {
	var sending = browser.runtime.sendMessage({
    	"action": "check"
  	});
  	sending.then((response) => {
  		var save = document.getElementById("save");
  		var record = document.getElementById("record");
  		if (response.recordStatus) { 
  			record.checked = true;
  		} else {
  			record.checked = false;
  		}
  		const parser = new DOMParser();
  		for (var i=0; i<response.bucketList.length; i++){
  			var html = `<div class="bucket" style="cursor: pointer;"><i class="down"></i><div class="bucketName"><p>`+response.bucketList[i]
  			+`</p></div><a href="" class="bucketDelete"><div>Delete</div></a></div><div class="bucketContent">`;
  			if (response.bucketPermission[i] != null){
  				for (var a =0; a < response.bucketPermission[i].length; a++){
	  				html += "<p>";
	  				response.bucketPermission[i][a].forEach((each)=>{
	  					html += each+" ";
	  				});
	  				html += "</p>";
	  			}
  			} else {
  				html += "<p>Unable to get permissions";
  			}
  			html += "</div>";
			var parsed = parser.parseFromString(html, `text/html`);
			var tags = parsed.getElementsByTagName(`body`);
			for (var tag of tags) {
				document.getElementById("content").appendChild(tag); 
			}
  		}
  		if (response.file != null){
  			save.download = "buckets.txt";
  			save.href = response.file;
  		} else {
  			save.removeAttribute("download"); 
  		}
  		var bucket = document.getElementsByClassName("bucket");
  		var bucketDelete = document.getElementsByClassName("bucketDelete");
		var bucketName = document.getElementsByClassName("bucketName");
		for (var i = 0; i < bucketDelete.length; i++) {
			bucketDelete[i].addEventListener('click', function() {
				var sending = browser.runtime.sendMessage({
			    	"action" : "delete",
			    	"buckets": this.bucket.textContent
			  	});
			});
			bucketDelete[i].bucket = bucketName[i];
			bucket[i].onmouseover = function () {
				bucketDelete[this.num].style.visibility = "visible";
			}
			bucket[i].onmouseout = function () {
				bucketDelete[this.num].style.visibility = "hidden";
			}
			bucket[i].num = i;
			bucket[i].addEventListener('click', function() {
				var content = this.nextElementSibling;
				this.classList.toggle("active");
			 	if (content.style.maxHeight){
			      	content.style.maxHeight = null;
			      	this.childNodes[0].className = "down";
			    } else {
			    	this.childNodes[0].className = "up";
			      	content.style.maxHeight = content.scrollHeight + "px";
			    } 
			});
		}
  	}); 
})();
