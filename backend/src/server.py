import io
import datetime
from flask import Flask, request, jsonify
import exifread
import face_recognition
import numpy as np
from sklearn.cluster import DBSCAN

app = Flask(__name__)

def date_to_days(dt):
    """Convert datetime to days since epoch (1970-01-01)."""
    if dt is None:
        return 0
    epoch = datetime.datetime(1970, 1, 1)
    delta = dt - epoch
    return delta.days + (delta.seconds / 86400.0)

def parse_exif_and_faces(file_storage):
    """
    1) Parse EXIF for date/time, latitude, longitude (demo approach: lat/lon = 0 if not found).
    2) Detect faces (count) using face_recognition.
    Returns dict with:
      { 'datetime': datetime|None, 'lat': float, 'lon': float, 'faceCount': int }
    """
    file_bytes = file_storage.read()
    file_storage.seek(0)  # Reset pointer

    # 1) EXIF
    exif_tags = {}
    try:
        with io.BytesIO(file_bytes) as f:
            exif_tags = exifread.process_file(f, details=False)
    except:
        pass

    # Parse DateTimeOriginal
    dt_obj = None
    if "EXIF DateTimeOriginal" in exif_tags:
        exif_date_str = str(exif_tags["EXIF DateTimeOriginal"])
        try:
            dt_obj = datetime.datetime.strptime(exif_date_str, "%Y:%m:%d %H:%M:%S")
        except:
            pass

    # For demo, we won't parse real lat/lon from EXIF. We’ll just do lat=0, lon=0.
    # You can parse them from exif_tags if needed:
    lat = 0.0
    lon = 0.0

    # 2) Face detection
    # load_image_file -> returns a numpy array (RGB)
    img = face_recognition.load_image_file(io.BytesIO(file_bytes))
    face_locations = face_recognition.face_locations(img)
    face_count = len(face_locations)

    return {
        "datetime": dt_obj,
        "lat": lat,
        "lon": lon,
        "faceCount": face_count
    }

@app.route("/process", methods=["POST"])
def process_images():
    """
    Endpoint: POST multiple images as form-data: photos=<files[]>
    1) Parse EXIF + face count
    2) DBSCAN cluster
    3) Return JSON with { nodes, links }
    """
    files = request.files.getlist("photos")
    if not files:
        return jsonify({"error": "No files received"}), 400

    # Collect data
    data_list = []
    for idx, file_storage in enumerate(files):
        result = parse_exif_and_faces(file_storage)
        data_list.append({
            "index": idx,
            "filename": file_storage.filename,
            "datetime": result["datetime"],
            "lat": result["lat"],
            "lon": result["lon"],
            "faceCount": result["faceCount"],
        })

    # Build features: [daysSinceEpoch, lat, lon, faceCount]
    feature_array = []
    for item in data_list:
        days = date_to_days(item["datetime"]) if item["datetime"] else 0
        feature_array.append([days, item["lat"], item["lon"], item["faceCount"]])
    feature_array = np.array(feature_array)

    # Run DBSCAN
    if len(feature_array) > 0:
        dbscan = DBSCAN(eps=10, min_samples=2)
        labels = dbscan.fit_predict(feature_array)
    else:
        labels = []

    # Build nodes
    nodes = []
    for i, item in enumerate(data_list):
        nodes.append({
            "id": str(i),
            "filename": item["filename"],
            "cluster": int(labels[i]),
            "faceCount": item["faceCount"],
            "lat": item["lat"],
            "lon": item["lon"],
            "dateTime": item["datetime"].isoformat() if item["datetime"] else None
        })

    # Build cluster -> indices
    clusters = {}
    for i, label in enumerate(labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(i)

    # Build links in each cluster
    links = []
    for label, indices in clusters.items():
        # label == -1 => outlier/noise in DBSCAN, skip linking
        if label == -1:
            continue
        indices.sort()
        for j in range(len(indices) - 1):
            links.append({
                "source": str(indices[j]),
                "target": str(indices[j+1])
            })

    return jsonify({
        "nodes": nodes,
        "links": links
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)
