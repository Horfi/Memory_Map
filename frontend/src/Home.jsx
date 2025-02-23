// Home.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from "three";
import "./App.css";

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
  const graphRef = useRef();
  const navigate = useNavigate();

  // Auto-fit the graph whenever we get new data or change level
  useEffect(() => {
    if (graphRef.current && levelsData) {
      graphRef.current.zoomToFit(400);
    }
  }, [levelsData, currentLevel]);

  // Handle local file input
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  // Upload local files + references to selected prep photos
  const handleUpload = async () => {
    if (!files.length && !selectedPrepPhotos.length) {
      setStatus("No local files or prepared photos selected.");
      return;
    }
    setStatus("Uploading & Processing...");
    setIsLoading(true);

    try {
      const formData = new FormData();

      // Append user-uploaded files
      files.forEach((f) => formData.append("photos", f));

      // Append references to selected prep photos
      selectedPrepPhotos.forEach((p) => formData.append("prepPhotos", p));

      // If using Vite, you can do:
      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
      // If using CRA, you'd do:
      // const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";

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
    const distance = 100;
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
        {/* Local file input */}
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

        {/* Button to go to the prepared photos page */}
        <button onClick={() => navigate("/prep-photos")}>
          Select from Prepared Photos
        </button>

        {/* Trigger the cluster process */}
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
        <section className="graph-container">
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
