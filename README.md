# S3BucketList

Search, lists, and checks S3 Buckets found in network requests while you are browsing.

<a href="https://www.producthunt.com/products/s3bucketlist?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-s3bucketlist" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=975743&theme=light&t=1749475141601" alt="S3BucketList - List&#0032;and&#0032;inspect&#0032;S3Buckets&#0032;while&#0032;browsing | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
&nbsp;&nbsp;
<a href="https://chromewebstore.google.com/detail/s3bucketlist/anngjobjhcbancaaogmlcffohpmcniki" target="_blank">
  <img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png"
       alt="Get it on Chrome Web Store"
       style="height: 58px;" />
</a> 
&nbsp;&nbsp;
<a href="https://addons.mozilla.org/en-US/android/addon/s3bucketlist/" target="_blank">
  <img src="https://blog.mozilla.org/addons/files/2015/11/get-the-addon.png" 
       alt="Get it on Firefox Add-ons" 
       style="height: 58px;" />
</a>


![alt text](image.png)

## Features

- Filters S3Buckets
- Extract ACL permissions
- Download recorded buckets
- Manage recorded buckets
- Tab-specific bucket recording
- Unclaimed / Hanging / Vulnerable buckets

## Installation

#### Chrome

You can install this extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/s3bucketlist/anngjobjhcbancaaogmlcffohpmcniki?authuser=0&hl=en) or:

1. Download from the [latest](https://github.com/AlecBlance/S3BucketList/releases) release.
2. Extract the downloaded zip file
3. On the top right of the Chrome browser, click the three dots.
4. Select `Extension > Manage Extensions`, and enable `Developer Mode`
5. Click `Load unpacked`, and look for the extracted zip file.

#### Firefox

You can install this extension from the [Firefox add-ons](https://addons.mozilla.org/en-US/android/addon/s3bucketlist/) or:

1. Download from the [latest](https://github.com/AlecBlance/S3BucketList/releases) release.
2. Extract the downloaded zip file
3. In your firefox browser, navigate to `about:debugging > This Firefox > "Load Temporary Addon"`
4. Select the `manifest.json` within the extracted zip file

## Build from source

1. Clone the repository, and navigate to the S3BucketList folder
2. Install [pnpm](https://pnpm.io/installation)
3. Do `pnpm i` to install the required modules
4. Do `pnpm zip` for chrome-compatible version or `pnpm zip:firefox` for firefox-compatible version.
5. A zip file will be created in the `dist/` folder
6. Follow the manual installation steps above on how to install the extension.
