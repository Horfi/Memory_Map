import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Changed from single highlightedNode to a Map tracking all highlighted nodes
  const [highlightedNodes, setHighlightedNodes] = useState(new Map());
  // Maximum highlight level constant
  const MAX_HIGHLIGHT_LEVEL = 7; // Increased number of highlight levels
  const graphRef = useRef();
  const graphContainerRef = useRef();
  const navigate = useNavigate();
  
  // Texture management with loading queue
  const textureCache = useRef({});
  const lowResTextureCache = useRef({});
  const placeholderTexture = useRef();
  const textureLoadQueue = useRef([]);
  const isProcessingQueue = useRef(false);
  
  // Create a reusable placeholder texture
  useEffect(() => {
    // Create a simple colored canvas as placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, 64, 64);
    
    // Add some visual cue that it's loading
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, 2 * Math.PI);
    ctx.fill();
    
    placeholderTexture.current = new THREE.CanvasTexture(canvas);
    
    return () => {
      // Clean up textures on unmount
      Object.values(textureCache.current).forEach(texture => texture.dispose());
      Object.values(lowResTextureCache.current).forEach(texture => texture.dispose());
      placeholderTexture.current?.dispose();
    };
  }, []);
  
  // Process texture loading queue
  const processTextureQueue = useCallback(() => {
    if (isProcessingQueue.current || textureLoadQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    const { url, priority, nodeId, callback } = textureLoadQueue.current.shift();
    
    // If it's already cached, use that
    if (textureCache.current[url]) {
      callback(textureCache.current[url]);
      isProcessingQueue.current = false;
      setTimeout(processTextureQueue, 0);
      return;
    }
    
    // Load texture
    new THREE.TextureLoader().load(
      url,
      texture => {
        textureCache.current[url] = texture;
        callback(texture);
        isProcessingQueue.current = false;
        setTimeout(processTextureQueue, 0);
      },
      undefined,
      error => {
        console.error("Error loading texture:", error);
        callback(placeholderTexture.current);
        isProcessingQueue.current = false;
        setTimeout(processTextureQueue, 0);
      }
    );
  }, []);
  
  // Queue a texture for loading with priority
  const queueTextureLoad = useCallback((url, priority, nodeId, callback) => {
    // Skip if already cached
    if (textureCache.current[url]) {
      callback(textureCache.current[url]);
      return;
    }
    
    // Remove any existing queue items for this node
    textureLoadQueue.current = textureLoadQueue.current.filter(item => item.nodeId !== nodeId);
    
    // Add to queue with priority
    textureLoadQueue.current.push({ url, priority, nodeId, callback });
    
    // Sort queue by priority (higher first)
    textureLoadQueue.current.sort((a, b) => b.priority - a.priority);
    
    // Start processing if not already
    if (!isProcessingQueue.current) {
      processTextureQueue();
    }
  }, [processTextureQueue]);
  
  // Create low-resolution version of textures
  const createLowResTexture = useCallback((url, callback) => {
    // If already in low-res cache, use that
    if (lowResTextureCache.current[url]) {
      callback(lowResTextureCache.current[url]);
      return;
    }
    
    // Load full image to an image element
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // Create a small canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Downscale to 64x64
      canvas.width = 64;
      canvas.height = 64;
      
      // Draw image downscaled
      ctx.drawImage(img, 0, 0, 64, 64);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      lowResTextureCache.current[url] = texture;
      callback(texture);
    };
    img.onerror = () => {
      callback(placeholderTexture.current);
    };
    img.src = url;
  }, []);
  
  // Center the graph with optimized parameters
  const centerGraph = useCallback(() => {
    if (graphRef.current && levelsData) {
      // Use shorter timeout for better responsiveness
      setTimeout(() => {
        graphRef.current.zoomToFit(300, 30);
        
        if (!isFullscreen && graphContainerRef.current) {
          const graph = graphRef.current;
          const graphData = levelsData[currentLevel];
          if (graphData && graphData.nodes.length > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            graphData.nodes.forEach(node => {
              sumX += node.x || 0;
              sumY += node.y || 0;
              sumZ += node.z || 0;
            });
            const centerX = sumX / graphData.nodes.length;
            const centerY = sumY / graphData.nodes.length;
            const centerZ = sumZ / graphData.nodes.length;
            
            graph.cameraPosition(
              { x: centerX, y: centerY, z: centerZ + 300 },
              { x: centerX, y: centerY, z: centerZ },
              400  // Faster transition time
            );
          }
        }
      }, 300); // Shorter timeout
    }
  }, [levelsData, currentLevel, isFullscreen]);

  // Recenter when level or fullscreen changes
  useEffect(() => {
    centerGraph();
  }, [levelsData, currentLevel, centerGraph]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => centerGraph();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [centerGraph]);

  // Handle fullscreen state changes
  useEffect(() => {
    const onFullScreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(centerGraph, 200);
    };
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, [centerGraph]);

  // Preload low-res textures when level data changes
  useEffect(() => {
    if (levelsData && levelsData[currentLevel]) {
      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
      
      // Initialize nodes with placeholder textures and load low-res versions
      levelsData[currentLevel].nodes.forEach((node, index) => {
        const fullImageUrl = new URL(node.imageUrl, apiUrl).href;
        
        // Load low-res first for all visible nodes
        createLowResTexture(fullImageUrl, () => {
          // Force a small update to trigger re-render of this node
          if (graphRef.current) {
            graphRef.current.refresh();
          }
        });
        
        // If this is one of the first few nodes, prioritize loading full texture
        if (index < 8) {
          queueTextureLoad(
            fullImageUrl, 
            10 - index, // Priority based on index
            node.id,
            () => {
              if (graphRef.current) {
                graphRef.current.refresh();
              }
            }
          );
        }
      });
    }
  }, [levelsData, currentLevel, createLowResTexture, queueTextureLoad]);

  const handleFileChange = event => {
    setFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
    let localFiles = files;
    let prepFiles = selectedPrepPhotos;

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
      localFiles.forEach(f => formData.append("photos", f));
      prepFiles.forEach(p => formData.append("prepPhotos", p));

      const res = await axios.post(`${apiUrl}/process`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.error) {
        setStatus("Error: " + res.data.error);
        return;
      }
      setLevelsData(res.data.levels);
      setStatus("Got cluster data from server!");
      
      // Reset highlighted nodes when loading new data
      setHighlightedNodes(new Map());
    } catch (err) {
      console.error(err);
      setStatus("Upload/Processing failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateStories = () => {
    if (levelsData) {
      navigate('/stories');
    } else {
      setStatus("Please process photos first before generating stories");
    }
  };

  const handleFullscreenToggle = () => {
    const container = document.getElementById("graph-container");
    if (!document.fullscreenElement) {
      container.requestFullscreen && container.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  };

  // Optimized node click handler - completely rewritten to use Map for tracking highlighted nodes
  const handleNodeClick = useCallback(node => {
    setHighlightedNodes(prevHighlighted => {
      const newHighlighted = new Map(prevHighlighted);
      
      // If this node is already highlighted
      if (newHighlighted.has(node.id)) {
        const currentLevel = newHighlighted.get(node.id);
        
        // If at max level, keep it at max level (don't cycle)
        if (currentLevel >= MAX_HIGHLIGHT_LEVEL) {
          // Do nothing - keep at max level
        } else {
          // Otherwise increment the highlight level
          newHighlighted.set(node.id, currentLevel + 1);
        }
      } else {
        // If not highlighted yet, set it to level 1
        newHighlighted.set(node.id, 1);
      }
      
      // Load high-res texture for this node with highest priority
      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
      const fullImageUrl = new URL(node.imageUrl, apiUrl).href;
      
      queueTextureLoad(
        fullImageUrl, 
        100, // Highest priority
        node.id,
        () => {
          if (graphRef.current) {
            graphRef.current.refresh();
          }
        }
      );
      
      // Camera zoom to the clicked node
      if (graphRef.current) {
        const distance = 85;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        
        const controls = graphRef.current.controls();
        controls.enabled = false;
        
        graphRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          { x: node.x, y: node.y, z: node.z },
          600 // Faster transition
        );
        
        setTimeout(() => {
          controls.enabled = true;
        }, 650);
      }
      
      return newHighlighted;
    });
  }, [queueTextureLoad, MAX_HIGHLIGHT_LEVEL]);

  // Updated border colors with more options
  const getBorderColor = useCallback(level => {
    // Expanded color palette with more distinct colors
    const colors = [
      "#ffffff", // Default white
      "#ff9800", // Orange
      "#ffeb3b", // Yellow
      "#4caf50", // Green
      "#2196f3", // Blue
      "#9c27b0", // Purple
      "#e91e63", // Pink
      "#f44336"  // Red
    ];
    return colors[Math.min(level, colors.length - 1)];
  }, []);

  // Memoized node object creator function to prevent unnecessary recreations
  const nodeThreeObject = useCallback(node => {
    const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
    const fullImageUrl = new URL(node.imageUrl, apiUrl).href;
    
    // Determine if this node is highlighted and at what level
    const highlightLevel = highlightedNodes.get(node.id) || 0;
    
    // Calculate scale based on highlight level
    const baseScale = 15; // Base size
    const maxScale = 40; // Maximum size
    
    // Scale increases with highlight level but tops out at maxScale
    const scale = highlightLevel === 0 
      ? baseScale 
      : Math.min(maxScale, baseScale + highlightLevel * 4);
    
    // Get border color based on highlight level
    const borderColor = getBorderColor(highlightLevel);
    const borderWidth = 4;
    
    // Create a group to hold all parts
    const group = new THREE.Group();
    
    // 1. Create border sprite
    const borderMaterial = new THREE.SpriteMaterial({
      color: borderColor,
      transparent: false
    });
    const borderSprite = new THREE.Sprite(borderMaterial);
    borderSprite.scale.set(scale, scale, 1);
    group.add(borderSprite);
    
    // 2. Determine which texture to use
    let texture;
    
    // If node is highlighted, prioritize high-res
    if (highlightLevel > 0 && textureCache.current[fullImageUrl]) {
      texture = textureCache.current[fullImageUrl];
    } 
    // Otherwise try low-res
    else if (lowResTextureCache.current[fullImageUrl]) {
      texture = lowResTextureCache.current[fullImageUrl];
      
      // If we don't have high-res yet but node is highlighted, load it
      if (highlightLevel > 0 && !textureCache.current[fullImageUrl]) {
        queueTextureLoad(
          fullImageUrl,
          100,
          node.id,
          () => {
            if (graphRef.current) {
              graphRef.current.refresh();
            }
          }
        );
      }
    } 
    // Fallback to placeholder
    else {
      texture = placeholderTexture.current;
      
      // Queue loading of appropriate texture based on node status
      if (highlightLevel > 0) {
        // Load high-res for highlighted node
        queueTextureLoad(
          fullImageUrl,
          100,
          node.id,
          () => {
            if (graphRef.current) {
              graphRef.current.refresh();
            }
          }
        );
      } else {
        // Load low-res for non-highlighted node
        createLowResTexture(
          fullImageUrl,
          () => {
            if (graphRef.current) {
              graphRef.current.refresh();
            }
          }
        );
      }
    }
    
    // Create image sprite with texture
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.3 // Helps with overdraw by skipping fully transparent pixels
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    const innerScale = scale - borderWidth;
    sprite.scale.set(innerScale, innerScale, 1);
    group.add(sprite);
    
    return group;
  }, [highlightedNodes, getBorderColor, createLowResTexture, queueTextureLoad]);

  // Custom link object to create string-like connections instead of tubes
  const linkThreeObject = useCallback((link) => {
    // Create a custom line material for string-like connections
    const material = new THREE.LineBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.6,
      linewidth: 1.5 // Note: WebGL has limited support for line width
    });
    
    // Create geometry with curved path
    const sourceNode = link.source;
    const targetNode = link.target;
    
    // Create curve with slight offset to avoid going through photos
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(
        (sourceNode.x + targetNode.x) / 2,
        (sourceNode.y + targetNode.y) / 2,
        (sourceNode.z + targetNode.z) / 2 + 10 // Add vertical offset for curve
      ),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    );
    
    // Create geometry from curve with enough points for smoothness
    const points = curve.getPoints(10);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create the line
    return new THREE.Line(geometry, material);
  }, []);

  // Memoize graph data to prevent unnecessary rebuilds
  const graphData = useMemo(() => {
    return levelsData && levelsData[currentLevel] || { nodes: [], links: [] };
  }, [levelsData, currentLevel]);

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

        <button 
          onClick={handleGenerateStories}
          className={!levelsData ? "disabled-btn" : ""}
          disabled={!levelsData}
        >
          Generate Stories
        </button>
      </section>

      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {levelsData && (
        <section 
          className="graph-container" 
          id="graph-container"
          ref={graphContainerRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '70vh',
            position: 'relative'
          }}
        >
          <button 
            className="fullscreen-btn" 
            onClick={handleFullscreenToggle}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 100
            }}
          >
            {isFullscreen ? "×" : "⛶"}
          </button>

          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            nodeThreeObject={nodeThreeObject}
            linkThreeObject={linkThreeObject}
            linkPositionUpdate={null} // Disable the default link positioning 
            linkDirectionalArrowLength={0}
            linkDirectionalParticles={0}
            nodeAutoColorBy="cluster"
            backgroundColor="#101020"
            onNodeClick={handleNodeClick}
            enableNodeDrag={true}
            cooldownTicks={50} // Reduced for faster stabilization
            cooldownTime={2000} // Max 2 seconds for cooldown
            warmupTicks={10} // Less warmup time
            width={isFullscreen ? window.innerWidth : (graphContainerRef.current?.clientWidth || window.innerWidth)}
            height={isFullscreen ? window.innerHeight : (graphContainerRef.current?.clientHeight || 500)}
            showNavInfo={false}
            nodeRelSize={4} // Smaller base node size
            linkWidth={2} // Thicker links
            linkOpacity={0.6} // Slightly more opaque links
          />
        </section>
      )}
    </div>
  );
}

export default Home;