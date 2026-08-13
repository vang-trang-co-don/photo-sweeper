# photo-sweeper

Sweep your photo library fast: swipe **left = delete**, swipe **right = keep**. Built with Expo SDK **54** (React Native 0.81), runs on your iPhone via **Expo Go** — you do **not** need a Mac.

> **Why SDK 54?** The project was initially scaffolded on SDK 57, but the current App Store build of Expo Go only supports up to SDK 54. We pinned the project to SDK 54 so it runs in your Expo Go. If you later get an Expo Go build for a newer SDK, you can bump `expo` and run `npx.cmd expo install --fix`.

## Prerequisites

- Windows PC with Node 18+/npm (this repo was built with Node 22)
- iPhone with **Expo Go** installed from the App Store
- Phone and PC on the **same Wi-Fi network**
- Node `scripts` are executed with `npm.cmd` because npm.ps1 is blocked by PowerShell execution policy

## Run it

```bash
cd photo-sweeper
npm.cmd install        # first time only
npm.cmd start          # starts Metro (expo start)
```

Then on the iPhone: open **Expo Go** → scan the QR code shown in the terminal. The app loads over LAN.

Troubleshooting:
- Ảnh không chạy → tắt firewall hoặc mở port 8081; chắc chắn 2 máy cùng Wi-Fi.
- Không thấy QR → bấm `s` trong terminal hoặc `npx.cmd expo start --tunnel` (dùng Tunnel khi LAN bị chặn).

## How it works

1. On first launch the app asks for **photo access**.
2. iOS limited access (chỉ vài ảnh được chọn) → app yêu cầu bật **All Photos** mới xóa được:
   `Settings → Privacy & Security → Photos → photo-sweeper → All Photos`
3. Cards show photos newest-first. Gestures:
   - **swipe left** → mark for deletion (staged)
   - **swipe right** → keep
   - **↩ Undo** button restore the last staged photo into the queue
4. When the queue is empty, press **Commit deletion** to actually delete all staged photos.
   - Nothing is deleted from your library until you commit.
   - Deleted photos land in the Photos app **Recently Deleted** — you can still recover them there.

## Project layout

```
App.tsx                        permission gate + root
src/components/SweeperScreen.tsx   card stack + pan gesture + undo/commit UI
src/components/BackCard.tsx        helper: cards behind the top one
src/media/permissions.ts           get/request photo access, full/limited detection
src/media/library.ts               queries via the new expo-media-library API (Query/SortDescriptor)
src/media/usePhotoLibrary.ts       paged loading (50 at a time)
src/media/useSweepSession.ts       queue state, staged/kept, undo, commit
src/media/delete.ts                batch delete via Asset.delete()
```

## Notes

- Tech: `expo-media-library` (SDK 54 **legacy API**: `getAssetsAsync` / `deleteAssetsAsync`), `expo-image` (renders `ph://` URIs),
  `react-native-gesture-handler` + `react-native-reanimated` (reanimated 4 / worklets — the babel plugin is
  auto-configured by `babel-preset-expo`).
- Type check: `npx.cmd tsc --noEmit`
- To ship a standalone app later (App Store / install without Expo Go) use **EAS Build** from Windows
  (cloud macOS runners) + an Apple Developer account.