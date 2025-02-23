FROM python:3.11-slim

# Install system dependencies needed for scikit-learn, OpenCV, etc.
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    python3-opencv \
    libsm6 libxext6 libxrender-dev libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the prepPhotos folder from src
COPY src/prepPhotos /app/prepPhotos

# Copy the rest of your backend code
COPY . .

EXPOSE 5000
CMD ["python", "src/server.py"]
