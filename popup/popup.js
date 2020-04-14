document.getElementById("record").addEventListener("change", () => {
	var sending = browser.runtime.sendMessage({
    	"action" : "change"
  	});
});

document.getElementById("clear").addEventListener("click", () => {
	var sending = browser.runtime.sendMessage({
    	"action" : "clear"
  	});
  	sending.then(()=>{
  		document.getElementById("content").innerHTML = "";
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
  			+"</p></div></div>";
  		});
  		if (response.file != null){
  			save.download = "buckets.txt";
  			save.href = response.file;
  		} else {
  			save.removeAttribute("download"); 
  		}
  	}); 
})();
