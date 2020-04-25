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
                        hostname += "/"+anchor.pathname.split("/")[1];
                    }
                    var bucketNone = bucket.filter(bucket => bucket.bucketName == hostname) == "";
                    var noFavicon = !anchor.pathname.includes("favicon.ico");
                    if (bucketNone && noFavicon) {
                        var req = new XMLHttpRequest();
                        bucket.push({
                            "bucketName": hostname,
                            "bucketPermissions": []
                        });
                        var bucketFilter = bucket.filter(bucket => bucket.bucketName == hostname);
                        var bucketPermissions = bucketFilter[0].bucketPermissions;
                        req.open("GET", "https://"+hostname+"/?acl", true);
                        req.addEventListener("load", function() {
                            if (req.responseXML == null) {
                                bucketPermissions.push({
                                    "title": "Error",
                                    "permission": ["Error getting permissions"]
                                });
                            } else {
                                var xml = req.responseXML.getElementsByTagName("URI");
                                if (xml.length == 0){
                                    xml = req.responseXML.getElementsByTagName("Code");
                                    if(typeof(xml[0]) == "undefined"){
                                        bucketPermissions.push({
                                            "title": "Error",
                                            "permission": ["Error getting permissions"]
                                        });
                                    } else {
                                        bucketPermissions.push({
                                            "title": xml[0].childNodes[0].nodeValue,
                                            "permission": [xml[0].nextElementSibling.childNodes[0].nodeValue]
                                        });
                                    }
                                } else {
                                    var permissionFilter;
                                    for (var i = 0; i < xml.length; i++){
                                        var text = xml[i].childNodes[0].nodeValue;
                                        var permission = xml[i].parentNode.nextElementSibling.childNodes[0].nodeValue;
                                        if (text.includes("AllUsers")){
                                            permissionFilter = bucketPermissions.filter(bucket => bucket.title == "All Users");
                                            if (permissionFilter.length == 0) {
                                                bucketPermissions.push({
                                                    "title": "All Users",
                                                    "permission": [permission]
                                                });
                                            } else {
                                                permissionFilter[0].permission.push(permission);
                                            }
                                        } else if (text.includes("AuthenticatedUsers")){
                                            permissionFilter = bucketPermissions.filter(bucket => bucket.title == "Authenticated");
                                            if (permissionFilter.length == 0) {
                                                bucketPermissions.push({
                                                    "title": "Authenticated",
                                                    "permission": [permission]
                                                });
                                            } else {
                                                permissionFilter[0].permission.push(permission);
                                            }
                                        } else if (text.includes("LogDelivery")){
                                            permissionFilter = bucketPermissions.filter(bucket => bucket.title == "Log Delivery");
                                            if (permissionFilter.length == 0) {
                                                bucketPermissions.push({
                                                    "title": "Log Delivery",
                                                    "permission": [permission]
                                                });
                                            } else {
                                                permissionFilter[0].permission.push(permission);
                                            }
                                        }
                                    }
                                }
                            }
                        });
                        req.send();
                        addNumber();
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
        browser.browserAction.setBadgeText({
            text: null
        });
        clicks = 0;
    }
    if (request.action == "check") { 
        if (bucket != "") {
            var blob = new Blob([JSON.stringify(bucket, null, 2)], {type: 'text/plain'});
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
        var index = bucket.indexOf(bucket.filter(bucket => bucket.bucketName == request.buckets));
        bucket.splice(index, 1);
    }
});
