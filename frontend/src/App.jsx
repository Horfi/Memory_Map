// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ForceGraph3D } from "react-force-graph";

function App() {
  const [files, setFiles] = useState([]);
  const [levelsData, setLevelsData] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [status, setStatus] = useState("Idle");

  // For zoom-based merging, we track camera distance and switch levels.
  const graphRef = useRef();

  useEffect(() => {
    if (graphRef.current) {
      const camera = graphRef.current.camera();
      // Listen for changes in camera position to pick a level
      const handleRender = () => {
        const dist = camera.position.length();
        // Example logic: if dist>100 => show level0, dist>200 => show level1, etc.
        // We'll do a naive approach:
        if (dist < 150) {
          setCurrentLevel(0);
        } else {
          setCurrentLevel(0); // we only have 1 level in our demo
        }
      };
      // There's no built-in "onFrame" event, so we might just override
      // requestAnimationFrame or do a setInterval. For demo:
      let animId;
      const animate = () => {
        handleRender();
        animId = requestAnimationFrame(animate);
      };
      animate();

      // Cleanup
      return () => cancelAnimationFrame(animId);
    }
  }, []);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setStatus("No files selected.");
      return;
    }
    setStatus("Uploading & Processing...");

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("photos", f));

      // Make a POST request to the Python backend
      const res = await axios.post("http://localhost:5000/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.error) {
        setStatus("Error: " + res.data.error);
        return;
      }
      setLevelsData(res.data.levels); // "levels" array from the server
      setStatus("Got cluster data from server.");
    } catch (err) {
      console.error(err);
      setStatus("Upload/Processing failed: " + err.message);
    }
  };

  // We only have 1 level in the example backend. If you had multiple levels,
  // you'd do something like: const currentGraph = levelsData[currentLevel];
  const currentGraph = levelsData ? levelsData[currentLevel] : { nodes: [], links: [] };

  return (
    <div style={{ background: "#222", height: "100vh", color: "#fff" }}>
      <h1>Photo Cluster 3D Demo</h1>
      <p>{status}</p>
      <div>
        <input type="file" multiple onChange={handleFileChange} />
        <button onClick={handleUpload}>Process/Cluster</button>
      </div>

      {levelsData && (
        <div style={{ width: "100%", height: "80vh" }}>
          <ForceGraph3D
            ref={graphRef}
            graphData={currentGraph}
            nodeAutoColorBy="cluster"
            nodeLabel={(node) => {
              const n = node;
              return `${n.filename}\nCluster: ${n.cluster}\nFaces: ${n.faceCount}\nTime: ${n.dateTime || "N/A"}`;
            }}
            linkColor={() => "rgba(255,255,255,0.5)"}
            backgroundColor="#101020"
          />
        </div>
      )}
    </div>
  );
}

export default App;
