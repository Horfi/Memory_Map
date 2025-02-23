import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ForceGraph3D } from "react-force-graph";
import * as THREE from "three"; // for texture loading
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
      graphRef.current.zoomToFit(400);
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

      // Use the backend API URL, defaulting to your Azure endpoint if not set.
      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "https://backend.icydesert-7cf8a089.polandcentral.azurecontainerapps.io";
      
      // Post the form data to the backend /process endpoint.
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

  // Decide which level to show
  const currentGraph = levelsData ? levelsData[currentLevel] : { nodes: [], links: [] };

  // Turn each node into a sprite with its photo.
  // Here we prepend the backend URL to the relative image URL.
  const nodeThreeObject = (node) => {
    // Use the same apiUrl as used in handleUpload (for consistency)
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "https://backend.icydesert-7cf8a089.polandcentral.azurecontainerapps.io";
    const fullImageUrl = new URL(node.imageUrl, apiUrl).href;

    const imgTexture = new THREE.TextureLoader().load(fullImageUrl);
    const spriteMaterial = new THREE.SpriteMaterial({ map: imgTexture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(20, 20, 1);
    return sprite;
  };

  // Center and zoom on click
  const handleNodeClick = (node) => {
    if (!graphRef.current) return;
    graphRef.current.centerAt(node.x, node.y, node.z, 1000);
    graphRef.current.zoom(8, 1000);
  };

  // Zoom logic to switch levels
  const handleZoom = (currZoom) => {
    if (!levelsData) return;
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
        <button onClick={handleUpload}>Process/Cluster</button>
      </section>

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
