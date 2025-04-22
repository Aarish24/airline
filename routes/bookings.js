const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await pool.query(`
      SELECT b.*, 
             p.first_name, p.last_name, p.email,
             f.flight_number, f.departure_time, f.arrival_time, f.status,
             a.name as airline_name,
             dep.name as departure_airport, dep.iata_code as departure_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code
      FROM booking b
      JOIN passenger p ON b.passenger_id = p.id
      JOIN flight f ON b.flight_id = f.id
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      ORDER BY f.departure_time DESC
    `);

    res.status(200).json({ message: "Bookings retrieved successfully", data: bookings.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific booking
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await pool.query(`
      SELECT b.*, 
             p.first_name, p.last_name, p.email, p.phone, p.passport_number, p.nationality,
             f.flight_number, f.departure_time, f.arrival_time, f.status,
             a.name as airline_name, a.iata_code as airline_code,
             dep.name as departure_airport, dep.iata_code as departure_code, dep.city as departure_city,
             arr.name as arrival_airport, arr.iata_code as arrival_code, arr.city as arrival_city,
             ac.registration_number, ac.model as aircraft_model
      FROM booking b
      JOIN passenger p ON b.passenger_id = p.id
      JOIN flight f ON b.flight_id = f.id
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      WHERE b.id = $1
    `, [id]);
    
    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    res.status(200).json({ message: "Booking retrieved successfully", data: booking.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new booking
router.post('/', async (req, res) => {
  try {
    const { flight_id, passenger_id, seat_number, booking_status, price } = req.body;

    if (!flight_id || !passenger_id) {
      return res.status(400).json({ message: "Flight ID and passenger ID are required" });
    }
    
    // Check if flight exists
    const flight = await pool.query("SELECT * FROM flight WHERE id = $1", [flight_id]);
    
    if (flight.rows.length === 0) {
      return res.status(400).json({ message: "Flight does not exist" });
    }
    
    // Check if passenger exists
    const passenger = await pool.query("SELECT * FROM passenger WHERE id = $1", [passenger_id]);
    
    if (passenger.rows.length === 0) {
      return res.status(400).json({ message: "Passenger does not exist" });
    }
    
    // Check if seat is already booked for this flight
    if (seat_number) {
      const existingSeat = await pool.query(
        "SELECT * FROM booking WHERE flight_id = $1 AND seat_number = $2",
        [flight_id, seat_number]
      );
      
      if (existingSeat.rows.length > 0) {
        return res.status(400).json({ message: "This seat is already booked" });
      }
    }
    
    const id = uuidv4();
    const booking_date = new Date();
    
    const newBooking = await pool.query(
      "INSERT INTO booking (id, flight_id, passenger_id, booking_date, seat_number, booking_status, price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, flight_id, passenger_id, booking_date, seat_number, booking_status || 'Confirmed', price]
    );
    
    res.status(201).json({ message: "Booking created successfully", data: newBooking.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE a booking
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { flight_id, passenger_id, seat_number, booking_status, price } = req.body;

    // Check if booking exists
    const booking = await pool.query("SELECT * FROM booking WHERE id = $1", [id]);
    
    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    if (!flight_id || !passenger_id) {
      return res.status(400).json({ message: "Flight ID and passenger ID are required" });
    }
    
    // Check if flight exists
    const flight = await pool.query("SELECT * FROM flight WHERE id = $1", [flight_id]);
    
    if (flight.rows.length === 0) {
      return res.status(400).json({ message: "Flight does not exist" });
    }
    
    // Check if passenger exists
    const passenger = await pool.query("SELECT * FROM passenger WHERE id = $1", [passenger_id]);
    
    if (passenger.rows.length === 0) {
      return res.status(400).json({ message: "Passenger does not exist" });
    }
    
    // Check if seat is already booked for this flight (by another booking)
    if (seat_number) {
      const existingSeat = await pool.query(
        "SELECT * FROM booking WHERE flight_id = $1 AND seat_number = $2 AND id != $3",
        [flight_id, seat_number, id]
      );
      
      if (existingSeat.rows.length > 0) {
        return res.status(400).json({ message: "This seat is already booked" });
      }
    }
    
    const updatedBooking = await pool.query(
      "UPDATE booking SET flight_id = $1, passenger_id = $2, seat_number = $3, booking_status = $4, price = $5 WHERE id = $6 RETURNING *",
      [flight_id, passenger_id, seat_number, booking_status, price, id]
    );
    
    res.status(200).json({ message: "Booking updated successfully", data: updatedBooking.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a booking
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if booking exists
    const booking = await pool.query("SELECT * FROM booking WHERE id = $1", [id]);
    
    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    // Delete the booking
    await pool.query("DELETE FROM booking WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;