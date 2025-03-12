// StoryCard.jsx

import React, { useState } from 'react';
import './StoryCard.css';

function StoryCard({ photos, onRatePhoto, isFinal, onFinalNavigate, currentFinalIndex }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";

  // For final story view, use the currentFinalIndex passed from parent if available
  const displayIndex = isFinal && currentFinalIndex !== undefined ? currentFinalIndex : currentIndex;
  
  // Check if photos array exists and has items
  if (!photos || photos.length === 0) {
    console.error("No photos provided to StoryCard");
    return <div className="story-card error">No photos available</div>;
  }
  
  const currentPhoto = photos[displayIndex];

  // Check if currentPhoto exists before trying to access its properties
  if (!currentPhoto) {
    console.error("No photo found at index:", displayIndex, "in photos array:", photos);
    return <div className="story-card error">Photo not available</div>;
  }

  const handleRate = (rating) => {
    onRatePhoto(currentPhoto, rating);
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleNavigate = (direction) => {
    if (isFinal && onFinalNavigate) {
      console.log("Final story navigation:", direction);
      onFinalNavigate(direction);
    } else {
      if (direction === 'next' && currentIndex < photos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (direction === 'prev' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  // Modified image URL handling to match your original implementation
  const getImageSrc = () => {
    if (!currentPhoto.imageUrl) return '';
    
    // Use the same logic as in your original component
    return currentPhoto.imageUrl.startsWith('http') 
      ? currentPhoto.imageUrl 
      : apiUrl + currentPhoto.imageUrl;
  };

  return (
    <div className="story-card">
      <div className="story-content">
        <img 
          src={getImageSrc()} 
          alt={currentPhoto.filename || "Photo"} 
          onError={(e) => {
            console.error("Image failed to load:", currentPhoto.imageUrl);
            e.target.onerror = null; // Prevent infinite error loop
            e.target.alt = "Image not available";
            e.target.style.display = "none"; // Hide broken image
            
            // Add placeholder text
            const placeholderText = document.createElement("div");
            placeholderText.className = "image-placeholder";
            placeholderText.textContent = "Image failed to load";
            e.target.parentNode.appendChild(placeholderText);
          }}
        />
      </div>

    {isFinal ? (
      // Remove the arrows for final story navigation since we're using buttons outside
      <div className="story-actions">
        {/* No arrows here */}
      </div>
    ) : (
      // Like/Dislike buttons for rating
      <div className="story-actions">
        <button className="action-btn dislike-btn" onClick={() => handleRate('dislike')}>
          👎 Dislike
        </button>
        <button className="action-btn like-btn" onClick={() => handleRate('like')}>
          👍 Like
        </button>
      </div>
    )}
    </div>
  );
}

export default StoryCard;