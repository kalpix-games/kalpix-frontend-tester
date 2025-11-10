import React, { useState, useEffect } from 'react';
import { Client } from '@heroiclabs/nakama-js';
import AuthTester from './components/AuthTester';
import './App.css';

/**
 * Standalone Authentication Testing App
 * Dedicated app for testing all authentication endpoints
 */
function AuthTestApp() {
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverConfig, setServerConfig] = useState({
    host: 'localhost',
    port: '7350',
    useSSL: false,
    serverKey: 'defaultkey'
  });
  const [showConfig, setShowConfig] = useState(false);

  // Initialize Nakama client
  useEffect(() => {
    initializeClient();
  }, []);

  const initializeClient = () => {
    try {
      const nakamaClient = new Client(
        serverConfig.serverKey,
        serverConfig.host,
        serverConfig.port,
        serverConfig.useSSL
      );
      setClient(nakamaClient);
      console.log('✅ Nakama client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize client:', error);
    }
  };

  // Connect WebSocket
  const handleConnect = async () => {
    if (!session) {
      alert('Please authenticate first');
      return;
    }

    try {
      const newSocket = client.createSocket(serverConfig.useSSL, false);
      await newSocket.connect(session);
      setSocket(newSocket);
      setIsConnected(true);
      console.log('✅ WebSocket connected');
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      alert('Failed to connect WebSocket: ' + error.message);
    }
  };

  // Disconnect WebSocket
  const handleDisconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      console.log('✅ WebSocket disconnected');
    }
  };

  // Logout
  const handleLogout = () => {
    handleDisconnect();
    setSession(null);
    console.log('✅ Logged out');
  };

  // Update server config
  const handleUpdateConfig = () => {
    initializeClient();
    setShowConfig(false);
  };

  return (
    <div className="App">
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>
          🔐 Authentication System Tester
        </h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
          Test all authentication endpoints and flows
        </p>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Server Configuration */}
        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Server:</strong> {serverConfig.host}:{serverConfig.port} 
              {serverConfig.useSSL ? ' (SSL)' : ''}
            </div>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              style={{
                padding: '8px 16px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ⚙️ {showConfig ? 'Hide' : 'Show'} Config
            </button>
          </div>

          {showConfig && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Host:</label>
                  <input
                    type="text"
                    value={serverConfig.host}
                    onChange={(e) => setServerConfig({...serverConfig, host: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Port:</label>
                  <input
                    type="text"
                    value={serverConfig.port}
                    onChange={(e) => setServerConfig({...serverConfig, port: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Server Key:</label>
                  <input
                    type="text"
                    value={serverConfig.serverKey}
                    onChange={(e) => setServerConfig({...serverConfig, serverKey: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', marginTop: '25px' }}>
                    <input
                      type="checkbox"
                      checked={serverConfig.useSSL}
                      onChange={(e) => setServerConfig({...serverConfig, useSSL: e.target.checked})}
                      style={{ marginRight: '8px' }}
                    />
                    Use SSL
                  </label>
                </div>
              </div>
              <button
                onClick={handleUpdateConfig}
                style={{
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                💾 Update Configuration
              </button>
            </div>
          )}
        </div>

        {/* Connection Status */}
        {session && (
          <div style={{
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>WebSocket:</strong> {isConnected ? '🟢 Connected' : '⚫ Disconnected'}
              </div>
              <div>
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    style={{
                      padding: '8px 16px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    🔌 Connect WebSocket
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    style={{
                      padding: '8px 16px',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    🔌 Disconnect
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '8px 16px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Tester Component */}
        {client ? (
          <AuthTester
            client={client}
            session={session}
            setSession={setSession}
            onAuthSuccess={(newSession) => {
              setSession(newSession);
              console.log('✅ Authentication successful');
            }}
          />
        ) : (
          <div style={{
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <p>Initializing Nakama client...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '20px',
        color: '#666',
        fontSize: '14px',
        marginTop: '40px'
      }}>
        <p>
          Authentication System Tester | Built with React & Nakama
        </p>
        <p style={{ fontSize: '12px', marginTop: '10px' }}>
          Test all authentication flows: Guest, Email Registration, Email Login, Google OAuth, Account Linking
        </p>
      </footer>
    </div>
  );
}

export default AuthTestApp;

