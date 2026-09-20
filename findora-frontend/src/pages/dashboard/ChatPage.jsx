// src/pages/dashboard/ChatPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { MessageSquare, Send } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => fetchMessages(selectedChat.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  const fetchChats = async () => {
    try {
      const { data } = await chatAPI.getChats();
      setChats(data.chats);
      if (data.chats.length > 0 && !selectedChat) {
        setSelectedChat(data.chats[0]);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const { data } = await chatAPI.getMessages(chatId);
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await chatAPI.sendMessage(selectedChat.id, newMessage);
      setNewMessage('');
      fetchMessages(selectedChat.id);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-600">Chat with other users</p>
      </div>

      {chats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No conversations yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chat List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">{chat.otherUser?.displayName}</p>
                    {chat.lastMessage && (
                      <>
                        <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeTime(chat.lastMessageAt)}
                        </p>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{selectedChat?.otherUser?.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.senderId === user?.uid
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.senderId === user?.uid ? 'text-blue-200' : 'text-gray-500'}`}>
                        {formatRelativeTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" loading={sending}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
