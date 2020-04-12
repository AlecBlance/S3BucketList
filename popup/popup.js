function handleResponse(message) {
  message.response.forEach(function (bucket){
  	document.getElementById("content").innerHTML += bucket+"<br>";
  });
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

getS3Bucket("getS3Bucket");