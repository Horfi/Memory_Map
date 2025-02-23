import io
import datetime
import uuid
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import exifread
import numpy as np
import cv2
from sklearn.cluster import DBSCAN

app = Flask(__name__)
CORS(app)

# Absolute path to 'uploads' inside the container
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load OpenCV face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def parse_exif(file_bytes):
    """
    Extract EXIF DateTimeOriginal (and lat/lon if needed).
    """
    dt_obj = None
    lat, lon = 0.0, 0.0
    try:
        tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
        if "EXIF DateTimeOriginal" in tags:
            dt_str = str(tags["EXIF DateTimeOriginal"])
            try:
                dt_obj = datetime.datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            except:
                pass
    except:
        pass
    return dt_obj, lat, lon

def date_to_days(dt):
    """Convert datetime to float days since epoch."""
    if not dt:
        return 0.0
    epoch = datetime.datetime(1970, 1, 1)
    delta = dt - epoch
    return delta.total_seconds() / 86400.0

def detect_faces_opencv(file_bytes):
    """
    Detect faces using OpenCV.
    Returns the number of detected faces.
    """
    img_array = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return 0

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return len(faces)

@app.route("/process", methods=["POST"])
def process_images():
    """
    1. Receive multiple images
    2. Extract EXIF metadata (date/time)
    3. Detect faces
    4. Cluster them
    5. Return JSON with clusters + image URLs
    """
    files = request.files.getlist("photos")
    if not files:
        return jsonify({"error": "No files uploaded"}), 400

    photo_data = []
    for f in files:
        file_bytes = f.read()
        f.seek(0)

        dt_obj, lat, lon = parse_exif(file_bytes)
        face_count = detect_faces_opencv(file_bytes)

        # Save the image to 'uploads' with a unique filename
        unique_filename = f"{uuid.uuid4()}_{f.filename}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        f.save(save_path)

        # Instead of hardcoding localhost, store only the relative path
        relative_url = f"/uploads/{unique_filename}"

        photo_data.append({
            "id": str(uuid.uuid4()),
            "filename": f.filename,
            "datetime": dt_obj,
            "daysSinceEpoch": date_to_days(dt_obj),
            "lat": lat,
            "lon": lon,
            "faceCount": face_count,
            "imageUrl": relative_url
        })

    # Cluster
    X = np.array([
        [p["daysSinceEpoch"], p["lat"], p["lon"], p["faceCount"]]
        for p in photo_data
    ])

    eps_values = [10.0, 20.0, 30.0]  # example thresholds
    levels = []

    for lvl, eps in enumerate(eps_values):
        if len(X) < 2:
            # Not enough data
            labels = np.array([-1]*len(X))
        else:
            dbscan = DBSCAN(eps=eps, min_samples=2)
            labels = dbscan.fit_predict(X)

        nodes = []
        cluster_map = {}
        for i, p in enumerate(photo_data):
            node_data = {
                "id": p["id"],
                "filename": p["filename"],
                "cluster": int(labels[i]),
                "faceCount": p["faceCount"],
                "dateTime": p["datetime"].isoformat() if p["datetime"] else None,
                "lat": p["lat"],
                "lon": p["lon"],
                "imageUrl": p["imageUrl"]
            }
            nodes.append(node_data)
            cluster_map.setdefault(labels[i], []).append(i)

        links = []
        for label, idx_list in cluster_map.items():
            if label == -1:
                continue  # outliers
            idx_list.sort()
            for j in range(len(idx_list) - 1):
                source_idx = idx_list[j]
                target_idx = idx_list[j + 1]
                links.append({
                    "source": photo_data[source_idx]["id"],
                    "target": photo_data[target_idx]["id"]
                })

        levels.append({
            "level": lvl,
            "nodes": nodes,
            "links": links
        })

    return jsonify({"levels": levels})

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """
    Serve the uploaded images from the 'uploads' folder.
    """
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/")
def hello():
    return "Backend for Photo Clustering with OpenCV."

if __name__ == "__main__":
    # Make sure to listen on 0.0.0.0 so Docker can expose it
    app.run(host="0.0.0.0", port=5000, debug=True)
