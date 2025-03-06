// App.jsx
import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import PrepPhotosPage from "./PrepPhotosPage";

function App() {
  // 1. Put top-level state here (so both pages can access it):
  const [files, setFiles] = useState([]);
  const [selectedPrepPhotos, setSelectedPrepPhotos] = useState([]);
  const [levelsData, setLevelsData] = useState(null);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Home
            files={files}
            setFiles={setFiles}
            selectedPrepPhotos={selectedPrepPhotos}
            setSelectedPrepPhotos={setSelectedPrepPhotos}
            levelsData={levelsData}
            setLevelsData={setLevelsData}
          />
        }
      />
      <Route
        path="/prep-photos"
        element={
          <PrepPhotosPage
            selectedPrepPhotos={selectedPrepPhotos}
            setSelectedPrepPhotos={setSelectedPrepPhotos}
          />
        }
      />
    </Routes>
  );
}

export default App;
