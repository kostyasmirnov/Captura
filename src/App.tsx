import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CaptureOverlay from './windows/CaptureOverlay';
import Editor from './windows/Editor';
import History from './windows/History';
import Settings from './windows/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div style={{ width: 1, height: 1 }} />} />
        <Route path="/capture" element={<CaptureOverlay />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
