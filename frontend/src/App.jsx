//App.jsx

import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import PrepPhotosPage from "./PrepPhotosPage";
import StoryPage from "./StoryPage";

function App() {
  // Top-level state (so all pages can access it):
  const [files, setFiles] = useState([]);
  const [selectedPrepPhotos, setSelectedPrepPhotos] = useState([]);
  const [levelsData, setLevelsData] = useState(null);
  const [userPreferences, setUserPreferences] = useState({
    likedStories: [],
    dislikedStories: [],
    likedPersons: {},
    likedLocations: {},
    likedDates: {},
  });

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
      <Route
        path="/stories"
        element={
          <StoryPage
            levelsData={levelsData}
            userPreferences={userPreferences}
            setUserPreferences={setUserPreferences}
          />
        }
      />
    </Routes>
  );
}

export default App;