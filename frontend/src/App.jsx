import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import './App.css';

function HomeRoute() {
  return (
    <>
      <Navbar />
      <Home />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/:website_id/chat" element={<ChatPage />} />
      <Route path="/bot/:website_id" element={<ChatPage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
}
