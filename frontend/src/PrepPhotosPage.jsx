import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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

  // Select All
  const handleSelectAll = () => {
    // If you want to select *every* photo from the list:
    setSelectedPrepPhotos(prepPhotos);
  };

  // Clear All
  const handleClearAll = () => {
    setSelectedPrepPhotos([]);
  };

  const handleConfirm = () => {
    navigate("/");
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Select from Prepared Photos</h2>
      <p>Click images to toggle selection.</p>

      {/* The new buttons */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={handleSelectAll} style={{ marginRight: "1rem" }}>
          Select All
        </button>
        <button onClick={handleClearAll}>Clear All</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {prepPhotos.map((photo) => {
          const isSelected = selectedPrepPhotos.includes(photo);
          return (
            <div key={photo} style={{ margin: "8px" }}>
              <img
                src={`${
                  import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:5000"
                }/prepPhotos/${photo}`}
                alt={photo}
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  border: isSelected ? "3px solid green" : "1px solid #ccc",
                  cursor: "pointer",
                }}
                onClick={() => togglePhotoSelection(photo)}
              />
            </div>
          );
        })}
      </div>

      <button onClick={handleConfirm} style={{ marginTop: "1rem" }}>
        Confirm Selection
      </button>
    </div>
  );
}

export default PrepPhotosPage;
