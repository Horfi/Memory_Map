// StoryGenerator.js
/**
 * Utility functions for generating stories from photo clusters
 */

// Group nodes by date ranges
export const groupByDateRange = (nodes, startDate, endDate) => {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    
    return nodes.filter(node => {
      if (!node.dateTime) return false;
      const nodeDate = new Date(node.dateTime);
      return nodeDate >= start && nodeDate <= end;
    });
  };
  
  // Group nodes by location proximity
  export const groupByLocation = (nodes, maxDistanceKm = 1) => {
    const groups = [];
    const assigned = new Set();
    
    // Calculate distance between two coordinates in km
    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    nodes.forEach((node, i) => {
      if (assigned.has(node.id)) return;
      
      const group = [node];
      assigned.add(node.id);
      
      nodes.forEach((otherNode, j) => {
        if (i === j || assigned.has(otherNode.id)) return;
        
        const distance = getDistanceKm(
          node.lat, node.lon, 
          otherNode.lat, otherNode.lon
        );
        
        if (distance <= maxDistanceKm) {
          group.push(otherNode);
          assigned.add(otherNode.id);
        }
      });
      
      if (group.length > 1) {
        groups.push(group);
      }
    });
    
    return groups;
  };
  
  // Group nodes by face similarity
  export const groupByFaces = (nodes) => {
    // Group by matching face counts as a simple proxy
    // In a real implementation, we'd use face recognition APIs
    const faceGroups = {};
    
    nodes.forEach(node => {
      if (node.faceCount > 0) {
        if (!faceGroups[node.faceCount]) {
          faceGroups[node.faceCount] = [];
        }
        faceGroups[node.faceCount].push(node);
      }
    });
    
    return Object.values(faceGroups).filter(group => group.length > 1);
  };
  
  // Generate stories based on clusters and user preferences
  export const generateStories = (nodes, userPreferences, count = 5) => {
    if (!nodes || nodes.length === 0) return [];
    
    const stories = [];
    
    // 1. First try to generate stories with liked persons/faces
    if (Object.keys(userPreferences.likedPersons).length > 0) {
      const likedFaceCounts = Object.keys(userPreferences.likedPersons)
        .map(personId => parseInt(personId))
        .filter(count => !isNaN(count));
      
      if (likedFaceCounts.length > 0) {
        const likedFaceNodes = nodes.filter(node => 
          likedFaceCounts.includes(node.faceCount)
        );
        
        if (likedFaceNodes.length >= 3) {
          stories.push({
            id: `story-faces-${Date.now()}`,
            title: "People You Like",
            nodes: likedFaceNodes.slice(0, 5),
            type: "face"
          });
        }
      }
    }
    
    // 2. Generate location-based stories
    const locationGroups = groupByLocation(nodes);
    locationGroups.forEach((group, i) => {
      if (stories.length < count && group.length >= 3) {
        // Use the most common location name in the group if available
        const locationName = group[0].lat.toFixed(2) + ", " + group[0].lon.toFixed(2);
        
        stories.push({
          id: `story-location-${i}-${Date.now()}`,
          title: `Memories from ${locationName}`,
          nodes: group.slice(0, 5),
          type: "location"
        });
      }
    });
    
    // 3. Generate date-based stories
    const dates = nodes
      .filter(node => node.dateTime)
      .map(node => new Date(node.dateTime).toISOString().slice(0, 10));
    
    const uniqueDates = [...new Set(dates)];
    uniqueDates.forEach((date, i) => {
      if (stories.length < count) {
        const dateNodes = nodes.filter(node => 
          node.dateTime && new Date(node.dateTime).toISOString().slice(0, 10) === date
        );
        
        if (dateNodes.length >= 3) {
          const dateObj = new Date(date);
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          stories.push({
            id: `story-date-${i}-${Date.now()}`,
            title: `On ${formattedDate}`,
            nodes: dateNodes.slice(0, 5),
            type: "date"
          });
        }
      }
    });
    
    // 4. Generate cluster-based stories
    const clusterGroups = {};
    nodes.forEach(node => {
      if (node.cluster >= 0) { // -1 means no cluster
        if (!clusterGroups[node.cluster]) {
          clusterGroups[node.cluster] = [];
        }
        clusterGroups[node.cluster].push(node);
      }
    });
    
    Object.values(clusterGroups).forEach((group, i) => {
      if (stories.length < count && group.length >= 3) {
        stories.push({
          id: `story-cluster-${i}-${Date.now()}`,
          title: `Collection ${i+1}`,
          nodes: group.slice(0, 5),
          type: "cluster"
        });
      }
    });
    
    // Fill remaining with random collections if needed
    while (stories.length < count && nodes.length >= 3) {
      const randomNodes = [...nodes]
        .sort(() => 0.5 - Math.random())
        .slice(0, 5);
      
      stories.push({
        id: `story-random-${stories.length}-${Date.now()}`,
        title: `Random Collection ${stories.length + 1}`,
        nodes: randomNodes,
        type: "random"
      });
    }
    
    return stories;
  };
  
  // Update user preferences based on liked/disliked stories
  export const updatePreferences = (story, liked, userPreferences) => {
    const newPreferences = { ...userPreferences };
    
    if (liked) {
      newPreferences.likedStories.push(story.id);
      
      // Update face preferences
      if (story.type === "face") {
        story.nodes.forEach(node => {
          const faceCount = node.faceCount.toString();
          newPreferences.likedPersons[faceCount] = 
            (newPreferences.likedPersons[faceCount] || 0) + 1;
        });
      }
      
      // Update location preferences
      if (story.type === "location") {
        const locationKey = `${story.nodes[0].lat.toFixed(2)},${story.nodes[0].lon.toFixed(2)}`;
        newPreferences.likedLocations[locationKey] = 
          (newPreferences.likedLocations[locationKey] || 0) + 1;
      }
      
      // Update date preferences
      if (story.type === "date" && story.nodes[0].dateTime) {
        const dateKey = new Date(story.nodes[0].dateTime).toISOString().slice(0, 10);
        newPreferences.likedDates[dateKey] = 
          (newPreferences.likedDates[dateKey] || 0) + 1;
      }
    } else {
      newPreferences.dislikedStories.push(story.id);
    }
    
    return newPreferences;
  };