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
  		response.bucketList.forEach((bucket)=>{
  			document.getElementById("content").innerHTML += 
  			"<div class=\"bucket\"><div class=\"bucketName\"><p>"+bucket
  			+"</p></div><a href=\"\" class=\"bucketDelete\"><div>Delete</div></a></div>";
  		});
  		if (response.file != null){
  			save.download = "buckets.txt";
  			save.href = response.file;
  		} else {
  			save.removeAttribute("download"); 
  		}
  		var bucketDelete = document.getElementsByClassName("bucketDelete");
		var bucketName = document.getElementsByClassName("bucketName");
		for (var i = 0; i < bucketDelete.length; i++) {
			bucketDelete[i].addEventListener('click', (target) => {
				var sending = browser.runtime.sendMessage({
			    	"action" : "delete",
			    	"buckets": target.currentTarget.bucket.textContent
			  	});
			}, false);
			bucketDelete[i].bucket = bucketName[i];
		}
  	}); 
})();
