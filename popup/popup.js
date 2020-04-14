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
  		if (response.recordStatus) { 
  			document.getElementById("record").checked = true;
  		} else {
  			document.getElementById("record").checked = false;
  		}
  		response.bucketList.forEach((bucket)=>{
  			document.getElementById("content").innerHTML += 
  			"<div class=\"bucket\"><div class=\"bucketName\"><p>"+bucket
  			+"</p></div></div>";
  		});
  	}); 
})();
