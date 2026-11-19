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
- Detect unclaimed / hanging / vulnerable buckets

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

## Automated Chrome Web Store releases

Merge the fix and feature PRs first, then merge the Changesets **Version Packages**
PR when ready to release. After successful CI, the Publish workflow creates the
GitHub release, builds and attaches the Chrome and Firefox ZIPs, and submits the
Chrome ZIP to the existing Chrome Web Store listing. Google still reviews the
update; submission does not mean it is immediately live. Firefox store submission
is not automated by this workflow.

### One-time setup

1. Enable the Chrome Web Store API in a dedicated Google Cloud project and create
   a service account **without Google Cloud project roles**, following the
   [official service-account guide](https://developer.chrome.com/docs/webstore/service-accounts).
2. Add its email in the Chrome Web Store Developer Dashboard under
   **Settings > Service account**. Google grants API access to all items owned by
   that publisher. The release script deliberately fixes the target to
   S3BucketList (`anngjobjhcbancaaogmlcffohpmcniki`).
3. In GitHub, open **Settings > Secrets and variables > Actions** and add:

   | Repository secret | Value |
   | --- | --- |
   | `CHROME_SERVICE_ACCOUNT_KEY` | Full JSON key created for the dedicated service account |
   | `CHROME_PUBLISHER_ID` | Publisher ID from the store dashboard's Settings page |

This is private server-to-server publishing: no public OAuth consent screen,
homepage, privacy-policy URL, client secret, or refresh token is required for
this authentication method. It does not change the extension's store policy
obligations.

Keep the JSON key out of source files, PRs, and logs. Supply the two environment
variables above securely and run this read-only check using Node.js 20 (matching
CI) before the first release:

```sh
node scripts/publish-chrome.mjs --dry-run
```

Missing credentials or a rejected submission fail the Publish workflow visibly.
The GitHub release and ZIPs are created before store submission, so they remain
available if submission fails. Do not bump the version merely to retry an upload
failure: inspect the store status first, then run `node scripts/publish-chrome.mjs
<chrome-zip-path>` from the release's Git tag with the existing release's Chrome
ZIP. The script skips already-published or already-submitted versions, refuses to
replace another pending or staged version, waits for asynchronous uploads, and
blocks publication on store warnings. Google review is not bypassed.

Rotate the service account key periodically. After saving a new key as the GitHub
secret and verifying read access, delete the superseded key in Google Cloud.
Never commit a downloaded key file.
