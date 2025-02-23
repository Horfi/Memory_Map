import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./PrepPhotosPage.css"; // <--- We'll reference this CSS

function PrepPhotosPage({ selectedPrepPhotos, setSelectedPrepPhotos }) {
  const [prepPhotos, setPrepPhotos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPrepPhotos = async () => {
      try {
        const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000";
        const res = await axios.get(`${apiUrl}/prep-photos-list`);
        setPrepPhotos(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPrepPhotos();
  }, []);

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

      <div className="prep-photos-grid">
        {prepPhotos.map((photo) => {
          const isSelected = selectedPrepPhotos.includes(photo);
          return (
            <div key={photo} className="prep-photo-wrapper">
              <img
                src={`${import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000"}/prepPhotos/${photo}`}
                alt={photo}
                className={`prep-photo ${isSelected ? "selected" : ""}`}
                onClick={() => togglePhotoSelection(photo)}
              />
            </div>
          );
        })}
      </div>

      <button className="prep-confirm-btn" onClick={handleConfirm}>
        Confirm Selection
      </button>
    </div>
  );
}

export default PrepPhotosPage;
