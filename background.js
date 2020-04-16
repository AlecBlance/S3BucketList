var clicks = 0;
var anchor = document.createElement('a');
var bucket = [];
var bucketPermission = [];
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
                        if (hostname.includes("favicon.ico")){
                            hostname = bucket[0];
                        } else {
                            hostname += "/"+path;
                        }
                    }
                    if (!bucket.includes(hostname)) {
                        addNumber();
                        var req = new XMLHttpRequest();
                        req.open("GET", "https://"+hostname+"/?acl", true);
                        req.addEventListener("load", function() {
                            var currentPerm;
                            var xml = req.responseXML.getElementsByTagName("URI");
                            if (xml.length == 0){
                                currentPerm = [[],[]];
                                xml = req.responseXML.getElementsByTagName("Code");
                                currentPerm[0].push("<b>"+xml[0].childNodes[0].nodeValue+"</b>");
                                currentPerm[1].push(xml[0].nextElementSibling.childNodes[0].nodeValue);
                                bucketPermission.push(currentPerm);
                            } else {
                                currentPerm = [["<b>All Users: </b>"],["<b>Authenticated: </b>"],["<b>Log Delivery: </b>"]];
                                for (var i = 0; i < xml.length; i++){
                                    var text = xml[i].childNodes[0].nodeValue;
                                    if (text.includes("AllUsers")){
                                        currentPerm[0].push(xml[i].parentNode.nextElementSibling.childNodes[0].nodeValue);
                                    }
                                    if (text.includes("AuthenticatedUsers")){
                                        currentPerm[1].push(xml[i].parentNode.nextElementSibling.childNodes[0].nodeValue);
                                    }
                                    if (text.includes("LogDelivery")){
                                        currentPerm[2].push(xml[i].parentNode.nextElementSibling.childNodes[0].nodeValue);
                                    }
                                }
                                bucketPermission.push(currentPerm);
                            }
                            
                        });
                        req.send();
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
            if (clicks == 0){
                browser.browserAction.setBadgeText({
                    text: null
                });
            } else {
                browser.browserAction.setBadgeText({
                    text: clicks.toString()
                });
            }
            browser.browserAction.setBadgeBackgroundColor({
                color: "green"
            });
            record = true;
        }
    }
    if (request.action == "clear") {
        bucket = [];
        bucketPermission = [];
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
            "bucketPermission": bucketPermission,
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
        var index = bucket.indexOf(request.buckets);
        bucket.splice( index, 1);
        bucketPermission.splice(index, 1);
    }
});
