import io
import datetime
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
import exifread
import numpy as np
import cv2  # OpenCV for face detection
from sklearn.cluster import DBSCAN

app = Flask(__name__)
CORS(app)

# Load OpenCV's pre-trained face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def parse_exif(file_bytes):
    """
    Extract EXIF DateTimeOriginal, lat/lon.
    """
    dt_obj = None
    lat, lon = 0.0, 0.0  # default
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
    # Convert file bytes to an OpenCV image
    img_array = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        return 0  # Image couldn't be loaded

    # Convert to grayscale (Haar cascades work better in grayscale)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    return len(faces)  # Return the number of faces detected

@app.route("/process", methods=["POST"])
def process_images():
    """
    1. Receive multiple images via form-data: photos=<multiple files>
    2. Extract EXIF metadata (date/time).
    3. Detect faces using OpenCV.
    4. Cluster them (DBSCAN or another method).
    5. Return JSON with clusters.
    """
    files = request.files.getlist("photos")
    if not files:
        return jsonify({"error": "No files uploaded"}), 400

    # Step 1: Extract features from each photo
    photo_data = []
    for idx, f in enumerate(files):
        file_bytes = f.read()
        f.seek(0)  # Reset pointer for further reads if needed

        # EXIF
        dt_obj, lat, lon = parse_exif(file_bytes)

        # Face detection using OpenCV
        face_count = detect_faces_opencv(file_bytes)

        photo_data.append({
            "id": str(uuid.uuid4()),
            "filename": f.filename,
            "datetime": dt_obj,
            "daysSinceEpoch": date_to_days(dt_obj),
            "lat": lat,
            "lon": lon,
            "faceCount": face_count
        })

    # Step 2: Cluster images based on time, GPS, and face count
    X = []
    for p in photo_data:
        X.append([p["daysSinceEpoch"], p["lat"], p["lon"], p["faceCount"]])
    X = np.array(X)

    if len(X) < 2:
        # Not enough data to cluster meaningfully
        labels = np.array([-1] * len(X))
    else:
        dbscan = DBSCAN(eps=10.0, min_samples=2)
        labels = dbscan.fit_predict(X)

    # Step 3: Build a nodes/links structure
    nodes = []
    cluster_map = {}
    for i, p in enumerate(photo_data):
        nodes.append({
            "id": p["id"],
            "filename": p["filename"],
            "cluster": int(labels[i]),
            "faceCount": p["faceCount"],
            "dateTime": p["datetime"].isoformat() if p["datetime"] else None,
            "lat": p["lat"],
            "lon": p["lon"]
        })

        if labels[i] not in cluster_map:
            cluster_map[labels[i]] = []
        cluster_map[labels[i]].append(i)

    # Step 4: Build links (connect items in the same cluster)
    links = []
    for label, idx_list in cluster_map.items():
        if label == -1:  # Outliers/noise
            continue
        idx_list.sort()
        for j in range(len(idx_list) - 1):
            source_idx = idx_list[j]
            target_idx = idx_list[j + 1]
            links.append({
                "source": photo_data[source_idx]["id"],
                "target": photo_data[target_idx]["id"]
            })

    # Prepare JSON response
    result = {
        "levels": [
            {
                "level": 0,
                "nodes": nodes,
                "links": links
            }
        ]
    }
    return jsonify(result)

@app.route("/")
def hello():
    return "Backend for Photo Clustering with OpenCV."

if __name__ == "__main__":
    app.run(port=5000, debug=True)
