const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all airlines
router.get('/', async (req, res) => {
  try {
    const airlines = await pool.query(`
            SELECT a.*, COUNT(f.id) as flight_count 
            FROM airline a
            LEFT JOIN flight f ON a.id = f.airline_id
            GROUP BY a.id
            ORDER BY a.name
        `);

    res.status(200).json({ message: "Airlines retrieved successfully", data: airlines.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific airline
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const airline = await pool.query(`
            SELECT a.* 
            FROM airline a
            WHERE a.id = $1
        `, [id]);
    
    if (airline.rows.length === 0) {
        return res.status(404).json({ message: "Airline not found" });
    }
    
    // Get flights for this airline
    const flights = await pool.query(`
        SELECT f.id, f.flight_number, 
               dep.name as departure_airport, dep.iata_code as departure_code,
               arr.name as arrival_airport, arr.iata_code as arrival_code,
               f.departure_time, f.arrival_time, f.status
        FROM flight f
        JOIN airport dep ON f.departure_airport_id = dep.id
        JOIN airport arr ON f.arrival_airport_id = arr.id
        WHERE f.airline_id = $1
        ORDER BY f.departure_time DESC
    `, [id]);
    
    // Get aircraft for this airline
    const aircraft = await pool.query(`
        SELECT id, registration_number, model, manufacturer, capacity
        FROM aircraft
        WHERE airline_id = $1
    `, [id]);
    
    const result = {
        ...airline.rows[0],
        flights: flights.rows,
        aircraft: aircraft.rows
    };
    
    res.status(200).json({ message: "Airline retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new airline
router.post('/', async (req, res) => {
  try {
    const { name, iata_code, country, founded_year } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Airline name is required" });
    }
    
    const id = uuidv4();
    const newAirline = await pool.query(
        "INSERT INTO airline (id, name, iata_code, country, founded_year) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [id, name, iata_code, country, founded_year]
    );
    
    res.status(201).json({ message: "Airline created successfully", data: newAirline.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE an airline
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, iata_code, country, founded_year } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Airline name is required" });
    }
    
    const updatedAirline = await pool.query(
        "UPDATE airline SET name = $1, iata_code = $2, country = $3, founded_year = $4 WHERE id = $5 RETURNING *",
        [name, iata_code, country, founded_year, id]
    );
    
    if (updatedAirline.rows.length === 0) {
        return res.status(404).json({ message: "Airline not found" });
    }
    
    res.status(200).json({ message: "Airline updated successfully", data: updatedAirline.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE an airline
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if airline exists
    const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [id]);
    
    if (airline.rows.length === 0) {
        return res.status(404).json({ message: "Airline not found" });
    }
    
    // Check if airline has related records
    const relatedAircraft = await pool.query("SELECT COUNT(*) FROM aircraft WHERE airline_id = $1", [id]);
    const relatedFlights = await pool.query("SELECT COUNT(*) FROM flight WHERE airline_id = $1", [id]);
    const relatedCrewMembers = await pool.query("SELECT COUNT(*) FROM crew_member WHERE airline_id = $1", [id]);
    
    if (parseInt(relatedAircraft.rows[0].count) > 0 || 
        parseInt(relatedFlights.rows[0].count) > 0 || 
        parseInt(relatedCrewMembers.rows[0].count) > 0) {
        return res.status(400).json({ 
            message: "Cannot delete airline with related records", 
            data: {
                aircraft: parseInt(relatedAircraft.rows[0].count),
                flights: parseInt(relatedFlights.rows[0].count),
                crewMembers: parseInt(relatedCrewMembers.rows[0].count)
            }
        });
    }
    
    // Delete the airline
    await pool.query("DELETE FROM airline WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Airline deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;