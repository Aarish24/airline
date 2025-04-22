const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all flights
router.get('/', async (req, res) => {
  try {
    const flights = await pool.query(`
      SELECT f.*, 
             a.name as airline_name, a.iata_code as airline_code,
             dep.name as departure_airport, dep.iata_code as departure_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code,
             ac.registration_number, ac.model as aircraft_model,
             COUNT(b.id) as booking_count
      FROM flight f
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN booking b ON f.id = b.flight_id
      GROUP BY f.id, a.name, a.iata_code, dep.name, dep.iata_code, arr.name, arr.iata_code, ac.registration_number, ac.model
      ORDER BY f.departure_time DESC
    `);

    res.status(200).json({ message: "Flights retrieved successfully", data: flights.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific flight
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const flight = await pool.query(`
      SELECT f.*, 
             a.name as airline_name, a.iata_code as airline_code,
             dep.name as departure_airport, dep.iata_code as departure_code, dep.city as departure_city,
             arr.name as arrival_airport, arr.iata_code as arrival_code, arr.city as arrival_city,
             ac.registration_number, ac.model as aircraft_model, ac.capacity
      FROM flight f
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      WHERE f.id = $1
    `, [id]);
    
    if (flight.rows.length === 0) {
      return res.status(404).json({ message: "Flight not found" });
    }
    
    // Get bookings for this flight
    const bookings = await pool.query(`
      SELECT b.id, b.seat_number, b.booking_status, b.price,
             p.first_name, p.last_name, p.email
      FROM booking b
      JOIN passenger p ON b.passenger_id = p.id
      WHERE b.flight_id = $1
    `, [id]);
    
    // Get crew members for this flight
    const crewMembers = await pool.query(`
      SELECT cm.id, cm.first_name, cm.last_name, cm.position, fc.role
      FROM flight_crew fc
      JOIN crew_member cm ON fc.crew_member_id = cm.id
      WHERE fc.flight_id = $1
    `, [id]);
    
    const result = {
      ...flight.rows[0],
      bookings: bookings.rows,
      crew_members: crewMembers.rows
    };
    
    res.status(200).json({ message: "Flight retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new flight
router.post('/', async (req, res) => {
  try {
    const { 
      flight_number, 
      departure_airport_id, 
      arrival_airport_id, 
      departure_time, 
      arrival_time, 
      aircraft_id, 
      airline_id, 
      status 
    } = req.body;

    if (!flight_number || !departure_airport_id || !arrival_airport_id || !departure_time || !arrival_time || !aircraft_id || !airline_id) {
      return res.status(400).json({ message: "All flight details are required" });
    }
    
    // Check if departure and arrival airports are different
    if (departure_airport_id === arrival_airport_id) {
      return res.status(400).json({ message: "Departure and arrival airports must be different" });
    }
    
    // Check if departure time is before arrival time
    const departureDate = new Date(departure_time);
    const arrivalDate = new Date(arrival_time);
    
    if (departureDate >= arrivalDate) {
      return res.status(400).json({ message: "Departure time must be before arrival time" });
    }
    
    // Check if referenced entities exist
    const departureAirport = await pool.query("SELECT * FROM airport WHERE id = $1", [departure_airport_id]);
    const arrivalAirport = await pool.query("SELECT * FROM airport WHERE id = $1", [arrival_airport_id]);
    const aircraft = await pool.query("SELECT * FROM aircraft WHERE id = $1", [aircraft_id]);
    const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
    
    if (departureAirport.rows.length === 0) {
      return res.status(400).json({ message: "Departure airport does not exist" });
    }
    
    if (arrivalAirport.rows.length === 0) {
      return res.status(400).json({ message: "Arrival airport does not exist" });
    }
    
    if (aircraft.rows.length === 0) {
      return res.status(400).json({ message: "Aircraft does not exist" });
    }
    
    if (airline.rows.length === 0) {
      return res.status(400).json({ message: "Airline does not exist" });
    }
    
    // Check if aircraft belongs to the airline
    if (aircraft.rows[0].airline_id !== airline_id) {
      return res.status(400).json({ message: "Aircraft does not belong to the specified airline" });
    }
    
    const id = uuidv4();
    const newFlight = await pool.query(
      "INSERT INTO flight (id, flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, aircraft_id, airline_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [id, flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, aircraft_id, airline_id, status || 'Scheduled']
    );
    
    res.status(201).json({ message: "Flight created successfully", data: newFlight.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE a flight
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      flight_number, 
      departure_airport_id, 
      arrival_airport_id, 
      departure_time, 
      arrival_time, 
      aircraft_id, 
      airline_id, 
      status 
    } = req.body;

    // Check if flight exists
    const flight = await pool.query("SELECT * FROM flight WHERE id = $1", [id]);
    
    if (flight.rows.length === 0) {
      return res.status(404).json({ message: "Flight not found" });
    }
    
    if (!flight_number || !departure_airport_id || !arrival_airport_id || !departure_time || !arrival_time || !aircraft_id || !airline_id) {
      return res.status(400).json({ message: "All flight details are required" });
    }
    
    // Check if departure and arrival airports are different
    if (departure_airport_id === arrival_airport_id) {
      return res.status(400).json({ message: "Departure and arrival airports must be different" });
    }
    
    // Check if departure time is before arrival time
    const departureDate = new Date(departure_time);
    const arrivalDate = new Date(arrival_time);
    
    if (departureDate >= arrivalDate) {
      return res.status(400).json({ message: "Departure time must be before arrival time" });
    }
    
    // Check if referenced entities exist
    const departureAirport = await pool.query("SELECT * FROM airport WHERE id = $1", [departure_airport_id]);
    const arrivalAirport = await pool.query("SELECT * FROM airport WHERE id = $1", [arrival_airport_id]);
    const aircraft = await pool.query("SELECT * FROM aircraft WHERE id = $1", [aircraft_id]);
    const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
    
    if (departureAirport.rows.length === 0) {
      return res.status(400).json({ message: "Departure airport does not exist" });
    }
    
    if (arrivalAirport.rows.length === 0) {
      return res.status(400).json({ message: "Arrival airport does not exist" });
    }
    
    if (aircraft.rows.length === 0) {
      return res.status(400).json({ message: "Aircraft does not exist" });
    }
    
    if (airline.rows.length === 0) {
      return res.status(400).json({ message: "Airline does not exist" });
    }
    
    // Check if aircraft belongs to the airline
    if (aircraft.rows[0].airline_id !== airline_id) {
      return res.status(400).json({ message: "Aircraft does not belong to the specified airline" });
    }
    
    const updatedFlight = await pool.query(
      "UPDATE flight SET flight_number = $1, departure_airport_id = $2, arrival_airport_id = $3, departure_time = $4, arrival_time = $5, aircraft_id = $6, airline_id = $7, status = $8 WHERE id = $9 RETURNING *",
      [flight_number, departure_airport_id, arrival_airport_id, departure_time, arrival_time, aircraft_id, airline_id, status, id]
    );
    
    res.status(200).json({ message: "Flight updated successfully", data: updatedFlight.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a flight
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if flight exists
    const flight = await pool.query("SELECT * FROM flight WHERE id = $1", [id]);
    
    if (flight.rows.length === 0) {
      return res.status(404).json({ message: "Flight not found" });
    }
    
    // Check if flight has related bookings
    const relatedBookings = await pool.query("SELECT COUNT(*) FROM booking WHERE flight_id = $1", [id]);
    
    if (parseInt(relatedBookings.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete flight with related bookings", 
        data: {
          bookings: parseInt(relatedBookings.rows[0].count)
        }
      });
    }
    
    // Check if flight has related crew assignments
    const relatedCrewAssignments = await pool.query("SELECT COUNT(*) FROM flight_crew WHERE flight_id = $1", [id]);
    
    if (parseInt(relatedCrewAssignments.rows[0].count) > 0) {
      // Delete related crew assignments first
      await pool.query("DELETE FROM flight_crew WHERE flight_id = $1", [id]);
    }
    
    // Delete the flight
    await pool.query("DELETE FROM flight WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Flight deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;