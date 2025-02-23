import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from "three";
import "./App.css"; // Make sure we have our styles

function Home({
  files,
  setFiles,
  selectedPrepPhotos,
  setSelectedPrepPhotos,
  levelsData,
  setLevelsData,
}) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false); // Track if fullscreen is active
  const graphRef = useRef();
  const navigate = useNavigate();

  // Whenever we have new data or change level, zoom/center the graph
  useEffect(() => {
    if (graphRef.current && levelsData) {
      // Wait a moment for the ForceGraph to finalize layout
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 50); 
      }, 500);
    }
  }, [levelsData, currentLevel]);

  // Also re-center on window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && levelsData) {
        graphRef.current.zoomToFit(400, 50);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [levelsData]);

  // Listen for native fullscreen change events to update isFullscreen state
  useEffect(() => {
    const onFullScreenChange = () => {
      // If document.fullscreenElement is our container, we are in fullscreen
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  // Upload local + selected prep
  const handleUpload = async () => {
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
    let localFiles = files;
    let prepFiles = selectedPrepPhotos;
  
    // If no local or selected prep photos, automatically fetch all from the prepPhotos folder
    if (!localFiles.length && !prepFiles.length) {
      try {
        const response = await axios.get(`${apiUrl}/prep-photos-list`);
        if (response.data && Array.isArray(response.data)) {
          prepFiles = response.data;
          setSelectedPrepPhotos(prepFiles);
        }
      } catch (error) {
        setStatus("Failed to load prepared photos: " + error.message);
        return;
      }
    }
  
    setStatus("Uploading & Processing...");
    setIsLoading(true);
  
    try {
      const formData = new FormData();
  
      // Append user-uploaded files
      localFiles.forEach((f) => formData.append("photos", f));
  
      // Append references to selected prep photos (if any)
      prepFiles.forEach((p) => formData.append("prepPhotos", p));
  
      const res = await axios.post(`${apiUrl}/process`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
  
      if (res.data.error) {
        setStatus("Error: " + res.data.error);
        return;
      }
      setLevelsData(res.data.levels);
      setStatus("Got cluster data from server!");
    } catch (err) {
      console.error(err);
      setStatus("Upload/Processing failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  

  // Toggle fullscreen on the container
  const handleFullscreenToggle = () => {
    const container = document.getElementById("graph-container");
    if (!document.fullscreenElement) {
      // Enter fullscreen
      container.requestFullscreen && container.requestFullscreen();
    } else {
      // Exit fullscreen
      document.exitFullscreen && document.exitFullscreen();
    }
  };

  // Decide which cluster level to show
  const currentGraph = levelsData
    ? levelsData[currentLevel]
    : { nodes: [], links: [] };

  // Turn each node into a sprite with its photo.
  const nodeThreeObject = (node) => {
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
    const fullImageUrl = new URL(node.imageUrl, apiUrl).href;
    const imgTexture = new THREE.TextureLoader().load(fullImageUrl);
    const spriteMaterial = new THREE.SpriteMaterial({ map: imgTexture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(20, 20, 1);
    return sprite;
  };

  // Center and zoom on node click
  const handleNodeClick = (node) => {
    if (!graphRef.current) return;
    const distance = 85;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    graphRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      { x: node.x, y: node.y, z: node.z },
      1000
    );
  };

  return (
    <div id="root">
      <header>
        <h1>Photo Cluster 3D Demo</h1>
        <p className="status">{status}</p>
      </header>

      <section className="upload-section">
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileChange}
          className="file-input"
        />
        <label htmlFor="file-upload" className="custom-file-upload">
          Choose Files
        </label>

        <button onClick={() => navigate("/prep-photos")}>
          Select from Prepared Photos
        </button>

        <button onClick={handleUpload}>Process/Cluster</button>
      </section>

      <p style={{ marginTop: "0.5rem" }}>
        Local Files: {files.length} | Prepared Photos: {selectedPrepPhotos.length}
      </p>

      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {levelsData && (
        <section className="graph-container" id="graph-container">
          {/* Fullscreen toggle button (larger, top-right corner) */}
          <button className="fullscreen-btn" onClick={handleFullscreenToggle}>
            {isFullscreen ? "×" : "⛶"}
          </button>

          {/* If in fullscreen, show a hint at bottom-center */}
          {isFullscreen && (
            <div className="fullscreen-hint">
              Press ESC or click the button again to exit fullscreen.
            </div>
          )}

          <ForceGraph3D
            ref={graphRef}
            graphData={currentGraph}
            nodeAutoColorBy="cluster"
            nodeThreeObject={nodeThreeObject}
            nodeLabel={(node) => `
              <div style="text-align:left;">
                <strong>${node.filename}</strong><br/>
                Faces: ${node.faceCount}<br/>
                Date: ${node.dateTime || "N/A"}<br/>
                Lat: ${node.lat.toFixed(4)}, Lon: ${node.lon.toFixed(4)}
              </div>
            `}
            linkColor={() => "rgba(255,255,255,0.4)"}
            backgroundColor="#101020"
            onNodeClick={handleNodeClick}
            enableNodeDrag={true}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
          />
        </section>
      )}
    </div>
  );
}

export default Home;
