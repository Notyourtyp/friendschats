// client/src/cometchat.js
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";

const APP_ID = import.meta.env.VITE_COMETCHAT_APP_ID;
const REGION = import.meta.env.VITE_COMETCHAT_REGION;
const AUTH_KEY = import.meta.env.VITE_COMETCHAT_AUTH_KEY;

let initialized = false;

export async function initCometChat() {
  if (initialized) return;
  const settings = new UIKitSettingsBuilder()
    .setAppId(APP_ID)
    .setRegion(REGION)
    .setAuthKey(AUTH_KEY)
    .subscribePresenceForAllUsers()
    .build();
  await CometChatUIKit.init(settings);
  initialized = true;
  console.log("CometChat initialised ✅");
}

export async function loginCometChat(uid, authToken) {
  try {
    const currentUser = await CometChatUIKit.getLoggedinUser();
    if (currentUser && currentUser.getUid() === uid) return currentUser;
    const user = await CometChatUIKit.loginWithAuthToken(authToken);
    console.log("CometChat login success:", user.getUid());
    return user;
  } catch (err) {
    console.error("CometChat login error:", err);
    return null;
  }
}

export async function logoutCometChat() {
  try {
    await CometChatUIKit.logout();
  } catch (_) {}
}