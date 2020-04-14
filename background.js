var clicks = 0;
var anchor = document.createElement('a');
var bucket = [];
var record = true;
var hostname;

browser.webRequest.onHeadersReceived.addListener(
    recordHttpResponse, {
        urls: ["<all_urls>"]
    },
    ["responseHeaders"]
);

function recordHttpResponse(response) {
    if (record) {
        if (response.statusCode != 404){
            response.responseHeaders.forEach(function(header) {
                if (header.name.toLowerCase() == "x-amz-request-id") {
                    anchor.href = response.url;
                    hostname = anchor.hostname;
                    if (hostname == "s3.amazonaws.com"){
                        var path = anchor.pathname.split("/")[1]; 
                        if (path=="favicon.ico"){
                            hostname = bucket[0];
                        } else {
                            hostname += "/"+path;
                        }
                    }
                    if (!bucket.includes(hostname)) {
                        addNumber();
                        bucket.push(hostname);
                    }
                }
            });
        }
    }
    return {
        responseHeaders: response.responseHeaders
    };
}

function addNumber() {
    browser.browserAction.setBadgeText({
        text: (++clicks).toString()
    });
    browser.browserAction.setBadgeBackgroundColor({
        color: "green"
    });
}

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action == "change") {
        if (record) {
            browser.browserAction.setBadgeText({
                text: "!"
            });
            browser.browserAction.setBadgeBackgroundColor({
                color: "orange"
            });
            record = false;
        } else {
            browser.browserAction.setBadgeText({
                text: clicks.toString()
            });
            browser.browserAction.setBadgeBackgroundColor({
                color: "green"
            });
            record = true;
        }
    }
    if (request.action == "clear") {
        bucket = [];
        browser.browserAction.setBadgeText({
            text: null
        });
        clicks = 0;
    }
    if (request.action == "check") { 
        if (bucket != "") {
            var content = "";
            bucket.forEach((storage) => {
                content += storage+"\n";
            });
            var blob = new Blob([content], {type: 'text/plain'});
            blob = window.URL.createObjectURL(blob);
        }
        sendResponse({
            "recordStatus": record,
            "bucketList": bucket,
            "file": blob
        });
    }
    if (request.action == "delete") {
        browser.browserAction.setBadgeText({
            text: (--clicks).toString()
        });
        if (clicks == 0) {
            browser.browserAction.setBadgeText({
                text: null
            });
        }
        bucket.splice(bucket.indexOf(request.buckets) , 1);
    }
});
