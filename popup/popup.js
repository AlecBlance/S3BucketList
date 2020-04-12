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

document.getElementById("clear").addEventListener("click", (e) => {
	getS3Bucket("clear");
});

getS3Bucket("getS3Bucket");
