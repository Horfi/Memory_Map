// StoryPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DateRangePicker from './DateRangePicker';
import StoryCard from './StoryCard';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './StoryPage.css';

function StoryPage({ levelsData }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [photos, setPhotos] = useState([]);
  const [ratedPhotos, setRatedPhotos] = useState([]); // Tracks all rated photos
  const [finalStory, setFinalStory] = useState([]);
  const [currentFinalIndex, setCurrentFinalIndex] = useState(0);
  const [phase, setPhase] = useState('rating'); // 'rating' or 'final'
  const [xCount, setXCount] = useState(5); // User-defined X value
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ total: 0, completed: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (levelsData && levelsData.length > 0) {
      generateRandomPhotos();
    }
  }, [levelsData, startDate, endDate, xCount]);

  const generateRandomPhotos = () => {
    setLoading(true);
    setRatedPhotos([]);
    const allPhotos = levelsData[0]?.nodes || [];
  
    // Debug the first few photos to see their structure
    if (allPhotos.length > 0) {
      console.log("Sample photo object structure:", allPhotos[0]);
    }
  
    const filteredPhotos = allPhotos.filter(photo => {
      if (!startDate && !endDate) return true;
      if (!photo.dateTime) return false;
      const date = new Date(photo.dateTime);
      return (!startDate || date >= new Date(startDate)) && (!endDate || date <= new Date(endDate));
    });
  
    if (filteredPhotos.length === 0) {
      setLoading(false);
      setPhotos([]);
      return;
    }
  
    // Sample 3 * X photos with replacement
    let sampledPhotos = [];
    for (let i = 0; i < 3 * xCount; i++) {
      const photo = filteredPhotos[Math.floor(Math.random() * filteredPhotos.length)];
      
      // Make a copy of the photo to avoid modifying the original
      const photoWithFixedPath = { ...photo };
      
      // Fix the image URL if needed
      if (photoWithFixedPath.imageUrl) {
        // If it's a relative path, ensure it's properly formatted
        if (!photoWithFixedPath.imageUrl.startsWith('http://') && 
            !photoWithFixedPath.imageUrl.startsWith('https://') &&
            !photoWithFixedPath.imageUrl.startsWith('/')) {
          
          // Prefix with '/' if missing to make it a root-relative path
          photoWithFixedPath.imageUrl = '/' + photoWithFixedPath.imageUrl;
        }
      }
      
      sampledPhotos.push(photoWithFixedPath);
    }
  
    console.log("Generated sample photos with paths:", 
      sampledPhotos.map(p => p.imageUrl).slice(0, 3)); // Log first 3 for debugging
    
    setPhotos(sampledPhotos);
    setPhase('rating');
    setFinalStory([]);
    setLoading(false);
  };

  const handlePhotoRate = (photo, rating) => {
    setRatedPhotos(prev => {
      const newRatedPhotos = [...prev, { ...photo, liked: rating === 'like' }];
      
      // Once all photos are rated, generate the final story
      if (newRatedPhotos.length === 3 * xCount) {
        generateFinalStory(newRatedPhotos);
      }
      return newRatedPhotos;
    });
  };

  const generateFinalStory = (ratedPhotos) => {
    let likedPhotos = ratedPhotos.filter(photo => photo.liked);

    // Ensure all photos in final story are unique
    let finalPhotos = Array.from(new Set(likedPhotos.map(photo => photo.imageUrl))) // Remove duplicates
      .slice(0, xCount) // Get the top X unique images
      .map(url => likedPhotos.find(photo => photo.imageUrl === url)); // Map back to objects

    if (finalPhotos.length < xCount) {
      // Fill missing slots with unique least disliked images if necessary
      const additionalPhotos = Array.from(new Set(
        ratedPhotos.filter(photo => !photo.liked).map(photo => photo.imageUrl)
      )).slice(0, xCount - finalPhotos.length)
        .map(url => ratedPhotos.find(photo => photo.imageUrl === url));

      finalPhotos = [...finalPhotos, ...additionalPhotos].slice(0, xCount);
    }

    setFinalStory(finalPhotos);
    setCurrentFinalIndex(0);
    setPhase('final');
  };

  const handleFinalNavigate = (direction) => {
    console.log(`Navigating ${direction} from index ${currentFinalIndex} of ${finalStory.length} photos`);
    
    setCurrentFinalIndex((prevIndex) => {
      let newIndex;
      if (direction === 'next') {
        newIndex = (prevIndex + 1) % finalStory.length; // Wrap around to start
      } else {
        newIndex = (prevIndex - 1 + finalStory.length) % finalStory.length; // Wrap around to end
      }
      console.log(`New index: ${newIndex}`);
      return newIndex;
    });
  };

  const handleFinalStoryResponse = (liked) => {
    if (liked) {
      downloadFinalStory();
    } else {
      generateRandomPhotos();
    }
  };

  // Debug function to log image URLs
  const debugImageUrls = (photos) => {
    console.log("Current image URLs in final story:");
    photos.forEach((photo, index) => {
      console.log(`Image ${index}: ${photo.imageUrl}`);
    });
  };

  // Function to validate if a blob contains actual image data
  const isValidImageBlob = (blob) => {
    // Basic check: Images should generally be more than 1KB
    return blob.size > 1024;
  };

  // Helper function to fix/normalize paths
  const fixImagePath = (url) => {
    // If it's already an absolute URL (starts with http:// or https://), keep it as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For relative paths starting with '/prepPhotos/', try the correct static folder path
    if (url.startsWith('/prepPhotos/')) {
      // Try various potential paths for static files
      return `/static/media${url}`;
    }
    
    // If it's a relative path starting with '/', make it relative to the root
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    
    // For other relative paths, make them relative to the current page
    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    return basePath + url;
  };

  // Updated download function with better error handling and multiple path attempts
  const downloadFinalStory = async () => {
    const zip = new JSZip();
    setLoading(true);
    setDownloadProgress({ total: finalStory.length, completed: 0 });
    
    debugImageUrls(finalStory);
    
    // Updated path transformations with more possibilities
    const pathTransformations = [
      // Original path
      (url) => url,
      // Try with public folder
      (url) => {
        const filename = url.split('/').pop();
        return `/public/prepPhotos/${filename}`;
      },
      // Try with assets folder
      (url) => {
        const filename = url.split('/').pop();
        return `/assets/prepPhotos/${filename}`;
      },
      // Try with static/media 
      (url) => {
        const filename = url.split('/').pop();
        return `/static/media/prepPhotos/${filename}`;
      },
      // Try direct prepPhotos folder
      (url) => {
        const filename = url.split('/').pop();
        return `/prepPhotos/${filename}`;
      },
      // Extract just the filename and try in root
      (url) => {
        const filename = url.split('/').pop();
        return `/${filename}`;
      },
      // Try relative to the current directory
      (url) => {
        const filename = url.split('/').pop();
        return `prepPhotos/${filename}`;
      },
      // Try the API URL if it exists (for server-side images)
      (url) => {
        const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
        const filename = url.split('/').pop();
        return `${apiUrl}/prepPhotos/${filename}`;
      }
    ];
    
    try {
      const successfulDownloads = [];
      
      for (let i = 0; i < finalStory.length; i++) {
        const photo = finalStory[i];
        const filename = photo.filename || photo.imageUrl.split('/').pop() || `photo-${i + 1}.jpg`;
        let success = false;
        let blob;
        
        // Log this specific photo's structure to debug
        console.log(`[Image ${i}] Photo object:`, JSON.stringify(photo, null, 2));
        
        // Try all path transformations for this image
        for (const transform of pathTransformations) {
          try {
            const transformedUrl = fixImagePath(transform(photo.imageUrl));
            console.log(`[Image ${i}] Trying URL: ${transformedUrl}`);
            
            const response = await fetch(transformedUrl, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (!response.ok) {
              console.warn(`[Image ${i}] Failed with status: ${response.status} for URL: ${transformedUrl}`);
              continue;
            }
            
            blob = await response.blob();
            
            // More details about the blob for debugging
            console.log(`[Image ${i}] Blob: type=${blob.type}, size=${blob.size} bytes`);
            
            if (!isValidImageBlob(blob)) {
              console.warn(`[Image ${i}] Invalid image data (size: ${blob.size} bytes) for URL: ${transformedUrl}`);
              continue;
            }
            
            console.log(`[Image ${i}] Successfully downloaded from ${transformedUrl} (size: ${blob.size} bytes)`);
            success = true;
            break;
          } catch (error) {
            console.warn(`[Image ${i}] Error fetching: ${error.message}`);
          }
        }
        
        if (success && blob) {
          zip.file(filename, blob);
          successfulDownloads.push({ index: i, filename });
        } else {
          console.error(`[Image ${i}] Failed to download ${filename} after trying all paths`);
        }
        
        setDownloadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
      }
      
      console.log(`Downloaded ${successfulDownloads.length} of ${finalStory.length} images successfully`);
      
      if (successfulDownloads.length > 0) {
        const content = await zip.generateAsync({ 
          type: "blob",
          compression: "DEFLATE"
        });
        
        saveAs(content, "final_story.zip");
        console.log("ZIP file created and saved successfully");
      } else {
        alert("Failed to download any images. Please check the browser console for details.");
        console.error("Could not download any images after trying multiple URL patterns.");
      }
    } catch (error) {
      console.error("Error in download process:", error);
      alert("Failed to create zip file: " + error.message);
    } finally {
      setLoading(false);
      setDownloadProgress({ total: 0, completed: 0 });
    }
  };

  return (
    <div className="story-page">
      <header className="story-header">
        <h1>Photo Stories</h1>
        <button 
          className="back-btn" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </header>

      <div className="date-filter-section">
        <h2>Filter by Date</h2>
        <DateRangePicker 
          startDate={startDate} 
          endDate={endDate} 
          onStartDateChange={setStartDate} 
          onEndDateChange={setEndDate} 
        />
        <label>
          <span>Number of Final Pictures:</span>
          <input 
            type="number" 
            min="1" 
            value={xCount} 
            onChange={(e) => setXCount(Number(e.target.value))} 
          />
        </label>
        <button className="apply-btn" onClick={generateRandomPhotos}>Apply Filters</button>
      </div>

      {loading ? (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>
          {downloadProgress.total > 0 
            ? `Downloading images (${downloadProgress.completed}/${downloadProgress.total})...` 
            : 'Loading photos...'}
        </p>
      </div>
    ) : photos.length === 0 ? (
      <div className="no-photos">
        <p>No photos available for the selected date range.</p>
      </div>
    ) : phase === 'rating' ? (
      <>
        <p style={{ textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
          {ratedPhotos.length}/{xCount * 3} photos rated
        </p>
        <StoryCard photos={photos} onRatePhoto={handlePhotoRate} isFinal={false} />
      </>
    ) : (
      <>
        <div className="final-story-container">
          <StoryCard 
            photos={finalStory} 
            isFinal={true}
            currentFinalIndex={currentFinalIndex}
          />
          
          <p style={{ textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
            Viewing {currentFinalIndex + 1}/{finalStory.length} in Final Story
          </p>

          <div className="navigation-buttons">
            <button 
              onClick={() => handleFinalNavigate('prev')} 
              className="nav-button prev-button"
            >
              ← Previous
            </button>
            <button 
              onClick={() => handleFinalNavigate('next')} 
              className="nav-button next-button"
            >
              Next →
            </button>
          </div>
          
          <div className="final-story-actions">
            <button onClick={() => handleFinalStoryResponse(true)}>👍 I Like It</button>
            <button onClick={() => handleFinalStoryResponse(false)}>👎 I Don't Like It</button>
          </div>
        </div>
      </>
    )}
    </div>
  );
}

export default StoryPage;