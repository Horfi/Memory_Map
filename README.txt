Memory map web app written mainly in react and python 
a website on which u can uploead photos and create a 3d map, that clusters/groups photos based on time, location and ppeople on it 
  
  still work in progress 
  link to the site of what is currently done 


  back end
  intsall libraries for backend:
  cd backend
  pip install -r requirements.txt
  
  to run backend:
  cd backend
  cd src
  python server.py


  frontend.

  to run frontend:
  cd frontend
  npm run dev.



use this commad to buid images using docker u run yml file that creates 2 docker containers for front eand ad backend one
  docker-compose build


if u wish to export images as tar use those commands ( at elast it shoudl work )

docker save -o memory_map-backend.tar memory_map-backend:latest
docker save -o memory_map-frontend.tar memory_map-frontend:latest



add to azure website
(this logs u into the app container enviroment) memorymapacr - name of enviroment
az acr login -n memorymapacr  

docker tag memory_map-backend:latest memorymapacr.azurecr.io/memory_map-backend:latest
docker tag memory_map-frontend:latest memorymapacr.azurecr.io/memory_map-frontend:latest

Push the Images to ACR: Push each tagged image:
docker push memorymapacr.azurecr.io/memory_map-backend:latest
docker push memorymapacr.azurecr.io/memory_map-frontend:latest


reammeb rto set ingress on backend to poublic visiable and on front end container app set enviroment variable as 
REACT_APP_API_URL to the url of backend that run on 


cuz the front end needs ap  to backend we nned to first compose build the contianer so get theimage of both but 
we are interested only in backeend image for now push it to azure and hosta website, then when i works we change manually link in front end app that
leads to backend in 2 places, then we build compose again and crate images and host front end
