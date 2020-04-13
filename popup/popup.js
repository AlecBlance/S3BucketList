function handleResponse(message) {

	if (message.response == ""){
		document.getElementById("content").innerHTML = "";
	} else {
		message.response.forEach(function (bucket){
	  		document.getElementById("content").innerHTML += "<p>"+bucket+"</p>";
	  	});
	}
}

function handleError(error) {
  	console.log(`Error: ${error}`);
}

function getS3Bucket(action) {
  	var sending = browser.runtime.sendMessage({
    	greeting: action
  	});
  	sending.then(handleResponse, handleError);  
}

document.getElementById("record").addEventListener("change", (e) => {
	getS3Bucket("change");
});

document.getElementById("clear").addEventListener("click", (e) => {
	getS3Bucket("clear");
});
function check() {
	var sending = browser.runtime.sendMessage({
    	greeting: "check"
  	});
  	sending.then(function(message){
  		if (message.response) { 
  			document.getElementById("record").checked = true;
  		} else {
  			document.getElementById("record").checked = false;
  		}
  	}); 
}

check();
getS3Bucket("getS3Bucket");
