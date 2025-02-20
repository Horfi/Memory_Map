# ------------------------------
# Stage 1: Build the Vite app
# ------------------------------
    FROM node:18-alpine as build

    WORKDIR /app
    
    # Copy package files and install dependencies
    COPY package*.json ./
    RUN npm install
    
    # Copy the rest of the frontend files
    COPY . .
    
    # Build the production-ready files into /app/dist
    RUN npm run build
    
    # ------------------------------
    # Stage 2: Serve with Nginx
    # ------------------------------
    FROM nginx:alpine
    
    # Remove default Nginx website
    RUN rm -rf /usr/share/nginx/html/*
    
    # Copy Vite build from Stage 1
    COPY --from=build /app/dist /usr/share/nginx/html
    
    # Expose port 80
    EXPOSE 80
    
    # Start Nginx
    CMD ["nginx", "-g", "daemon off;"]
    