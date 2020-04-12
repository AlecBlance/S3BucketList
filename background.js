var clicks = 0;
var anchor = document.createElement('a');
var bucket = [];
var hostname;

function addNumber() {
    browser.browserAction.setBadgeText({
        text: (++clicks).toString()
    });
    browser.browserAction.setBadgeBackgroundColor({
        color: "green"
    });
}

function recordHttpResponse(response) {
    response.responseHeaders.forEach(function(header) {
        if (header.name.toLowerCase() == "x-amz-request-id") {
            anchor.href = response.url;
            hostname = anchor.hostname;
            if (!bucket.includes(hostname)) {
                addNumber();
                bucket.push(hostname);
                // console.log("Bucket: "+hostname);
            }
        }
    });
    return {
        responseHeaders: response.responseHeaders
    };
}
browser.webRequest.onHeadersReceived.addListener(
    recordHttpResponse, {
        urls: ["<all_urls>"]
    },
    ["responseHeaders"]
);
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.greeting == "getS3Bucket") {
        sendResponse({
            response: bucket
        });
    }
});