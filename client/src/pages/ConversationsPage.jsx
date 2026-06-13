// client/src/pages/ConversationsPage.jsx

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  CometChatMessages,
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { usersAPI, authAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import styles from "./ConversationsPage.module.css";

let uiKitReady = false;
async function ensureUIKit() {
  if (uiKitReady) return;
  const settings = new UIKitSettingsBuilder()
    .setAppId(import.meta.env.VITE_COMETCHAT_APP_ID)
    .setRegion(import.meta.env.VITE_COMETCHAT_REGION)
    .setAuthKey(import.meta.env.VITE_COMETCHAT_AUTH_KEY)
    .subscribePresenceForAllUsers()
    .build();
  await CometChatUIKit.init(settings);
  uiKitReady = true;
}

export default function ConversationsPage() {
  const { user: me } = useAuth();
  const [ready, setReady] = useState(false);
  const [friends, setFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [activeUser, setActiveUser] = useState(null);
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  // Check presence for all friends
  const refreshPresence = useCallback(async (friendsList) => {
    if (!friendsList || friendsList.length === 0) return;
    try {
      const online = new Set();
      await Promise.all(
        friendsList.map(async (friend) => {
          try {
            const ccUser = await CometChat.getUser(friend.id);
            if (ccUser.getStatus() === "online") {
              online.add(friend.id);
            }
          } catch (_) {}
        })
      );
      setOnlineUsers(online);
    } catch (_) {}
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await ensureUIKit();
        let loggedIn = await CometChatUIKit.getLoggedinUser();
        if (!loggedIn) {
          const { data } = await authAPI.me();
          await CometChatUIKit.loginWithAuthToken(data.ccAuthToken);
        }
        const { data } = await usersAPI.getFriends();
        setFriends(data.friends);
        setReady(true);

        // Check presence after short delay to allow sync
        setTimeout(() => refreshPresence(data.friends), 2000);

        // Poll presence every 30 seconds
        const interval = setInterval(() => refreshPresence(data.friends), 30000);

        // Real-time presence listener
        const listenerID = "presence_listener";
        CometChat.addUserListener(
          listenerID,
          new CometChat.UserListener({
            onUserOnline: (user) => {
              setOnlineUsers((prev) => new Set([...prev, user.getUid()]));
            },
            onUserOffline: (user) => {
              setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.delete(user.getUid());
                return next;
              });
            },
          })
        );

        return () => {
          clearInterval(interval);
          CometChat.removeUserListener(listenerID);
        };
      } catch (err) {
        console.error("ConversationsPage init error:", err);
        toast.error("Could not load conversations");
      }
    }
    init();
  }, [me.id]);

  async function openChat(friend) {
    if (activeFriendId === friend.id) return;
    setActiveUser(null);
    setActiveFriendId(friend.id);
    setLoadingChat(true);
    try {
      const ccUser = await CometChat.getUser(friend.id);
      setTimeout(() => {
        setActiveUser(ccUser);
        setLoadingChat(false);
      }, 50);
    } catch (err) {
      console.error("getUser error:", err);
      toast.error("Could not open chat.");
      setActiveFriendId(null);
      setLoadingChat(false);
    }
  }

  if (!ready) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Loading conversations…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Left pane: friends list ───────────────────────────────────── */}
      <div className={styles.listPane}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Conversations</h2>
          <span className={styles.listHint}>Friends only</span>
        </div>

        {friends.length === 0 ? (
          <div className={styles.noFriends}>
            <span>🤝</span>
            <p>No friends yet.</p>
            <p>Accept a friend request to start chatting.</p>
          </div>
        ) : (
          <div className={styles.friendsList}>
            {friends.map((friend) => {
              const isOnline = onlineUsers.has(friend.id);
              return (
                <div
                  key={friend.id}
                  className={`${styles.friendItem} ${activeFriendId === friend.id ? styles.friendItemActive : ""}`}
                  onClick={() => openChat(friend)}
                >
                  {/* Avatar with online dot */}
                  <div className={styles.avatarWrapper}>
                    <img
                      src={friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                      alt={friend.username}
                      className={styles.friendAvatar}
                    />
                    <span className={`${styles.presenceDot} ${isOnline ? styles.dotOnline : styles.dotOffline}`} />
                  </div>

                  <div className={styles.friendInfo}>
                    <span className={styles.friendName}>{friend.username}</span>
                    <span className={`${styles.friendStatus} ${isOnline ? styles.statusOnline : styles.statusOffline}`}>
                      {isOnline ? "● Online" : "○ Offline"}
                    </span>
                  </div>
                  <span className={styles.chatArrow}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right pane: CometChat Messages UI Kit ─────────────────────── */}
      <div className={styles.messagePane}>
        {loadingChat ? (
          <div className={styles.placeholder}>
            <Spinner />
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>Opening chat…</p>
          </div>
        ) : activeUser ? (
          <CometChatMessages
            user={activeUser}
            key={activeUser.getUid()}
          />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>💬</span>
            <p className={styles.placeholderText}>Select a friend to start chatting</p>
            <p className={styles.placeholderSub}>Only friends appear in this list.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, border: "3px solid var(--border)",
      borderTopColor: "var(--accent)", borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}