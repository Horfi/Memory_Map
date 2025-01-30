// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from 'three'; // Import THREE for textures
import "./App.css"; // Ensure this path is correct

function App() {
  const [files, setFiles] = useState([]);
  const [levelsData, setLevelsData] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [isLoading, setIsLoading] = useState(false);

  const graphRef = useRef();

  // Center the graph whenever levelsData or currentLevel changes
  useEffect(() => {
    if (graphRef.current && levelsData) {
      graphRef.current.zoomToFit(400); // Duration in ms
    }
  }, [levelsData, currentLevel]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setStatus("No files selected.");
      return;
    }
    setStatus("Uploading & Processing...");
    setIsLoading(true); // Start loading

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("photos", f));

      const res = await axios.post("http://localhost:5000/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.error) {
        setStatus("Error: " + res.data.error);
        return;
      }
      setLevelsData(res.data.levels);
      setStatus("Got cluster data from server.");
    } catch (err) {
      console.error(err);
      setStatus("Upload/Processing failed: " + err.message);
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  const currentGraph = levelsData ? levelsData[currentLevel] : { nodes: [], links: [] };

  // Function to create a node with image texture
  const nodeThreeObject = (node) => {
    // Create a sprite material with the image texture
    const imgTexture = new THREE.TextureLoader().load(node.imageUrl);
    const spriteMaterial = new THREE.SpriteMaterial({ map: imgTexture });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(20, 20, 1); // Adjust size as needed

    return sprite;
  };

  // Function to handle node click to focus
  const handleNodeClick = (node) => {
    // Center the graph on the clicked node
    graphRef.current.centerAt(node.x, node.y, node.z, 1000); // duration 1000ms
    graphRef.current.zoom(8, 1000); // adjust zoom level and duration
  };

  // Function to handle zoom and switch levels
  const handleZoom = (currZoom) => {
    // Define zoom thresholds and corresponding levels
    if (currZoom > 8 && currentLevel !== 0) {
      setCurrentLevel(0);
    } else if (currZoom > 4 && currentLevel !== 1) {
      setCurrentLevel(1);
    } else if (currentLevel !== 2) {
      setCurrentLevel(2);
    }
  };

  return (
    <div id="root">
      <header>
        <h1>Photo Cluster 3D Demo</h1>
        <p className="status">{status}</p>
      </header>

      <section className="upload-section">
        {/* Hidden File Input */}
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileChange}
          className="file-input"
        />

        {/* Styled Label Acting as Button */}
        <label htmlFor="file-upload" className="custom-file-upload">
          Choose Files
        </label>

        {/* Process/Cluster Button */}
        <button onClick={handleUpload}>Process/Cluster</button>
      </section>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {/* 3D Graph Visualization */}
      {levelsData && (
        <section className="graph-container">
          <ForceGraph3D
            ref={graphRef}
            graphData={currentGraph}
            nodeAutoColorBy="cluster"
            nodeThreeObject={nodeThreeObject} // Use custom node object
            nodeLabel={(node) => {
              const n = node;
              return `
                <div style="text-align: center;">
                  <img src="${n.imageUrl}" alt="${n.filename}" style="width: 100px; height: auto;" />
                  <p>${n.filename}</p>
                  <p>Cluster: ${n.cluster}</p>
                  <p>Faces: ${n.faceCount}</p>
                  <p>Time: ${n.dateTime || "N/A"}</p>
                </div>
              `;
            }}
            linkColor={() => "rgba(255,255,255,0.5)"}
            backgroundColor="#101020"
            onNodeClick={handleNodeClick} // Handle node click to focus
            onZoom={handleZoom} // Handle zoom to switch levels
            enableNodeDrag={true} // Enable node dragging
            linkDirectionalArrowLength={5} // Optional: add arrows to links
            linkDirectionalArrowRelPos={1} // Optional: position arrows
          />
        </section>
      )}
    </div>
  );
}

export default App;
