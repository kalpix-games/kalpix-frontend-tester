import React from 'react';

/**
 * Authentication Section Component
 * Handles device authentication and session management
 */
function AuthSection({ 
  client, 
  session, 
  isConnected,
  authForm,
  setAuthForm,
  onAuthenticate,
  onConnect,
  onDisconnect
}) {
  return (
    <div className="section">
      <h2>🔐 Authentication</h2>
      
      {/* Status Display */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '10px', 
        backgroundColor: session ? '#d4edda' : '#f8d7da',
        borderRadius: '6px',
        fontSize: '14px'
      }}>
        <div><strong>Client:</strong> {client ? '✅ Ready' : '❌ Not initialized'}</div>
        <div><strong>Session:</strong> {session ? `✅ ${session.username}` : '❌ Not authenticated'}</div>
        <div><strong>WebSocket:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
      </div>

      {/* Authentication Form */}
      {!session && (
        <div>
          <div className="form-group">
            <label>Device ID:</label>
            <input
              type="text"
              value={authForm.deviceId}
              onChange={(e) => setAuthForm({ ...authForm, deviceId: e.target.value })}
              placeholder="device_123456"
            />
          </div>

          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              value={authForm.username}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              placeholder="TestPlayer1"
            />
          </div>

          <button 
            className="btn-primary" 
            onClick={onAuthenticate}
            disabled={!client || !authForm.deviceId || !authForm.username}
          >
            🔐 Authenticate
          </button>
        </div>
      )}

      {/* Connection Controls */}
      {session && (
        <div className="button-group">
          {!isConnected ? (
            <button className="btn-success" onClick={onConnect}>
              🔌 Connect WebSocket
            </button>
          ) : (
            <button className="btn-danger" onClick={onDisconnect}>
              🔌 Disconnect
            </button>
          )}
        </div>
      )}

      {/* Session Info */}
      {session && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#e9ecef',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <div><strong>User ID:</strong> {session.user_id}</div>
          <div><strong>Username:</strong> {session.username}</div>
        </div>
      )}
    </div>
  );
}

export default AuthSection;

