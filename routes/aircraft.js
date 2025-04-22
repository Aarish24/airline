const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all aircraft
router.get('/', async (req, res) => {
  try {
    const aircraft = await pool.query(`
      SELECT ac.*, a.name as airline_name, COUNT(f.id) as flight_count
      FROM aircraft ac
      LEFT JOIN airline a ON ac.airline_id = a.id
      LEFT JOIN flight f ON ac.id = f.aircraft_id
      GROUP BY ac.id, a.name
      ORDER BY ac.registration_number
    `);

    res.status(200).json({ message: "Aircraft retrieved successfully", data: aircraft.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific aircraft
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const aircraft = await pool.query(`
      SELECT ac.*, a.name as airline_name
      FROM aircraft ac
      LEFT JOIN airline a ON ac.airline_id = a.id
      WHERE ac.id = $1
    `, [id]);
    
    if (aircraft.rows.length === 0) {
      return res.status(404).json({ message: "Aircraft not found" });
    }
    
    // Get flights for this aircraft
    const flights = await pool.query(`
      SELECT f.id, f.flight_number, 
             dep.name as departure_airport, dep.iata_code as departure_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code,
             f.departure_time, f.arrival_time, f.status
      FROM flight f
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      WHERE f.aircraft_id = $1
      ORDER BY f.departure_time DESC
    `, [id]);
    
    const result = {
      ...aircraft.rows[0],
      flights: flights.rows
    };
    
    res.status(200).json({ message: "Aircraft retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new aircraft
router.post('/', async (req, res) => {
  try {
    const { registration_number, model, manufacturer, capacity, year_manufactured, airline_id } = req.body;

    if (!registration_number || !model) {
      return res.status(400).json({ message: "Registration number and model are required" });
    }
    
    // Check if airline exists
    if (airline_id) {
      const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
      if (airline.rows.length === 0) {
        return res.status(400).json({ message: "Specified airline does not exist" });
      }
    }
    
    const id = uuidv4();
    const newAircraft = await pool.query(
      "INSERT INTO aircraft (id, registration_number, model, manufacturer, capacity, year_manufactured, airline_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, registration_number, model, manufacturer, capacity, year_manufactured, airline_id]
    );
    
    res.status(201).json({ message: "Aircraft created successfully", data: newAircraft.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE an aircraft
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { registration_number, model, manufacturer, capacity, year_manufactured, airline_id } = req.body;

    if (!registration_number || !model) {
      return res.status(400).json({ message: "Registration number and model are required" });
    }
    
    // Check if airline exists
    if (airline_id) {
      const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
      if (airline.rows.length === 0) {
        return res.status(400).json({ message: "Specified airline does not exist" });
      }
    }
    
    const updatedAircraft = await pool.query(
      "UPDATE aircraft SET registration_number = $1, model = $2, manufacturer = $3, capacity = $4, year_manufactured = $5, airline_id = $6 WHERE id = $7 RETURNING *",
      [registration_number, model, manufacturer, capacity, year_manufactured, airline_id, id]
    );
    
    if (updatedAircraft.rows.length === 0) {
      return res.status(404).json({ message: "Aircraft not found" });
    }
    
    res.status(200).json({ message: "Aircraft updated successfully", data: updatedAircraft.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE an aircraft
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if aircraft exists
    const aircraft = await pool.query("SELECT * FROM aircraft WHERE id = $1", [id]);
    
    if (aircraft.rows.length === 0) {
      return res.status(404).json({ message: "Aircraft not found" });
    }
    
    // Check if aircraft has related flights
    const relatedFlights = await pool.query("SELECT COUNT(*) FROM flight WHERE aircraft_id = $1", [id]);
    
    if (parseInt(relatedFlights.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: "Cannot delete aircraft with related flights", 
        data: {
          flights: parseInt(relatedFlights.rows[0].count)
        }
      });
    }
    
    // Delete the aircraft
    await pool.query("DELETE FROM aircraft WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Aircraft deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;