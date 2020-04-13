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
    if (response.statusCode != 404){
        response.responseHeaders.forEach(function(header) {
            if (header.name.toLowerCase() == "x-amz-request-id") {
                anchor.href = response.url;
                hostname = anchor.hostname;
                if (hostname == "s3.amazonaws.com"){
                    hostname += "/"+anchor.pathname.split("/")[1];
                }
                if (!bucket.includes(hostname)) {
                    addNumber();
                    bucket.push(hostname);
                }
            }
        });
    }
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
    if (request.greeting == "clear") {
        bucket = [];
        browser.browserAction.setBadgeText({
            text: null
        });
        clicks = 0;
        sendResponse({
            response: bucket
        });
    }
});
