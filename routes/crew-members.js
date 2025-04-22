const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// GET all crew members
router.get('/', async (req, res) => {
  try {
    const crewMembers = await pool.query(`
      SELECT cm.*, a.name as airline_name, COUNT(fc.flight_id) as flight_count
      FROM crew_member cm
      LEFT JOIN airline a ON cm.airline_id = a.id
      LEFT JOIN flight_crew fc ON cm.id = fc.crew_member_id
      GROUP BY cm.id, a.name
      ORDER BY cm.last_name, cm.first_name
    `);

    res.status(200).json({ message: "Crew members retrieved successfully", data: crewMembers.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET a specific crew member
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const crewMember = await pool.query(`
      SELECT cm.*, a.name as airline_name
      FROM crew_member cm
      LEFT JOIN airline a ON cm.airline_id = a.id
      WHERE cm.id = $1
    `, [id]);
    
    if (crewMember.rows.length === 0) {
      return res.status(404).json({ message: "Crew member not found" });
    }
    
    // Get flights for this crew member
    const flights = await pool.query(`
      SELECT f.id, f.flight_number, fc.role,
             f.departure_time, f.arrival_time, f.status,
             dep.name as departure_airport, dep.iata_code as departure_code,
             arr.name as arrival_airport, arr.iata_code as arrival_code
      FROM flight_crew fc
      JOIN flight f ON fc.flight_id = f.id
      JOIN airport dep ON f.departure_airport_id = dep.id
      JOIN airport arr ON f.arrival_airport_id = arr.id
      WHERE fc.crew_member_id = $1
      ORDER BY f.departure_time DESC
    `, [id]);
    
    const result = {
      ...crewMember.rows[0],
      flights: flights.rows
    };
    
    res.status(200).json({ message: "Crew member retrieved successfully", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new crew member
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, position, airline_id, license_number, experience_years } = req.body;

    if (!first_name || !last_name || !position || !airline_id) {
      return res.status(400).json({ message: "First name, last name, position, and airline ID are required" });
    }
    
    // Check if airline exists
    const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
    
    if (airline.rows.length === 0) {
      return res.status(400).json({ message: "Airline does not exist" });
    }
    
    const id = uuidv4();
    const newCrewMember = await pool.query(
      "INSERT INTO crew_member (id, first_name, last_name, position, airline_id, license_number, experience_years) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [id, first_name, last_name, position, airline_id, license_number, experience_years]
    );
    
    res.status(201).json({ message: "Crew member created successfully", data: newCrewMember.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE a crew member
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, position, airline_id, license_number, experience_years } = req.body;

    // Check if crew member exists
    const crewMember = await pool.query("SELECT * FROM crew_member WHERE id = $1", [id]);
    
    if (crewMember.rows.length === 0) {
      return res.status(404).json({ message: "Crew member not found" });
    }
    
    if (!first_name || !last_name || !position || !airline_id) {
      return res.status(400).json({ message: "First name, last name, position, and airline ID are required" });
    }
    
    // Check if airline exists
    const airline = await pool.query("SELECT * FROM airline WHERE id = $1", [airline_id]);
    
    if (airline.rows.length === 0) {
      return res.status(400).json({ message: "Airline does not exist" });
    }
    
    const updatedCrewMember = await pool.query(
      "UPDATE crew_member SET first_name = $1, last_name = $2, position = $3, airline_id = $4, license_number = $5, experience_years = $6 WHERE id = $7 RETURNING *",
      [first_name, last_name, position, airline_id, license_number, experience_years, id]
    );
    
    res.status(200).json({ message: "Crew member updated successfully", data: updatedCrewMember.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a crew member
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if crew member exists
    const crewMember = await pool.query("SELECT * FROM crew_member WHERE id = $1", [id]);
    
    if (crewMember.rows.length === 0) {
      return res.status(404).json({ message: "Crew member not found" });
    }
    
    // Check if crew member is assigned to any flights
    const flightAssignments = await pool.query("SELECT COUNT(*) FROM flight_crew WHERE crew_member_id = $1", [id]);
    
    if (parseInt(flightAssignments.rows[0].count) > 0) {
      // Delete flight crew assignments first
      await pool.query("DELETE FROM flight_crew WHERE crew_member_id = $1", [id]);
    }
    
    // Delete the crew member
    await pool.query("DELETE FROM crew_member WHERE id = $1", [id]);
    
    res.status(200).json({ message: "Crew member deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign crew member to a flight
router.post('/assign', async (req, res) => {
  try {
    const { flight_id, crew_member_id, role } = req.body;
    
    if (!flight_id || !crew_member_id || !role) {
      return res.status(400).json({ message: "Flight ID, crew member ID, and role are required" });
    }
    
    // Check if flight exists
    const flight = await pool.query("SELECT * FROM flight WHERE id = $1", [flight_id]);
    
    if (flight.rows.length === 0) {
      return res.status(400).json({ message: "Flight does not exist" });
    }
    
    // Check if crew member exists
    const crewMember = await pool.query("SELECT * FROM crew_member WHERE id = $1", [crew_member_id]);
    
    if (crewMember.rows.length === 0) {
      return res.status(400).json({ message: "Crew member does not exist" });
    }
    
    // Check if crew member belongs to the same airline as the flight
    if (crewMember.rows[0].airline_id !== flight.rows[0].airline_id) {
      return res.status(400).json({ message: "Crew member does not belong to the airline operating this flight" });
    }
    
    // Check if assignment already exists
    const existingAssignment = await pool.query(
      "SELECT * FROM flight_crew WHERE flight_id = $1 AND crew_member_id = $2",
      [flight_id, crew_member_id]
    );
    
    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ message: "This crew member is already assigned to this flight" });
    }
    
    // Create the assignment
    const newAssignment = await pool.query(
      "INSERT INTO flight_crew (flight_id, crew_member_id, role) VALUES ($1, $2, $3) RETURNING *",
      [flight_id, crew_member_id, role]
    );
    
    res.status(201).json({ message: "Crew member assigned to flight successfully", data: newAssignment.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove crew member from a flight
router.delete('/assign', async (req, res) => {
  try {
    const { flight_id, crew_member_id } = req.body;
    
    if (!flight_id || !crew_member_id) {
      return res.status(400).json({ message: "Flight ID and crew member ID are required" });
    }
    
    // Check if assignment exists
    const assignment = await pool.query(
      "SELECT * FROM flight_crew WHERE flight_id = $1 AND crew_member_id = $2",
      [flight_id, crew_member_id]
    );
    
    if (assignment.rows.length === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    
    // Delete the assignment
    await pool.query(
      "DELETE FROM flight_crew WHERE flight_id = $1 AND crew_member_id = $2",
      [flight_id, crew_member_id]
    );
    
    res.status(200).json({ message: "Crew member removed from flight successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;