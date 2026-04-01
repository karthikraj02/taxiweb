import React, { useState, useRef, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  Autocomplete,
} from "@react-google-maps/api";
import { FaLocationArrow, FaMapMarkerAlt, FaCar } from "react-icons/fa";
import "./BookingMap.css";

const libraries = ["places"];
const mapContainerStyle = { width: "100%", height: "100%" };
const center = { lat: 28.6139, lng: 77.209 }; // Default: New Delhi (Change to your city)

// Pricing Configuration
const BASE_FARE = 50;
const PRICE_PER_KM = 12;

export default function BookingMap() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [fare, setFare] = useState(0);
  
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropLocation, setDropLocation] = useState(null);
  const [selectingMode, setSelectingMode] = useState(null); // 'pickup' or 'drop'

  /** @type React.MutableRefObject<HTMLInputElement> */
  const pickupRef = useRef();
  /** @type React.MutableRefObject<HTMLInputElement> */
  const dropRef = useRef();

  const onLoad = useCallback(function callback(map) {
    setMap(map);
  }, []);

  // Calculate Route, Distance, and Fare
  const calculateRoute = async () => {
    if (!pickupLocation || !dropLocation) return;
    
    // eslint-disable-next-line no-undef
    const directionsService = new google.maps.DirectionsService();
    const results = await directionsService.route({
      origin: pickupLocation,
      destination: dropLocation,
      // eslint-disable-next-line no-undef
      travelMode: google.maps.TravelMode.DRIVING,
    });

    setDirectionsResponse(results);
    
    const distText = results.routes[0].legs[0].distance.text;
    const distValue = results.routes[0].legs[0].distance.value; // in meters
    const timeText = results.routes[0].legs[0].duration.text;
    
    setDistance(distText);
    setDuration(timeText);
    
    // Calculate Fare (distValue is in meters, convert to km)
    const calculatedFare = BASE_FARE + (distValue / 1000) * PRICE_PER_KM;
    setFare(calculatedFare.toFixed(2));
  };

  // Handle Autocomplete selection
  const handlePlaceSelect = (ref, type) => {
    if (!ref.current.value) return;
    
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: ref.current.value }, (results, status) => {
      if (status === "OK") {
        const location = results[0].geometry.location;
        if (type === "pickup") {
          setPickupLocation(location);
        } else {
          setDropLocation(location);
        }
        map.panTo(location);
        map.setZoom(14);
      }
    });
  };

  // Handle Reverse Geocoding for Map Clicks
  const handleMapClick = async (e) => {
    if (!selectingMode) return;

    const latLng = e.latLng;
    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === "OK" && results[0]) {
        const address = results[0].formatted_address;
        if (selectingMode === "pickup") {
          setPickupLocation(latLng);
          if(pickupRef.current) pickupRef.current.value = address;
        } else {
          setDropLocation(latLng);
          if(dropRef.current) dropRef.current.value = address;
        }
        setSelectingMode(null); // turn off selection mode
      }
    });
  };

  // Use Current Location (GPS)
  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setPickupLocation(latLng);
          map.panTo(latLng);
          map.setZoom(15);
          
          // Reverse geocode to fill input
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: latLng }, (results, status) => {
            if (status === "OK" && results[0]) {
              if (pickupRef.current) pickupRef.current.value = results[0].formatted_address;
            }
          });
        },
        () => alert("Geolocation failed or blocked.")
      );
    }
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Map...</div>;

  return (
    <div className="booking-container">
      {/* UI Overlay Card */}
      <div className="booking-panel">
        <h2>Book a Ride</h2>
        
        <div className="input-group">
          <FaLocationArrow className="icon pickup-icon" />
          <Autocomplete onPlaceChanged={() => handlePlaceSelect(pickupRef, "pickup")}> 
            <input type="text" placeholder="Pickup Location" ref={pickupRef} />
          </Autocomplete>
          <button className="gps-btn" onClick={useCurrentLocation} title="Use GPS">📍</button>
          <button 
            className={`map-select-btn ${selectingMode === "pickup" ? "active" : ""}`}
            onClick={() => setSelectingMode(selectingMode === "pickup" ? null : "pickup")}
          >
            Map
          </button>
        </div>

        <div className="input-group">
          <FaMapMarkerAlt className="icon drop-icon" />
          <Autocomplete onPlaceChanged={() => handlePlaceSelect(dropRef, "drop")}> 
            <input type="text" placeholder="Drop Location" ref={dropRef} />
          </Autocomplete>
          <button 
            className={`map-select-btn ${selectingMode === "drop" ? "active" : ""}`}
            onClick={() => setSelectingMode(selectingMode === "drop" ? null : "drop")}
          >
            Map
          </button>
        </div>

        {selectingMode && (
          <div className="map-helper-text">
            👆 Click anywhere on the map to set your {selectingMode} location
          </div>
        )}

        <button className="calculate-btn" onClick={calculateRoute}>
          See Route & Fare
        </button>

        {distance && duration && (
          <div className="trip-details">
            <div className="detail-item"><strong>Distance:</strong> {distance}</div>
            <div className="detail-item"><strong>Est. Time:</strong> {duration}</div>
            <div className="fare-box">
              <FaCar className="car-icon"/>
              <div className="fare-amount">₹{fare}</div>
            </div>
            
            <button className="confirm-btn">Confirm Booking</button>
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="map-container">
        <GoogleMap
          center={center}
          zoom={12}
          mapContainerStyle={mapContainerStyle}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
          onLoad={onLoad}
          onClick={handleMapClick}
        >
          {/* Display Route */}
          {directionsResponse && (
            <DirectionsRenderer directions={directionsResponse} />
          )}

          {/* Display standalone markers if route not yet calculated */}
          {!directionsResponse && pickupLocation && <Marker position={pickupLocation} label="P" />} 
          {!directionsResponse && dropLocation && <Marker position={dropLocation} label="D" />}
        </GoogleMap>
      </div>
    </div>
  );
}