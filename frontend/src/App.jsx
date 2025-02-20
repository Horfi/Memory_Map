import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from 'three'; // for texture loading
import "./App.css";

function App() {
  const [files, setFiles] = useState([]);
  const [levelsData, setLevelsData] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [isLoading, setIsLoading] = useState(false);

  const graphRef = useRef();

  // Auto-fit the graph whenever we get new data or change level
  useEffect(() => {
    if (graphRef.current && levelsData) {
      graphRef.current.zoomToFit(400); // 400 ms animation
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
    setIsLoading(true);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("photos", f));

      // POST to the Flask server on port 5000
      const res = await axios.post("http://localhost:5000/process", formData, {
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

  // Decide which level to show
  const currentGraph = levelsData
    ? levelsData[currentLevel]
    : { nodes: [], links: [] };

  // Turn each node into a sprite with its photo
  const nodeThreeObject = (node) => {
    const imgTexture = new THREE.TextureLoader().load(node.imageUrl);
    const spriteMaterial = new THREE.SpriteMaterial({ map: imgTexture });
    const sprite = new THREE.Sprite(spriteMaterial);
    // Scale up or down as needed
    sprite.scale.set(20, 20, 1);
    return sprite;
  };

  // Center and zoom on click
  const handleNodeClick = (node) => {
    if (!graphRef.current) return;
    graphRef.current.centerAt(node.x, node.y, node.z, 1000);
    graphRef.current.zoom(8, 1000);
  };

  // Example zoom logic to switch levels
  const handleZoom = (currZoom) => {
    if (!levelsData) return;
    // If zoom is large, show finer clusters (level 0)
    if (currZoom > 8 && currentLevel !== 0) {
      setCurrentLevel(0);
    }
    // If zoom is medium, show next level
    else if (currZoom > 4 && currentLevel !== 1) {
      setCurrentLevel(1);
    }
    // Else show the coarsest level
    else if (currentLevel !== 2) {
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
        {/* Hidden file input */}
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

        {/* Button to upload/process */}
        <button onClick={handleUpload}>Process/Cluster</button>
      </section>

      {/* Loading spinner if needed */}
      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {/* Render 3D graph once we have data */}
      {levelsData && (
        <section className="graph-container">
          <ForceGraph3D
            ref={graphRef}
            graphData={currentGraph}
            nodeAutoColorBy="cluster"
            nodeThreeObject={nodeThreeObject}
            // For a tooltip, we can return a simple string:
            nodeLabel={(node) => `${node.filename} (Faces: ${node.faceCount})`}
            linkColor={() => "rgba(255,255,255,0.5)"}
            backgroundColor="#101020"
            onNodeClick={handleNodeClick}
            onZoom={handleZoom}
            enableNodeDrag={true}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
          />
        </section>
      )}
    </div>
  );
}

export default App;
