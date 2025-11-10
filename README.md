# UNO Nakama Backend Tester

A comprehensive React-based testing interface for the UNO Ultimate Nakama backend. This tool allows you to test all backend functionality without building a complete frontend.

## 🎯 Purpose

This testing application provides:
- **Authentication testing** with email/password
- **Match creation and joining** for all game modes
- **Real-time WebSocket communication** testing
- **Game action simulation** (card play, draw, special cards)
- **Animation synchronization** testing
- **Error handling** validation
- **RPC function** testing
- **Complete game flow** simulation

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Nakama server running on `localhost:7350`
- UNO Ultimate backend module loaded

### Installation
```bash
# Navigate to the project directory
cd uno-react-tester

# Install dependencies (if not already done)
npm install

# Start the development server
npm start
```

The application will open at `http://localhost:3000`

## 📋 Features

### 🔐 Authentication
- Email/password authentication
- Automatic WebSocket connection
- Session management
- Token validation

### 🎯 Match Management
- Create matches (2p, 3p, 4p, 2v2)
- Private and random match types
- **Match ID display and copy functionality**
- **Join matches by pasting Match ID**
- Join/leave match functionality
- Match state monitoring

### 🎮 Game Actions (Backend Supported)
- **start_game**: Initialize game session
- **start_card_distribution**: Begin card dealing
- **cards_distributed_complete**: Confirm distribution finished
- **play_card**: Play a card with optional color selection
- **draw_card**: Draw from deck
- **play_shield**: Use shield defensive card
- **choose_swap_target**: Select target for hand swap (Zero card)
- **jump_in**: Jump in with matching card
- **autoplay_turn**: Auto-play current turn
- **animation_started/animation_complete**: Animation synchronization

### 🎬 Animation Synchronization
- Animation started/complete events
- Event ID tracking
- Duration timing
- Animation type selection

### 🧪 Advanced Testing
- **Full Game Simulation**: Complete automated game flow
- **Special Cards Testing**: Wild Draw Four, Shield, Skip Blast, Zero swap
- **Animation Sequence Testing**: Full animation cycle simulation
- **Error Handling Testing**: Invalid actions and edge cases

### 🔧 RPC Testing
- Test all backend RPC functions
- Custom RPC execution
- User statistics retrieval
- Match creation validation

### 🔌 Connection Testing
- WebSocket disconnect/reconnect
- Connection stability testing
- Network interruption simulation

## 📊 Monitoring and Debugging

### Browser Console
All responses and events are logged to the browser console with:
- **Timestamps** for each action
- **Detailed event data** from WebSocket
- **Error messages** with full stack traces
- **Request/response pairs** for debugging

### Status Information
Real-time display of:
- Client initialization status
- Authentication session details
- WebSocket connection state
- Current match information
- User and token details

## 🎮 Testing Workflows

### Basic Testing Flow
1. Click **"🔐 Authenticate Device"** to authenticate with device ID
2. Click **"🎯 Create Match"** to create a UNO game
3. **Copy the Match ID** from the displayed match info
4. Click **"🚪 Join Current Match"** or paste Match ID in "Join by Match ID" section
5. Click **"🧪 Run Quick Test"** for automated testing

### Manual Testing
1. Use **Game Actions** section for individual actions
2. Use **Animation Sync** for animation testing
3. Use **Advanced Testing** for comprehensive scenarios
4. Monitor console for detailed responses

### Automated Testing
- **Quick Test**: Basic game flow (auth → create → join → start)
- **Full Game Simulation**: Complete game with special cards and animations
- **RPC Testing**: All backend RPC functions
- **Error Testing**: Invalid actions and edge cases

## 🔧 Configuration

### Backend Requirements
- Nakama server on `localhost:7350`
- UNO Ultimate Go module loaded
- Required RPCs: `create_uno_match`, `get_user_stats`
- WebSocket endpoint enabled

### Default Test Data
- **Device ID**: `device_[timestamp]` (auto-generated)
- **Username**: `TestPlayer1`
- **Game Mode**: `2p`
- **Match Type**: `private`

## 📝 Testing Scenarios

### Authentication Testing
- Device ID authentication (Nakama's device authentication)
- Automatic account creation for new device IDs
- Session token validation
- WebSocket auto-connection after authentication

### Match Testing
- All game modes (2p, 3p, 4p, 2v2)
- Private and random match types
- Match creation and joining
- Host and participant roles

### Gameplay Testing
- Card play actions with validation
- Draw card mechanics
- Special card effects
- Animation synchronization
- Turn management
- Timer functionality

### Special Cards Testing
- **Wild Draw Four**: Color selection and stacking
- **Shield**: Defensive play mechanics
- **Zero Card**: Hand swap functionality
- **Skip Blast**: Multi-player skip effects
- **Blue Thunder**: Force blue mechanics
- **Red Fury**: Color lock effects

### Error Handling Testing
- Invalid card IDs
- Out-of-turn actions
- Invalid action types
- Network disconnections
- Malformed data

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Ensure Nakama server is running on `localhost:7350`
- Check if WebSocket endpoint is enabled
- Verify authentication is successful first

**RPC Errors**
- Confirm UNO backend module is loaded
- Check RPC function names match backend implementation
- Verify session token is valid

**Match Creation Failed**
- Check game mode and match type values
- Ensure user is authenticated
- Verify backend RPC is working

### Debug Tips
1. **Open Browser Console (F12)** for detailed logs
2. **Check Network Tab** for failed requests
3. **Monitor WebSocket frames** in Network tab
4. **Use Status Information** section for current state
5. **Try Quick Test** for basic functionality validation

## 🔍 Console Log Examples

```javascript
// Authentication success
[10:30:15] ✅ Authentication successful {userId: "uuid-123", username: "TestPlayer1"}

// Match creation
[10:30:20] ✅ Match created successfully {matchId: "match-456", gameMode: "2p"}

// WebSocket events
[10:30:25] 📨 Match data received {event: "game_started", data: {...}}

// Game actions
[10:30:30] 📤 Quick action sent: play_card {cardId: 42, color: 1}
```

## 🎯 Next Steps

After testing with this tool:
1. **Verify all backend functionality** works as expected
2. **Document any issues** found during testing
3. **Use test scenarios** as reference for frontend development
4. **Implement proper error handling** based on test results
5. **Optimize backend performance** based on testing feedback

## 📚 Related Documentation

- [UNO Backend Events and Actions](../UNO_BACKEND_EVENTS_AND_ACTIONS.md)
- [Postman Testing Guide](../POSTMAN_TESTING_GUIDE.md)
- [Comprehensive Testing Guide](../COMPREHENSIVE_NAKAMA_TESTING_GUIDE.md)
- [Nakama Documentation](https://heroiclabs.com/docs/nakama/)

---

**Happy Testing! 🎮✨**
