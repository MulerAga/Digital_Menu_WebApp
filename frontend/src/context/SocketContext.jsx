import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);

  const clearNewOrderCount = () => setNewOrderCount(0);

  const connect = (token) => {
    if (socketRef.current?.connected) return;
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });
    s.on('connect', () => {
      setConnected(true);
      setSocket(s); // trigger re-render so consumers get the live instance
    });
    s.on('disconnect', () => setConnected(false));
    s.on('new_order', () => setNewOrderCount((c) => c + 1));
    socketRef.current = s;
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) connect(token);
    return () => disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, connect, disconnect, newOrderCount, clearNewOrderCount }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
