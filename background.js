const requests = browser.webRequest.onHeadersReceived,
anchor = document.createElement('a'),
storage = browser.storage.local;
let status = true;

listener();
browser.runtime.onMessage.addListener(fromPopup);

function listener() {
    requests.addListener(
        record, {
            urls: ["<all_urls>"]
        },
        ["responseHeaders"]
    );
}

function fromPopup(toRecord,sender,sendResponse) {
    if (toRecord) {
        if (requests.hasListener(record)){
            requests.removeListener(record);
            status = false;
        }
        else {
            listener();
            status = true;
        }
    } else {
        sendResponse({
            record: status
        })
    }
}

async function record(response) {
    const headers = response.responseHeaders,
    s3 = headers.filter(header => header.name == "x-amz-request-id")[0];
    if (headers.indexOf(s3) != -1) {
        let hostname;
        const stored = await storage.get(),
        buckets = Object.keys(stored);
        anchor.href = response.url;
        hostname = anchor.hostname;
        if (hostname == "s3.amazonaws.com") {
            hostname += "/"+anchor.pathname.split("/")[1];
        }
        let noFavicon = !hostname.includes("favicon.ico");
        if (buckets.indexOf(hostname) == -1 && noFavicon) {
            storage.set({
                [hostname]: {}
            });
            let infos = await info(hostname);
            await getPerms(infos, hostname);
            await addNumber();
        }
    }
}

async function info(hostname) {
    let response = await fetch("http://"+hostname+"/?acl"), 
    text = await response.text(),
    parser = new DOMParser(),
    xml = parser.parseFromString(text,"text/xml");
    return xml
}

async function getPerms(xml, hostname) {
    const hasUri = xml.getElementsByTagName("URI"),
    hasCode = xml.getElementsByTagName("Code"),
    bucket = await storage.get(hostname),
    permissions = bucket[hostname];
    if (!hasUri[0] && hasCode[0]) {
        let title = hasCode[0].childNodes[0].nodeValue,
        perm = hasCode[0].nextElementSibling.childNodes[0].nodeValue;
        permissions[title] = [perm];
    } else if (hasUri[0] && !hasCode[0]){
        for (let i = 0; i < hasUri.length; i++){
            let text = hasUri[i].childNodes[0].nodeValue,
            perm = hasUri[i].parentNode.nextElementSibling
                   .childNodes[0].nodeValue;
            if (text.includes("AllUsers")){
                if (permissions["All Users"]){
                    permissions["All Users"].push(perm);
                } else {
                    permissions["All Users"] = [perm]
                }
            } else if (text.includes("AuthenticatedUsers")){
                if (permissions["Authenticated"]){
                    permissions["Authenticated"].push(perm);
                } else {
                    permissions["Authenticated"] = [perm]
                }
            } else if (text.includes("LogDelivery")){
                if (permissions["Log Delivery"]){
                    permissions["Log Delivery"].push(perm);
                } else {
                    permissions["Log Delivery"] = [perm];
                }
            }
        }
    } else {
        permissions.Error = ["Error getting permissions"];
    }
    storage.set({
        [hostname]: permissions
    });
}

async function addNumber() {
    let buckets = await storage.get();
    buckets = Object.keys(buckets);
    browser.browserAction.setBadgeText({
        text: (buckets.length).toString()
    });
    browser.browserAction.setBadgeBackgroundColor({
        color: "green"
    });
}