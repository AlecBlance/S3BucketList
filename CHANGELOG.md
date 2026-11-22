# s3bucketlist

## 4.2.0

### Minor Changes

- 94b263c: Add a local discovery workspace with status filters, a visible scan queue, notes,
  and check history. Separate anonymous listing and bucket ACL results from
  optional file checks, and export sanitized evidence and request details.
  Show recent discoveries from the active tab in the popup and clear its unread
  toolbar count when the popup opens.

### Patch Changes

- 385019e: Handle empty bucket lists safely when downloading recorded buckets.
- 94fac23: Avoid repeated permission checks for buckets that are already recorded or being inspected.
- cdb8a9d: Handle bucket inspection network errors without breaking recording or reporting failed checks as confirmed access results.
- 44c4427: Stop treating S3 log delivery ACL permissions as public access.
- ef98267: Preserve the recording setting across browser restarts and keep the recording switch in sync with the background state.
- 7a7764c: Keep popup data synchronized with storage changes, handle bucket deletion consistently, and correct release publishing conditions.
- 393a27a: Prevent simultaneous bucket updates from overwriting recorded buckets.

## 4.1.2

### Patch Changes

- e4b1827: remove unused content script
- 4f82c11: fix unhandled regional buckets

## 4.1.1

### Patch Changes

- e198a90: fix unclaimed badge showing on previous records

## 4.1.0

### Minor Changes

- aa6c36e: add unclaimed bucket detection

### Patch Changes

- 7b67544: fix tests failing, and refactored bucket information extraction for better readability

## 4.0.0

### Major Changes

- 4bc71d3: Restructure codebase, revamp ui, refactored processes
