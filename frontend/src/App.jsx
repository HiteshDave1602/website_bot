import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import './App.css';

function ChatRoute() {
  return <ChatPage />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:website_id/chat" element={<ChatRoute />} />
        <Route path="/bot/:website_id" element={<ChatRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
      </Routes>
    </>
  );
}
