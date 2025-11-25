# Real-Time Follow Request Notifications

## Overview

The follow system now includes **real-time notifications** using Nakama's built-in notification system. When a user sends a follow request, the recipient receives an instant notification via WebSocket, and a badge appears on the navigation bar.

## Features

### ✅ Implemented Features

1. **Real-Time Notification Delivery**
   - Notifications sent instantly when follow requests are sent
   - Notifications sent when follow requests are accepted
   - WebSocket-based delivery (no polling required)

2. **Visual Notification Badge**
   - Red badge on "Follow" navigation link
   - Shows count of pending follow requests
   - Animated pulse effect to draw attention
   - Auto-decrements when requests are accepted/rejected

3. **Browser Notifications**
   - Desktop notifications (if user grants permission)
   - Shows notification even when tab is not active

4. **Auto-Reload on Notification**
   - Automatically reloads request list when new notification arrives
   - Updates UI in real-time without manual refresh

## Architecture

### Backend (Already Implemented)

The backend was already set up with notification sending in `kalpix-backend/src/services/social/follows.go`:

**Notification Types:**
- `follow_request` (Code: 10) - Sent when someone sends you a follow request
- `follow_accepted` (Code: 11) - Sent when someone accepts your follow request

**Notification Content:**
```json
{
  "senderID": "uuid",
  "senderUsername": "username",
  "message": "username sent you a follow request"
}
```

### Frontend Implementation

#### 1. Notification Context (`src/contexts/NotificationContext.js`)

Created a React Context to manage notifications globally:

```javascript
const { 
  notifications,           // Array of all notifications
  unreadCount,            // Total unread count
  followRequestCount,     // Follow request specific count
  decrementFollowRequestCount,  // Decrement badge
  markAsRead,             // Mark notification as read
  clearNotification       // Remove notification
} = useNotifications();
```

**Features:**
- Listens to `socket.onnotification` event
- Parses notification content
- Tracks unread counts
- Triggers browser notifications
- Provides global state to all components

#### 2. Navigation Badge (`src/components/Navigation.js`)

Added notification badge to the Follow link:

```jsx
<NavLink to="/follow">
  <span className="nav-icon">👥</span>
  <span className="nav-text">Follow</span>
  {followRequestCount > 0 && (
    <span className="notification-badge">{followRequestCount}</span>
  )}
</NavLink>
```

**Styling:**
- Red badge with white text
- Positioned absolutely in top-right corner
- Pulse animation to draw attention
- Responsive design

#### 3. Follow System Page (`src/pages/FollowSystemPage.js`)

Enhanced with notification handling:

**Auto-Reload on Notification:**
```javascript
useEffect(() => {
  const latestNotification = notifications[0];
  if (latestNotification?.subject === 'follow_request') {
    if (activeTab === 'requests') {
      loadRequests();  // Auto-reload
    }
    setSuccess(latestNotification.content.message);
  }
}, [notifications]);
```

**Badge Decrement:**
```javascript
const handleAcceptRequest = async (requesterId) => {
  await acceptFollowRequest(client, session, requesterId);
  decrementFollowRequestCount();  // Update badge
  loadRequests();
};
```

## User Experience Flow

### Scenario: User1 sends follow request to User2

1. **User1 Action:**
   - User1 searches for User2
   - Clicks "Follow" button
   - Backend sends notification to User2

2. **User2 Experience (Real-Time):**
   - 🔔 Receives WebSocket notification instantly
   - 🔴 Red badge appears on "Follow" navigation link
   - 🖥️ Browser notification pops up (if permitted)
   - 📱 If on "Requests" tab, list auto-refreshes
   - ✅ Success message appears

3. **User2 Action:**
   - Clicks on "Follow" link (sees badge)
   - Switches to "Requests" tab
   - Sees User1's request
   - Clicks "Accept" or "Reject"
   - Badge count decrements automatically

4. **User1 Experience (Real-Time):**
   - 🔔 Receives "follow_accepted" notification
   - ✅ Success message: "Your follow request was accepted!"
   - 📱 If on "Following" tab, list auto-refreshes

## Technical Details

### WebSocket Connection

The WebSocket connection is established in `MainApp.js`:

```javascript
const newSocket = client.createSocket(false, false);
await newSocket.connect(nakamaSession, false);
```

### Notification Listener

Set up in `NotificationContext.js`:

```javascript
socket.onnotification = (notification) => {
  const newNotification = {
    id: notification.id,
    subject: notification.subject,
    content: JSON.parse(notification.content),
    code: notification.code,
    sender_id: notification.sender_id,
    read: false,
  };
  setNotifications(prev => [newNotification, ...prev]);
  setUnreadCount(prev => prev + 1);
};
```

### Browser Notification Permission

Requested automatically when socket connects:

```javascript
if (Notification.permission === 'default') {
  Notification.requestPermission();
}
```

## Benefits

1. **Instant Feedback** - No need to refresh or poll for updates
2. **Better UX** - Users know immediately when they receive requests
3. **Reduced Server Load** - No polling, only push notifications
4. **Scalable** - Nakama handles WebSocket connections efficiently
5. **Persistent** - Notifications stored in database if user is offline

## Future Enhancements

Potential improvements for the future:

1. **Notification Center** - Dedicated page to view all notifications
2. **Notification Settings** - Allow users to customize notification preferences
3. **Sound Alerts** - Play sound when notification arrives
4. **Mark All as Read** - Bulk action for notifications
5. **Notification History** - View past notifications
6. **Push Notifications** - Mobile push notifications via Firebase

## Testing

To test real-time notifications:

1. **Open two browser windows** (or use incognito mode)
2. **Login as User1** in first window
3. **Login as User2** in second window
4. **User1:** Search for User2 and send follow request
5. **User2:** Should see:
   - Red badge appear on Follow link
   - Browser notification (if permitted)
   - Request appear in list (if on Requests tab)
6. **User2:** Accept the request
7. **User1:** Should see:
   - Success notification
   - User2 appear in Following list

## Conclusion

The real-time notification system provides a modern, responsive user experience for the follow system. Users receive instant feedback when actions occur, making the application feel more interactive and engaging.

