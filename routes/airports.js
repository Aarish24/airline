const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all airports
router.get('/', async (req, res) => {
  try {
    const airports = await pool.query(`
      SELECT a.*, 
             COUNT(DISTINCT f1.id) as departures,
             COUNT(DISTINCT f2.id) as arrivals
      FROM airport a
      LEFT JOIN flight f1 ON a.id = f1.departure_airport_id
      LEFT JOIN flight f2 ON a.id = f2.arrival_airport_id
      GROUP BY a.id
      ORDER BY a.name
    `);

    res.status(200).json({ message: "Airports retrieved successfully", data: airports.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific airport
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const airport = await pool.query(`
      SELECT a.* 
      FROM airport a
      WHERE a.id = $1
    `, [id]);
    
    if (airport.rows.length === 0) {
      return res.status(404).json({ message: "Airport not found" });
    }
    
    // Get departing flights
    const departingFlights = await pool.query(`
      SELECT f.id, f.flight_number, 
             a.name as airline, a.iata_code as airline_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code,
             f.departure_time, f.arrival_time, f.status
      FROM flight f
      JOIN airline a ON f.airline_id = a.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      WHERE f.departure_airport_id = $1
      ORDER BY f.departure_time DESC
    `, [id]);
    
    // Get arriving flights
    const arrivingFlights = await pool.query(`
      SELECT f.id, f.flight_number, 
             a.name as airline, a.iata_code as airline_code,
             dep.name as departure_airport, dep.iata_code as departure_code,
             f.departure_time, f.arrival_time, f.status
      FROM flight f
      JOIN airline a ON f.airline_id = a.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      WHERE f.arrival_airport_id = $1
      ORDER BY f.arrival_time DESC
    `, [id]);
    
    const result = {
      ...airport.rows[0],
      departing_flights: departingFlights.rows,
      arriving_flights: arrivingFlights.rows
    };
    
    res.status(200).json({ message: "Airport retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new airport
router.post('/', async (req, res) => {
  try {
    const { name, iata_code, city, country, latitude, longitude } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Airport name is required" });
    }
    
    const id = uuidv4();
    const newAirport = await pool.query(
      "INSERT INTO airport (id, name, iata_code, city, country, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, name, iata_code, city, country, latitude, longitude]
    );
    
    res.status(201).json({ message: "Airport created successfully", data: newAirport.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE an airport
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, iata_code, city, country, latitude, longitude } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Airport name is required" });
    }
    
    const updatedAirport = await pool.query(
      "UPDATE airport SET name = $1, iata_code = $2, city = $3, country = $4, latitude = $5, longitude = $6 WHERE id = $7 RETURNING *",
      [name, iata_code, city, country, latitude, longitude, id]
    );
    
    if (updatedAirport.rows.length === 0) {
      return res.status(404).json({ message: "Airport not found" });
    }
    
    res.status(200).json({ message: "Airport updated successfully", data: updatedAirport.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE an airport
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if airport exists
    const airport = await pool.query("SELECT * FROM airport WHERE id = $1", [id]);
    
    if (airport.rows.length === 0) {
      return res.status(404).json({ message: "Airport not found" });
    }
    
    // Check if airport has related records
    const departingFlights = await pool.query("SELECT COUNT(*) FROM flight WHERE departure_airport_id = $1", [id]);
    const arrivingFlights = await pool.query("SELECT COUNT(*) FROM flight WHERE arrival_airport_id = $1", [id]);
    
    if (parseInt(departingFlights.rows[0].count) > 0 || parseInt(arrivingFlights.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete airport with related flights", 
        data: {
          departing: parseInt(departingFlights.rows[0].count),
          arriving: parseInt(arrivingFlights.rows[0].count)
        }
      });
    }
    
    // Delete the airport
    await pool.query("DELETE FROM airport WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Airport deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;