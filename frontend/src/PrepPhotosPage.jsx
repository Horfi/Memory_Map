import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./PrepPhotosPage.css";

function PrepPhotosPage({ selectedPrepPhotos, setSelectedPrepPhotos }) {
  const [prepPhotos, setPrepPhotos] = useState([]);
  const [visiblePhotos, setVisiblePhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const photosContainerRef = useRef(null);
  const observerRef = useRef(null);
  const navigate = useNavigate();
  
  const baseUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";

  // Prefetch critical data
  useEffect(() => {
    let isMounted = true;
    
    const fetchPrepPhotos = async () => {
      try {
        // Use a smaller timeout to abort slow requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await axios.get(`${baseUrl}/prep-photos-list`, {
          signal: controller.signal,
          // Add cache-related headers
          headers: {
            'Cache-Control': 'max-age=3600',
            'Pragma': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (isMounted) {
          const data = res.data;
          setPrepPhotos(data);
          
          // Load fewer images initially (just 6)
          const initialBatchSize = Math.min(6, data.length);
          setVisiblePhotos(data.slice(0, initialBatchSize));
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch photos:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchPrepPhotos();
    
    // Cleanup
    return () => {
      isMounted = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [baseUrl]);

  // More sensitive intersection observer
  const lastPhotoElementRef = useCallback(node => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visiblePhotos.length < prepPhotos.length) {
        // Smaller batch size (4 images)
        const nextBatchSize = 4;
        const currentSize = visiblePhotos.length;
        const nextBatch = prepPhotos.slice(
          currentSize, 
          Math.min(currentSize + nextBatchSize, prepPhotos.length)
        );
        setVisiblePhotos(prev => [...prev, ...nextBatch]);
      }
    }, { 
      rootMargin: '250px 0px', // Start loading before scrolling all the way
      threshold: 0.1 // Trigger with minimal visibility
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, visiblePhotos, prepPhotos]);

  // Generate thumbnail URLs with very low quality
  const getThumbnailUrl = (photo) => {
    // Super aggressive quality reduction (30%)
    // Smaller width (200px)
    return `${baseUrl}/prepPhotos/${photo}?quality=30&w=200`;
  };

  const togglePhotoSelection = (photo) => {
    if (selectedPrepPhotos.includes(photo)) {
      setSelectedPrepPhotos(selectedPrepPhotos.filter((p) => p !== photo));
    } else {
      setSelectedPrepPhotos([...selectedPrepPhotos, photo]);
    }
  };

  const handleSelectAll = () => {
    setSelectedPrepPhotos(prepPhotos);
  };

  const handleClearAll = () => {
    setSelectedPrepPhotos([]);
  };

  const handleConfirm = () => {
    navigate("/");
  };

  // Preload the next batch of images to make scrolling feel faster
  useEffect(() => {
    if (visiblePhotos.length < prepPhotos.length) {
      const nextIndex = visiblePhotos.length;
      const preloadCount = Math.min(4, prepPhotos.length - nextIndex);
      
      // Preload next batch of images
      for (let i = 0; i < preloadCount; i++) {
        const imgToPreload = prepPhotos[nextIndex + i];
        if (imgToPreload) {
          const preloadLink = document.createElement('link');
          preloadLink.rel = 'prefetch';
          preloadLink.href = getThumbnailUrl(imgToPreload);
          preloadLink.as = 'image';
          document.head.appendChild(preloadLink);
          
          // Clean up to prevent memory leaks
          setTimeout(() => {
            document.head.removeChild(preloadLink);
          }, 3000);
        }
      }
    }
  }, [visiblePhotos, prepPhotos]);

  return (
    <div className="prep-container">
      <h2>Select from Prepared Photos</h2>
      <p className="prep-subtitle">Click images to toggle selection.</p>

      <div className="prep-controls">
        <button className="prep-btn" onClick={handleSelectAll}>
          Select All
        </button>
        <button className="prep-btn" onClick={handleClearAll}>
          Clear All
        </button>
      </div>

      <div className="prep-photos-grid" ref={photosContainerRef}>
        {visiblePhotos.map((photo, index) => {
          const isSelected = selectedPrepPhotos.includes(photo);
          const isLastElement = index === visiblePhotos.length - 1;
          
          return (
            <div 
              key={photo} 
              className="prep-photo-wrapper"
              ref={isLastElement ? lastPhotoElementRef : null}
            >
              {/* Placeholder div to maintain layout before image loads */}
              <div className="photo-placeholder"></div>
              <img
                src={getThumbnailUrl(photo)}
                alt={photo}
                className={`prep-photo ${isSelected ? "selected" : ""}`}
                onClick={() => togglePhotoSelection(photo)}
                loading="lazy"
                width="200"
                height="150"
                decoding="async"
              />
            </div>
          );
        })}
      </div>
      
      {loading && <div className="loading-indicator">Loading photos...</div>}
      
      <button className="prep-confirm-btn" onClick={handleConfirm}>
        Confirm Selection
      </button>
    </div>
  );
}

export default PrepPhotosPage;