import { Routes, Route, Navigate } from "react-router-dom";
import Admin from "./pages/Admin";
import Player from "./pages/Player";

function App() {
  return (
    <div className="min-h-screen bg-gray-800 flex flex-col pt-[6vh] items-center p-3">
      <h1 className="text-4xl font-extrabold text-pink-600 mb-6">
        Pame
      </h1>

      <div className="w-full max-w-2xl text-white bg-gray-600 rounded-2xl ">
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/player" element={<Player />} />
          <Route path="/" element={<Navigate to="/player" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
