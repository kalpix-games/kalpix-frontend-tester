import React, { useState, useEffect, useRef } from 'react';
import {
  createChannel,
  getChannels,
  sendChatMessage,
  getMessages,
} from '../utils/nakamaClient';

/**
 * Chat Section Component
 * Handles chat channels, messages, and bot conversations
 */
function ChatSection({ client, session, onEvent }) {
  const [activeTab, setActiveTab] = useState('channels'); // channels, create, messages
  
  // Channels state
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Create channel state
  const [channelType, setChannelType] = useState('direct');
  const [channelName, setChannelName] = useState('');
  const [participantIds, setParticipantIds] = useState('');
  
  // Messages state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Load channels on mount
  useEffect(() => {
    if (session && activeTab === 'channels') {
      loadChannels();
    }
  }, [session, activeTab]);

  // Load messages when channel is selected
  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.channel_id);
    }
  }, [selectedChannel]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChannels = async () => {
    try {
      const result = await getChannels(client, session);
      setChannels(result.channels || []);
      onEvent('channels_loaded', `Loaded ${result.channels?.length || 0} channels`, 'success');
    } catch (error) {
      onEvent('channels_error', `Failed to load channels: ${error.message}`, 'error');
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim() && channelType !== 'direct') {
      onEvent('validation_error', 'Channel name is required', 'error');
      return;
    }

    if (!participantIds.trim()) {
      onEvent('validation_error', 'Participant IDs are required', 'error');
      return;
    }

    try {
      const participantArray = participantIds.split(',').map(id => id.trim()).filter(id => id);
      const result = await createChannel(client, session, channelType, channelName, participantArray);
      onEvent('channel_created', 'Channel created successfully', 'success');
      setChannelName('');
      setParticipantIds('');
      setActiveTab('channels');
      loadChannels();
    } catch (error) {
      onEvent('channel_error', `Failed to create channel: ${error.message}`, 'error');
    }
  };

  const loadMessages = async (channelId) => {
    try {
      setMessagesLoading(true);
      const result = await getMessages(client, session, channelId, 50);
      setMessages(result.messages || []);
      onEvent('messages_loaded', `Loaded ${result.messages?.length || 0} messages`, 'info');
    } catch (error) {
      onEvent('messages_error', `Failed to load messages: ${error.message}`, 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChannel) return;

    try {
      await sendChatMessage(client, session, selectedChannel.channel_id, messageInput);
      setMessageInput('');
      onEvent('message_sent', 'Message sent', 'success');
      // Reload messages to show the new one
      loadMessages(selectedChannel.channel_id);
    } catch (error) {
      onEvent('message_error', `Failed to send message: ${error.message}`, 'error');
    }
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setActiveTab('messages');
  };

  if (!session) {
    return (
      <div className="section">
        <h2>💬 Chat</h2>
        <p style={{ color: '#888' }}>Please authenticate first</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>💬 Chat</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
        <button
          onClick={() => setActiveTab('channels')}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: activeTab === 'channels' ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Channels
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: activeTab === 'create' ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Create
        </button>
        {selectedChannel && (
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: activeTab === 'messages' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Messages
          </button>
        )}
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div>
          <button onClick={loadChannels} style={{ marginBottom: '10px', width: '100%' }}>
            🔄 Refresh Channels
          </button>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {channels.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center' }}>No channels yet</p>
            ) : (
              channels.map((channel) => (
                <div
                  key={channel.channel_id}
                  onClick={() => handleSelectChannel(channel)}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: selectedChannel?.channel_id === channel.channel_id ? '#e7f3ff' : '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {channel.channel_type === 'bot' && '🤖 '}
                    {channel.channel_type === 'group' && '👥 '}
                    {channel.channel_type === 'direct' && '💬 '}
                    {channel.name || 'Direct Message'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Type: {channel.channel_type}
                  </div>
                  {channel.last_message && (
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                      {channel.last_message.substring(0, 50)}...
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Channel Tab */}
      {activeTab === 'create' && (
        <div>
          <div className="form-group">
            <label>Channel Type:</label>
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="direct">Direct Message</option>
              <option value="group">Group Chat</option>
              <option value="bot">Bot Chat</option>
            </select>
          </div>

          <div className="form-group">
            <label>Channel Name {channelType === 'direct' ? '(optional)' : '(required)'}:</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="My Channel"
            />
          </div>

          <div className="form-group">
            <label>Participant User IDs (comma-separated):</label>
            <input
              type="text"
              value={participantIds}
              onChange={(e) => setParticipantIds(e.target.value)}
              placeholder="user_id_1, user_id_2"
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              For bot chat, use bot user IDs like bot_1, bot_2, etc.
            </small>
          </div>

          <button onClick={handleCreateChannel} style={{ width: '100%' }}>
            ➕ Create Channel
          </button>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && selectedChannel && (
        <div>
          <div
            style={{
              padding: '10px',
              backgroundColor: '#e7f3ff',
              borderRadius: '6px',
              marginBottom: '10px',
              fontSize: '14px',
            }}
          >
            <strong>
              {selectedChannel.channel_type === 'bot' && '🤖 '}
              {selectedChannel.channel_type === 'group' && '👥 '}
              {selectedChannel.channel_type === 'direct' && '💬 '}
              {selectedChannel.name || 'Direct Message'}
            </strong>
            <button
              onClick={() => loadMessages(selectedChannel.channel_id)}
              style={{ float: 'right', fontSize: '12px', padding: '4px 8px' }}
            >
              🔄 Refresh
            </button>
          </div>

          {/* Messages List */}
          <div
            style={{
              height: '300px',
              overflowY: 'auto',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '10px',
            }}
          >
            {messagesLoading ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Loading messages...</p>
            ) : messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>No messages yet</p>
            ) : (
              messages.map((msg) => {
                const isMyMessage = msg.sender_id === session.user_id;
                return (
                  <div
                    key={msg.message_id}
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        backgroundColor: isMyMessage ? '#007bff' : 'white',
                        color: isMyMessage ? 'white' : 'black',
                      }}
                    >
                      {!isMyMessage && (
                        <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                          {msg.sender_username || 'Unknown'}
                        </div>
                      )}
                      <div>{msg.content}</div>
                      <div
                        style={{
                          fontSize: '10px',
                          marginTop: '4px',
                          opacity: 0.7,
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '8px' }}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} style={{ padding: '8px 16px' }}>
              📤 Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatSection;

