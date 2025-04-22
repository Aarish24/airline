const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all passengers
router.get('/', async (req, res) => {
  try {
    const passengers = await pool.query(`
      SELECT p.*, COUNT(b.id) as booking_count
      FROM passenger p
      LEFT JOIN booking b ON p.id = b.passenger_id
      GROUP BY p.id
      ORDER BY p.last_name, p.first_name
    `);

    res.status(200).json({ message: "Passengers retrieved successfully", data: passengers.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific passenger
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const passenger = await pool.query(`
      SELECT p.*
      FROM passenger p
      WHERE p.id = $1
    `, [id]);
    
    if (passenger.rows.length === 0) {
      return res.status(404).json({ message: "Passenger not found" });
    }
    
    // Get bookings for this passenger
    const bookings = await pool.query(`
      SELECT b.id, b.seat_number, b.booking_status, b.price, b.booking_date,
             f.flight_number, f.departure_time, f.arrival_time, f.status,
             a.name as airline_name, a.iata_code as airline_code,
             dep.name as departure_airport, dep.iata_code as departure_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code
      FROM booking b
      JOIN flight f ON b.flight_id = f.id
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      WHERE b.passenger_id = $1
      ORDER BY f.departure_time DESC
    `, [id]);
    
    const result = {
      ...passenger.rows[0],
      bookings: bookings.rows
    };
    
    res.status(200).json({ message: "Passenger retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new passenger
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, passport_number, nationality, date_of_birth } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }
    
    // Check if passenger with same email already exists
    const existingPassenger = await pool.query("SELECT * FROM passenger WHERE email = $1", [email]);
    
    if (existingPassenger.rows.length > 0) {
      return res.status(400).json({ message: "A passenger with this email already exists" });
    }
    
    const id = uuidv4();
    const newPassenger = await pool.query(
      "INSERT INTO passenger (id, first_name, last_name, email, phone, passport_number, nationality, date_of_birth) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [id, first_name, last_name, email, phone, passport_number, nationality, date_of_birth]
    );
    
    res.status(201).json({ message: "Passenger created successfully", data: newPassenger.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE a passenger
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, passport_number, nationality, date_of_birth } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: "First name, last name, and email are required" });
    }
    
    // Check if passenger exists
    const passenger = await pool.query("SELECT * FROM passenger WHERE id = $1", [id]);
    
    if (passenger.rows.length === 0) {
      return res.status(404).json({ message: "Passenger not found" });
    }
    
    // Check if another passenger with the same email exists
    const existingPassenger = await pool.query("SELECT * FROM passenger WHERE email = $1 AND id != $2", [email, id]);
    
    if (existingPassenger.rows.length > 0) {
      return res.status(400).json({ message: "Another passenger with this email already exists" });
    }
    
    const updatedPassenger = await pool.query(
      "UPDATE passenger SET first_name = $1, last_name = $2, email = $3, phone = $4, passport_number = $5, nationality = $6, date_of_birth = $7 WHERE id = $8 RETURNING *",
      [first_name, last_name, email, phone, passport_number, nationality, date_of_birth, id]
    );
    
    res.status(200).json({ message: "Passenger updated successfully", data: updatedPassenger.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a passenger
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if passenger exists
    const passenger = await pool.query("SELECT * FROM passenger WHERE id = $1", [id]);
    
    if (passenger.rows.length === 0) {
      return res.status(404).json({ message: "Passenger not found" });
    }
    
    // Check if passenger has related bookings
    const relatedBookings = await pool.query("SELECT COUNT(*) FROM booking WHERE passenger_id = $1", [id]);
    
    if (parseInt(relatedBookings.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete passenger with related bookings", 
        data: {
          bookings: parseInt(relatedBookings.rows[0].count)
        }
      });
    }
    
    // Delete the passenger
    await pool.query("DELETE FROM passenger WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Passenger deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;